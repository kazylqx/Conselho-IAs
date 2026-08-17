/**
 * ============================================================================
 *  BUSCA NA WEB — implementacao com a Tavily
 * ============================================================================
 * Contrato unico usado pelo orquestrador:
 *
 *   webSearch(query, options) -> {
 *     implemented: boolean,          // false = camada de busca indisponivel
 *     query: string,
 *     provider: string|null,
 *     results: [{ title, url, snippet, publishedAt, source }],
 *     note?: string                  // motivo, quando indisponivel
 *   }
 *
 * Regra de ouro: esta funcao NUNCA lanca excecao. Qualquer problema (chave
 * ausente, chave invalida, timeout, limite de credito, instabilidade) volta como
 * `implemented: false` com uma nota legivel — o debate continua sem contexto
 * externo em vez de quebrar.
 *
 * Docs: https://docs.tavily.com/documentation/api-reference/endpoint/search
 * Chave gratuita (1.000 creditos/mes): https://app.tavily.com
 */

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';

/** Tamanho maximo do trecho de cada resultado (protege o tamanho do prompt). */
const MAX_SNIPPET_CHARS = 600;

/**
 * @typedef {Object} WebSearchResult
 * @property {string}      title       titulo da pagina
 * @property {string}      url         link
 * @property {string}      snippet     trecho relevante ja limpo pela Tavily
 * @property {string|null} publishedAt data de publicacao (YYYY-MM-DD) quando existir
 * @property {string}      source      dominio (ex.: "g1.globo.com")
 * @property {number|null} [score]     relevancia atribuida pela Tavily (0 a 1)
 */

/**
 * @typedef {Object} WebSearchResponse
 * @property {boolean}           implemented
 * @property {string}            query
 * @property {string|null}       provider
 * @property {WebSearchResult[]} results
 * @property {string}  [note]
 * @property {number}  [credits]    creditos consumidos na chamada
 * @property {number}  [status]     status HTTP, quando houve erro
 */

/** Provedor configurado (hoje so "tavily" esta implementado). */
function provedorConfigurado() {
  return (process.env.WEB_SEARCH_PROVIDER || 'tavily').toLowerCase().trim();
}

/**
 * Diz se a busca esta pronta para uso, sem gastar credito.
 * O orquestrador consulta isso para decidir se oferece a ferramenta aos agentes.
 * @returns {boolean}
 */
export function isWebSearchAvailable() {
  return provedorConfigurado() === 'tavily' && Boolean(process.env.WEB_SEARCH_API_KEY);
}

/** Resposta padrao de "busca indisponivel". */
function indisponivel({ query, note, status = null }) {
  return {
    implemented: false,
    query,
    provider: provedorConfigurado() || null,
    results: [],
    note,
    ...(status ? { status } : {}),
  };
}

/** Normaliza espacos e corta o trecho. */
function limparTrecho(texto) {
  const limpo = String(texto ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return limpo.length > MAX_SNIPPET_CHARS ? `${limpo.slice(0, MAX_SNIPPET_CHARS)}…` : limpo;
}

/** Converte data em YYYY-MM-DD; devolve null se nao der para interpretar. */
function normalizarData(valor) {
  if (!valor) return null;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return null;
  return data.toISOString().slice(0, 10);
}

/** Dominio limpo, usado como nome da fonte. */
function extrairDominio(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

/** Converte um item da Tavily no formato do contrato. */
function mapearResultado(item) {
  const url = String(item?.url ?? '').trim();
  return {
    title: String(item?.title ?? '').trim() || url,
    url,
    snippet: limparTrecho(item?.content),
    publishedAt: normalizarData(item?.published_date ?? item?.publishedDate),
    source: extrairDominio(url),
    score: typeof item?.score === 'number' ? item.score : null,
  };
}

/** Mensagem amigavel para cada tipo de falha HTTP da Tavily. */
function descreverErroHttp(status, dados, textoBruto) {
  const detalhe =
    dados?.detail?.error ||
    dados?.detail ||
    dados?.error ||
    dados?.message ||
    (typeof textoBruto === 'string' ? textoBruto.slice(0, 200) : '');

  if (status === 401 || status === 403) {
    return `Tavily recusou a chave (HTTP ${status}). Confira WEB_SEARCH_API_KEY — ela começa com "tvly-".`;
  }
  if (status === 429 || status === 432 || status === 433) {
    return `Limite da Tavily atingido (HTTP ${status}): créditos ou requisições por minuto esgotados.`;
  }
  if (status === 400 || status === 422) {
    return `Tavily rejeitou a consulta (HTTP ${status})${detalhe ? `: ${detalhe}` : ''}.`;
  }
  if (status >= 500) {
    return `Tavily indisponível no momento (HTTP ${status}).`;
  }
  return `Tavily respondeu HTTP ${status}${detalhe ? `: ${detalhe}` : ''}.`;
}

/**
 * Busca na web (Tavily).
 *
 * @param {string} query consulta em linguagem natural
 * @param {object} [options]
 * @param {number}   [options.maxResults=5]      quantos resultados pedir (1 a 10)
 * @param {string}   [options.searchDepth]       "basic" (1 crédito) ou "advanced" (2 créditos)
 * @param {string}   [options.topic='general']   "general" ou "news"
 * @param {string}   [options.timeRange]         "day" | "week" | "month" | "year"
 * @param {string[]} [options.includeDomains]    restringe a estes domínios
 * @param {string[]} [options.excludeDomains]    ignora estes domínios
 * @param {number}   [options.timeoutMs]         tempo máximo de espera
 * @param {string}   [options.sessionId]         agrupa as buscas de um debate nos logs da Tavily
 * @param {AbortSignal} [options.signal]         permite cancelar de fora
 * @returns {Promise<WebSearchResponse>}
 */
export async function webSearch(query, options = {}) {
  const {
    maxResults = 5,
    searchDepth = process.env.WEB_SEARCH_DEPTH || 'basic',
    topic = 'general',
    timeRange = null,
    includeDomains = [],
    excludeDomains = [],
    timeoutMs = Number.parseInt(process.env.WEB_SEARCH_TIMEOUT_MS ?? '15000', 10) || 15000,
    sessionId = null,
    signal = null,
  } = options;

  const consulta = String(query ?? '').trim();
  const provedor = provedorConfigurado();

  // ---- validacoes que nao custam credito -----------------------------------
  if (!consulta) {
    return indisponivel({ query: consulta, note: 'Consulta vazia: nada a buscar.' });
  }

  if (provedor !== 'tavily') {
    return indisponivel({
      query: consulta,
      note:
        `Provedor de busca "${provedor}" não implementado. Use WEB_SEARCH_PROVIDER=tavily ` +
        'ou adapte src/agents/webSearch.js.',
    });
  }

  const apiKey = process.env.WEB_SEARCH_API_KEY;
  if (!apiKey) {
    return indisponivel({
      query: consulta,
      note: 'WEB_SEARCH_API_KEY não definida: a busca na web está desligada.',
    });
  }

  // ---- chamada HTTP com timeout -------------------------------------------
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const propagarAbort = () => controller.abort();
  signal?.addEventListener?.('abort', propagarAbort, { once: true });

  const corpo = {
    query: consulta,
    // "basic" gasta 1 crédito por busca; "advanced" gasta 2 e traz mais contexto.
    search_depth: searchDepth,
    topic,
    max_results: Math.min(Math.max(1, Number(maxResults) || 5), 10),
    // Não precisamos do resumo da Tavily nem do HTML cru: quem raciocina são os agentes.
    include_answer: false,
    include_raw_content: false,
    include_images: false,
    ...(timeRange ? { time_range: timeRange } : {}),
    ...(includeDomains.length ? { include_domains: includeDomains } : {}),
    ...(excludeDomains.length ? { exclude_domains: excludeDomains } : {}),
  };

  const iniciouEm = Date.now();

  try {
    const resposta = await fetch(TAVILY_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
        // Agrupa, nos logs da Tavily, todas as buscas do mesmo debate.
        ...(sessionId ? { 'X-Session-Id': String(sessionId) } : {}),
      },
      body: JSON.stringify(corpo),
      signal: controller.signal,
    });

    const textoBruto = await resposta.text();
    let dados = null;
    try {
      dados = textoBruto ? JSON.parse(textoBruto) : null;
    } catch {
      dados = null;
    }

    if (!resposta.ok) {
      const note = descreverErroHttp(resposta.status, dados, textoBruto);
      console.warn(`[webSearch] ${note}`);
      return indisponivel({ query: consulta, note, status: resposta.status });
    }

    const resultados = (Array.isArray(dados?.results) ? dados.results : [])
      .map(mapearResultado)
      .filter((item) => item.url);

    const creditos = dados?.usage?.credits ?? null;
    console.log(
      `[webSearch] "${consulta.slice(0, 70)}" -> ${resultados.length} resultado(s)` +
        `${creditos != null ? `, ${creditos} crédito(s)` : ''}, ${Date.now() - iniciouEm}ms`,
    );

    // Busca funcionou mesmo se nao achou nada: `implemented` continua true.
    return {
      implemented: true,
      query: consulta,
      provider: 'tavily',
      results: resultados,
      credits: creditos,
      requestId: dados?.request_id ?? null,
      durationMs: Date.now() - iniciouEm,
      ...(resultados.length ? {} : { note: 'A busca não retornou resultados relevantes.' }),
    };
  } catch (erro) {
    const limite = timeoutMs >= 1000 ? `${Math.round(timeoutMs / 1000)}s` : `${timeoutMs}ms`;
    const note =
      erro?.name === 'AbortError'
        ? `A busca na web passou de ${limite} e foi cancelada.`
        : `Falha de rede ao consultar a Tavily: ${erro?.message ?? erro}`;

    console.warn(`[webSearch] ${note}`);
    return indisponivel({ query: consulta, note });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', propagarAbort);
  }
}

/**
 * Monta o bloco de fontes que vai dentro do prompt.
 * Os numeros sao globais no debate (ver registro de fontes no orquestrador),
 * para que agentes e juiz citem sempre a mesma referencia.
 *
 * @param {Array<WebSearchResult & {n: number}>} sources
 * @param {object} [options]
 * @param {string} [options.titulo]
 * @returns {string} bloco pronto (string vazia se nao houver fonte)
 */
export function formatSourcesForPrompt(sources = [], { titulo = 'FONTES DA WEB' } = {}) {
  if (!sources.length) return '';

  const linhas = sources.map((item) => {
    const data = item.publishedAt ? ` · publicado em ${item.publishedAt}` : '';
    const dominio = item.source ? ` · ${item.source}` : '';
    return `[${item.n}] ${item.title}${dominio}${data}\n    ${item.url}\n    ${item.snippet}`;
  });

  return [
    `${titulo} (cite pelo número, ex.: "[2] mostra que..."; não invente fonte):`,
    ...linhas,
  ].join('\n');
}

/** Palavras que sugerem dependencia de informacao atual. */
const GATILHOS_TEMPORAIS = [
  'hoje',
  'agora',
  'atual',
  'atualmente',
  'atualizado',
  'recente',
  'recentemente',
  'ultima',
  'última',
  'ultimas',
  'últimas',
  'ultimo',
  'último',
  'novidade',
  'lancamento',
  'lançamento',
  'preco',
  'preço',
  'cotacao',
  'cotação',
  'quanto custa',
  'versao mais nova',
  'versão mais nova',
  'noticia',
  'notícia',
  'eleicao',
  'eleição',
  'placar',
  'clima',
  'previsao',
  'previsão',
  'este ano',
  'neste mes',
  'neste mês',
  'em 2025',
  'em 2026',
  'em 2027',
  'latest',
  'current',
  'today',
  'news',
];

/**
 * Heuristica leve para decidir se a pergunta depende de dados atuais.
 * Usada na rodada 1 para nao gastar credito em pergunta atemporal.
 * (Na rodada 2 quem decide eh o proprio agente, pedindo a busca.)
 *
 * @param {string} question
 * @returns {boolean}
 */
export function needsFreshData(question) {
  if (!question) return false;
  const texto = question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const temGatilho = GATILHOS_TEMPORAIS.some((gatilho) =>
    texto.includes(gatilho.normalize('NFD').replace(/[\u0300-\u036f]/g, '')),
  );

  // Ano recente citado explicitamente tambem conta como sinal.
  const anoAtual = new Date().getFullYear();
  const temAnoRecente = new RegExp(`\\b(${anoAtual - 1}|${anoAtual}|${anoAtual + 1})\\b`).test(texto);

  return temGatilho || temAnoRecente;
}
