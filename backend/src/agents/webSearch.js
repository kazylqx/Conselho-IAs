/**
 * ============================================================================
 *  CONTRATO DA BUSCA NA WEB  (intencionalmente NAO implementado)
 * ============================================================================
 * A logica real de busca fica de fora desta versao. O que existe aqui eh a
 * *interface*: assinatura, formato de retorno e o ponto exato onde plugar um
 * provedor (Tavily, Brave Search, Serper, SerpAPI, Exa, etc.).
 *
 * Enquanto `implemented` vier false, o orquestrador simplesmente segue o debate
 * sem contexto externo e registra isso na UI ("sem busca disponível").
 */

/**
 * @typedef {Object} WebSearchResult
 * @property {string}  title        titulo da pagina
 * @property {string}  url          link
 * @property {string}  snippet      trecho relevante
 * @property {string} [publishedAt] data de publicacao em ISO, se houver
 * @property {string} [source]      dominio/veiculo
 */

/**
 * @typedef {Object} WebSearchResponse
 * @property {boolean}           implemented  false enquanto nenhum provedor real estiver ligado
 * @property {string}            query        consulta usada
 * @property {WebSearchResult[]} results      resultados (vazio quando nao implementado)
 * @property {string|null}       provider     nome do provedor que respondeu
 * @property {string} [note]                  observacao livre (mostrada na UI)
 */

/**
 * Busca na web.
 *
 * >>> PONTO DE EXTENSAO <<<
 * Para ativar a busca de verdade, substitua o corpo desta funcao por uma chamada
 * ao seu provedor, mantendo o mesmo formato de retorno. Exemplo do formato final:
 *
 *   return {
 *     implemented: true,
 *     query,
 *     provider: process.env.WEB_SEARCH_PROVIDER,
 *     results: [
 *       { title: '...', url: 'https://...', snippet: '...', publishedAt: '2026-08-01', source: 'exemplo.com' },
 *     ],
 *   };
 *
 * @param {string} query                consulta em linguagem natural
 * @param {object} [options]
 * @param {number} [options.maxResults] quantidade maxima de resultados desejada
 * @param {string} [options.language]   idioma preferido dos resultados
 * @param {string} [options.recency]    janela temporal ('day' | 'week' | 'month' | 'year')
 * @param {AbortSignal} [options.signal] permite cancelar a busca
 * @returns {Promise<WebSearchResponse>}
 */
export async function webSearch(query, options = {}) {
  // Opcoes ficam declaradas para documentar o contrato esperado pelo provedor.
  const { maxResults = 5, language = 'pt-BR', recency = null, signal = null } = options;
  void maxResults;
  void language;
  void recency;
  void signal;

  return {
    implemented: false,
    query,
    provider: process.env.WEB_SEARCH_PROVIDER || null,
    results: [],
    note:
      'webSearch() ainda não está implementada. Plugue um provedor em ' +
      'src/agents/webSearch.js para os agentes consultarem dados atuais.',
  };
}

/**
 * Transforma o resultado da busca em texto para injetar no prompt do agente.
 * @param {WebSearchResponse} response
 * @returns {string} bloco de contexto (vazio se nao houver resultados)
 */
export function formatSearchResultsForPrompt(response) {
  if (!response?.implemented || !response.results?.length) return '';

  const linhas = response.results.map((item, index) => {
    const data = item.publishedAt ? ` (publicado em ${item.publishedAt})` : '';
    return `[${index + 1}] ${item.title}${data}\n    ${item.url}\n    ${item.snippet}`;
  });

  return [
    'RESULTADOS DE BUSCA NA WEB (use com critério e cite o número da fonte):',
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
 * Nao precisa ser perfeita: no pior caso os agentes recebem contexto extra
 * (ou nenhum, quando a busca ainda nao esta implementada).
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
    texto.includes(
      gatilho
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''),
    ),
  );

  // Ano recente citado explicitamente tambem conta como sinal.
  const anoAtual = new Date().getFullYear();
  const temAnoRecente = new RegExp(`\\b(${anoAtual - 1}|${anoAtual}|${anoAtual + 1})\\b`).test(texto);

  return temGatilho || temAnoRecente;
}
