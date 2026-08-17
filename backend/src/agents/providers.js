/**
 * ============================================================================
 *  CAMADA DE PROVEDORES DE IA
 * ============================================================================
 * Aqui fica TODO o contato com as APIs externas. O resto do sistema so conhece
 * a funcao `callModel()`, o que torna simples adicionar um provedor novo:
 * basta registrar uma entrada em PROVIDERS.
 *
 * Nenhuma chave aparece no codigo: elas vem sempre de process.env.
 * Usamos o `fetch` nativo do Node (>= 18), sem SDKs, para manter o deploy leve.
 */

/** Erro de provedor com codigo legivel, usado para sinalizar falha na UI. */
export class ProviderError extends Error {
  constructor(
    message,
    { code = 'provider_error', status = null, retryable = false, retryAfterMs = null } = {},
  ) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    /** Espera sugerida pelo provedor antes da proxima tentativa (ms). */
    this.retryAfterMs = retryAfterMs;
  }
}

/** true quando o modo demonstracao (sem APIs reais) esta ligado. */
export function isMockMode() {
  return String(process.env.MOCK_AI).toLowerCase() === 'true';
}

/**
 * Chaves padrao por provedor (podem ser sobrescritas por `apiKeyEnv` no agente).
 * Aqui existem apenas NOMES de variaveis de ambiente — nunca valores.
 */
const DEFAULT_KEY_ENV = {
  // provedores em uso no projeto
  groq: 'GROQ_API_KEY',
  google: 'GEMINI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  // alternativas prontas, caso queira trocar algum agente depois
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  'openai-compatible': 'OPENAI_COMPATIBLE_API_KEY',
};

/**
 * Base URL padrao dos provedores que falam o dialeto da OpenAI.
 * URL publica de endpoint nao eh segredo, entao pode ficar no codigo;
 * ainda assim da para sobrescrever por agente (`baseUrl`) ou por ambiente
 * (`baseUrlEnv`).
 */
const DEFAULT_BASE_URL = {
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  openai: 'https://api.openai.com/v1',
};

/** Provedores que usam o formato /chat/completions e precisam de base URL. */
const FAMILIA_OPENAI = new Set(['groq', 'openrouter', 'openai', 'openai-compatible']);

/** Pausa simples usada no backoff entre tentativas. */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * fetch com timeout via AbortController.
 * Converte qualquer falha de rede/timeout em ProviderError retryable.
 */
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ProviderError(`Timeout de ${Math.round(timeoutMs / 1000)}s ao chamar o modelo`, {
        code: 'timeout',
        retryable: true,
      });
    }
    throw new ProviderError(`Falha de rede: ${error.message}`, {
      code: 'network_error',
      retryable: true,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Le o corpo da resposta com tolerancia a payloads que nao sao JSON. */
async function parseBody(response) {
  const raw = await response.text();
  try {
    return { json: JSON.parse(raw), raw };
  } catch {
    return { json: null, raw };
  }
}

/**
 * Descobre quanto esperar antes de tentar de novo.
 * Camadas gratuitas dizem o tempo exato: a Groq responde
 * "Please try again in 20.52s" e alguns provedores mandam o header Retry-After.
 * Sem isso, um backoff de 800ms bate na parede de novo na hora.
 *
 * @returns {number|null} espera em ms
 */
function extrairEsperaSugerida(response, body) {
  const header = response.headers?.get?.('retry-after');
  if (header) {
    const segundos = Number.parseFloat(header);
    if (Number.isFinite(segundos)) return Math.ceil(segundos * 1000);
  }

  const texto = `${body?.raw ?? ''} ${JSON.stringify(body?.json ?? '')}`;
  const match = /try again in\s*([\d.]+)\s*(ms|s)\b/i.exec(texto);
  if (match) {
    const valor = Number.parseFloat(match[1]);
    if (Number.isFinite(valor)) return Math.ceil(match[2].toLowerCase() === 'ms' ? valor : valor * 1000);
  }

  return null;
}

/** Transforma resposta HTTP de erro em ProviderError (marcando o que da para repetir). */
function httpError(provider, response, body) {
  const detail =
    body.json?.error?.message ||
    body.json?.error?.type ||
    body.json?.message ||
    body.raw?.slice(0, 300) ||
    'sem detalhes';

  const retryable = response.status === 429 || response.status >= 500;
  return new ProviderError(`[${provider}] HTTP ${response.status}: ${detail}`, {
    code: retryable ? 'temporarily_unavailable' : 'api_error',
    status: response.status,
    retryable,
    retryAfterMs: retryable ? extrairEsperaSugerida(response, body) : null,
  });
}

// ---------------------------------------------------------------------------
// Implementacoes por provedor
// Cada uma recebe o mesmo contrato: ({ config, system, prompt, apiKey })
// e devolve o texto puro gerado pelo modelo.
// ---------------------------------------------------------------------------

/** Anthropic — Messages API. */
async function callAnthropic({ config, system, prompt, apiKey }) {
  const tokenParam = config.requestOptions?.tokenParam || 'max_tokens';
  const body = {
    model: config.model,
    [tokenParam]: config.maxTokens ?? 1200,
    system,
    messages: [{ role: 'user', content: prompt }],
  };
  if (config.requestOptions?.sendTemperature !== false) {
    body.temperature = config.temperature ?? 0.5;
  }

  const response = await fetchWithTimeout(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    },
    config.timeoutMs ?? 60000,
  );

  const parsed = await parseBody(response);
  if (!response.ok) throw httpError('anthropic', response, parsed);

  const text = (parsed.json?.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  if (!text) throw new ProviderError('[anthropic] resposta vazia', { code: 'empty_response' });
  return text;
}

/**
 * Groq, OpenRouter, OpenAI e qualquer API compativel com /chat/completions.
 * A diferenca entre elas eh so a base URL (e, no OpenRouter, dois headers
 * opcionais de identificacao do app).
 */
async function callOpenAICompatible({ config, system, prompt, apiKey, baseUrl, extraHeaders = {} }) {
  const tokenParam = config.requestOptions?.tokenParam || 'max_tokens';
  const body = {
    model: config.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    [tokenParam]: config.maxTokens ?? 1200,
  };
  if (config.requestOptions?.sendTemperature !== false) {
    body.temperature = config.temperature ?? 0.5;
  }

  // Parametros especificos do provedor (ex.: reasoning_effort na Groq).
  Object.assign(body, config.requestOptions?.extraBody ?? {});

  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    },
    config.timeoutMs ?? 60000,
  );

  const parsed = await parseBody(response);
  if (!response.ok) throw httpError(config.provider, response, parsed);

  const escolha = parsed.json?.choices?.[0];
  const text = (escolha?.message?.content ?? '').trim();

  if (!text) {
    // Modelo de raciocinio (gpt-oss, o-series, Nemotron...) gasta o orcamento de
    // tokens "pensando" e devolve content vazio. Mensagem especifica para isso.
    const truncado = escolha?.finish_reason === 'length';
    const pensou = Boolean(escolha?.message?.reasoning);

    throw new ProviderError(
      truncado || pensou
        ? `[${config.provider}] resposta vazia: o modelo gastou os ${config.maxTokens ?? 1200} tokens ` +
          'raciocinando. Aumente maxTokens do agente ou use requestOptions.extraBody = ' +
          "{ reasoning_effort: 'low' }."
        : `[${config.provider}] resposta vazia`,
      { code: 'empty_response' },
    );
  }

  return text;
}

/** Google Gemini — generateContent. */
async function callGoogle({ config, system, prompt, apiKey }) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(config.model)}:generateContent`;

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: config.maxTokens ?? 1200,
      ...(config.requestOptions?.sendTemperature === false
        ? {}
        : { temperature: config.temperature ?? 0.5 }),
    },
  };

  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // A chave vai no header para nao vazar na URL dos logs.
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
    },
    config.timeoutMs ?? 60000,
  );

  const parsed = await parseBody(response);
  if (!response.ok) throw httpError('google', response, parsed);

  const text = (parsed.json?.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('\n')
    .trim();

  if (!text) throw new ProviderError('[google] resposta vazia', { code: 'empty_response' });
  return text;
}

/**
 * Provedor simulado (MOCK_AI=true ou provider: "mock").
 * Serve para testar a interface inteira sem gastar credito de API.
 */
async function callMock({ config, prompt }) {
  // Latencia artificial para o "digitando..." aparecer de verdade.
  await sleep(700 + Math.random() * 1500);

  const isDebateRound = /RESPOSTAS DOS OUTROS/i.test(prompt);
  const isJudgeRound = /VEREDITO|juiz|juíza/i.test(prompt) && /JSON/i.test(prompt);
  const temFontes = /FONTES DA WEB/i.test(prompt);
  const podePedirBusca = /BUSCAR: <consulta/i.test(prompt);
  const jaBuscou = /VERIFICAÇÃO QUE VOCÊ PEDIU/i.test(prompt);

  if (isJudgeRound) {
    return JSON.stringify({
      resposta_final:
        'Resposta simulada do juiz (MOCK_AI=true). Configure as chaves de API no .env ' +
        'para ver o conselho real debatendo.',
      confianca: 72,
      pontos_de_consenso: [
        'Todos os agentes simulados concordam que este é apenas um teste de interface.',
        'O fluxo de rodadas e eventos do WebSocket está funcionando.',
      ],
      pontos_de_discordancia: ['Nenhuma discordância real: as respostas são simuladas.'],
      // Em modo simulado citamos a primeira fonte só para exercitar a UI.
      fontes_usadas: temFontes ? [1] : [],
      ressalvas: 'Nenhuma API de IA foi consultada nesta execução.',
    });
  }

  if (isDebateRound) {
    // Exercita o caminho "agente pede verificação na web" sem gastar modelo real.
    if (podePedirBusca && !jaBuscou) {
      return 'BUSCAR: dados atuais para checar a afirmação do outro conselheiro';
    }

    return [
      'CONCORDÂNCIAS: as respostas simuladas apontam para a mesma direção geral.',
      'DISCORDÂNCIAS: nenhuma.',
      'POSIÇÃO: MANTENHO',
      `RESPOSTA ATUALIZADA: resposta simulada de ${config.name} na rodada de debate ` +
        `(modo demonstração ativo)${jaBuscou ? ', já considerando a verificação [1]' : ''}.`,
    ].join('\n');
  }

  return (
    `Resposta simulada de ${config.name} (${config.role}). ` +
    'O modo demonstração está ligado (MOCK_AI=true), então nenhuma API de IA foi chamada. ' +
    'Preencha as chaves no arquivo .env e coloque MOCK_AI=false para ativar o conselho real.'
  );
}

/**
 * Headers opcionais do OpenRouter. Eles nao sao obrigatorios, mas o OpenRouter
 * usa para atribuir o trafego ao seu app (e aparecer no ranking, se quiser).
 * Ambos saem de variaveis de ambiente — nada sensivel.
 */
function headersOpenRouter() {
  const headers = {};
  const site = process.env.OPENROUTER_SITE_URL || process.env.FRONTEND_URL;
  if (site) headers['HTTP-Referer'] = site.split(',')[0].trim();
  headers['X-Title'] = process.env.OPENROUTER_APP_NAME || 'Conselho de IAs';
  return headers;
}

/** Registro de provedores disponiveis. */
const PROVIDERS = {
  // ---- em uso pelo conselho (ver src/agents.config.js) ----
  groq: callOpenAICompatible,
  google: callGoogle,
  openrouter: (args) => callOpenAICompatible({ ...args, extraHeaders: headersOpenRouter() }),

  // ---- alternativas prontas, caso queira trocar um agente ----
  openai: callOpenAICompatible,
  'openai-compatible': callOpenAICompatible,
  anthropic: callAnthropic,

  // ---- demonstracao sem chave nenhuma ----
  mock: callMock,
};

/**
 * Ponto unico de chamada de modelo.
 *
 * @param {object}  params
 * @param {object}  params.config  entrada do agents.config.js (agente ou juiz)
 * @param {string}  params.system  prompt de sistema (papel/personalidade)
 * @param {string}  params.prompt  mensagem do usuario (pergunta + contexto)
 * @returns {Promise<{text: string, provider: string, model: string, durationMs: number, mocked: boolean}>}
 * @throws {ProviderError} quando falta chave, da timeout ou a API responde erro
 */
export async function callModel({ config, system, prompt }) {
  const startedAt = Date.now();
  const mocked = isMockMode() || config.provider === 'mock';
  const providerName = mocked ? 'mock' : config.provider;
  const handler = PROVIDERS[providerName];

  if (!handler) {
    throw new ProviderError(`Provedor desconhecido: "${config.provider}"`, {
      code: 'unknown_provider',
    });
  }

  // Resolucao da chave e da base URL a partir do ambiente.
  let apiKey = null;
  let baseUrl = null;

  if (!mocked) {
    const keyEnv = config.apiKeyEnv || DEFAULT_KEY_ENV[config.provider];
    apiKey = keyEnv ? process.env[keyEnv] : null;
    if (!apiKey) {
      throw new ProviderError(
        `Chave de API ausente: defina ${keyEnv} no .env (ou use MOCK_AI=true para testar sem chaves)`,
        { code: 'missing_api_key' },
      );
    }

    if (FAMILIA_OPENAI.has(config.provider)) {
      // Ordem de precedencia: baseUrl do agente -> variavel de ambiente -> padrao do provedor.
      baseUrl =
        config.baseUrl ||
        (config.baseUrlEnv ? process.env[config.baseUrlEnv] : null) ||
        DEFAULT_BASE_URL[config.provider];

      if (!baseUrl) {
        throw new ProviderError(
          `Base URL ausente para "${config.provider}": defina "baseUrl" no agente ou ` +
            `${config.baseUrlEnv || 'OPENAI_COMPATIBLE_BASE_URL'} no .env`,
          { code: 'missing_base_url' },
        );
      }
    }
  }

  const maxAttempts = 1 + (config.retries ?? 1);
  /** Teto da espera entre tentativas: limite de tokens por minuto costuma pedir ~20s. */
  const ESPERA_MAXIMA_MS = 32000;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const text = await handler({ config, system, prompt, apiKey, baseUrl });
      return {
        text,
        provider: providerName,
        model: mocked ? 'mock' : config.model,
        durationMs: Date.now() - startedAt,
        mocked,
      };
    } catch (error) {
      lastError = error;
      const retryable = error instanceof ProviderError && error.retryable;
      if (!retryable || attempt === maxAttempts) break;

      // Obedece o tempo que o provedor pediu (429 de tokens por minuto costuma
      // pedir 10-25s); sem sugestão, cai no backoff progressivo.
      const sugerida = error.retryAfterMs;
      // Jitter generoso: dois agentes no mesmo provedor batendo no limite juntos
      // não devem voltar exatamente no mesmo instante e estourar de novo.
      const jitter = 250 + Math.round(Math.random() * (sugerida ? 2500 : 400));
      const espera = Math.min(ESPERA_MAXIMA_MS, (sugerida ?? 800 * attempt) + jitter);

      if (sugerida) {
        console.warn(
          `[${config.name ?? config.model}] limite do provedor: aguardando ` +
            `${(espera / 1000).toFixed(1)}s antes de tentar de novo`,
        );
      }

      await sleep(espera);
    }
  }

  throw lastError ?? new ProviderError('Falha desconhecida ao chamar o modelo');
}
