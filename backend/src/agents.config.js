/**
 * ============================================================================
 *  CONFIGURACAO DO CONSELHO  (edite APENAS este arquivo para mudar o debate)
 * ============================================================================
 *
 * Provedores usados neste projeto (todos com camada gratuita):
 *   - Groq       -> https://api.groq.com/openai/v1   (dialeto OpenAI)  GROQ_API_KEY
 *   - Gemini     -> Google Generative Language API                     GEMINI_API_KEY
 *   - OpenRouter -> https://openrouter.ai/api/v1     (dialeto OpenAI)  OPENROUTER_API_KEY
 *
 * NENHUMA CHAVE FICA AQUI. Cada agente aponta apenas o NOME da variavel de
 * ambiente (`apiKeyEnv`) e o backend le com process.env.<NOME> em tempo de
 * execucao (ver src/agents/providers.js).
 *
 * Campos aceitos por agente:
 *  - id            (string)  identificador unico, usado nos eventos do WebSocket
 *  - name          (string)  nome exibido no chat
 *  - role          (string)  papel/personalidade curta (aparece como badge na UI)
 *  - persona       (string)  instrucoes de comportamento enviadas ao modelo
 *  - avatar        (string)  emoji ou 1-2 letras usados no avatar
 *  - color         (string)  cor hex usada na bolha/avatar do frontend
 *  - provider      (string)  "groq" | "google" | "openrouter" | "openai"
 *                            | "openai-compatible" | "anthropic" | "mock"
 *  - model         (string)  id do modelo no provedor
 *  - apiKeyEnv     (string)  NOME da variavel de ambiente com a chave
 *  - baseUrl       (string)  endpoint do provedor (opcional: cada provider tem
 *                            um padrao; URL de endpoint nao eh segredo)
 *  - baseUrlEnv    (string)  alternativa: ler a base URL de uma variavel
 *  - temperature   (number)  criatividade (0 = mais deterministico)
 *  - maxTokens     (number)  tamanho maximo da resposta
 *  - timeoutMs     (number)  tempo maximo de espera antes de considerar falha
 *  - retries       (number)  tentativas extras em erros temporarios (429/5xx)
 *  - canUseWebSearch (bool)  se pode chamar webSearch() quando a pergunta
 *                            depende de dados atuais
 *  - enabled       (bool)    participa ou nao do debate
 *  - requestOptions (obj)    ajustes finos do payload HTTP:
 *                              tokenParam: "max_tokens" | "max_completion_tokens"
 *                              sendTemperature: boolean (alguns modelos de
 *                              raciocinio recusam o parametro temperature)
 *
 * ATENCAO AOS IDS DE MODELO: eles mudam com frequencia. Se a API responder
 * "model not found", liste os modelos disponiveis e troque o campo `model`:
 *   Groq:       curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"
 *   OpenRouter: https://openrouter.ai/models?q=free
 *   Gemini:     https://ai.google.dev/gemini-api/docs/models
 */

/** Agentes que participam das rodadas 1 e 2 do debate. */
export const agents = [
  // ---------------------------------------------------------------------------
  // DEBATEDOR 1 — Qwen via Groq
  // ---------------------------------------------------------------------------
  {
    id: 'cetico',
    name: 'Cassandra',
    role: 'Cética',
    avatar: '🧐',
    color: '#7c9cff',
    provider: 'groq',
    model: 'qwen/qwen3.6-27b',
    apiKeyEnv: 'GROQ_API_KEY',
    baseUrl: 'https://api.groq.com/openai/v1',
    persona: [
      'Você é cética por natureza. Duvida de afirmações sem evidência,',
      'separa fato de opinião e sinaliza claramente o que é incerto.',
      'Prefere dizer "não há dados suficientes" a inventar um número.',
      'Tom: sóbrio, analítico, direto.',
    ].join(' '),
    temperature: 0.3,
    maxTokens: 1200,
    timeoutMs: 60000,
    retries: 1,
    canUseWebSearch: true,
    enabled: true,
    // Groq aceita os dois nomes; "max_completion_tokens" eh o atual.
    requestOptions: { tokenParam: 'max_completion_tokens' },
  },

  // ---------------------------------------------------------------------------
  // DEBATEDOR 2 — GPT-OSS 120B via Groq (mesma chave, mesmo endpoint)
  // ---------------------------------------------------------------------------
  {
    id: 'pesquisador',
    name: 'Petra',
    role: 'Pesquisadora',
    avatar: '🔎',
    color: '#4ecdc4',
    provider: 'groq',
    model: 'openai/gpt-oss-120b',
    apiKeyEnv: 'GROQ_API_KEY',
    baseUrl: 'https://api.groq.com/openai/v1',
    persona: [
      'Você é pesquisadora. Estrutura a resposta em torno de dados, fontes,',
      'números e definições precisas. Quando cita algo, deixa claro de onde veio',
      'e o quão atual é a informação. Quando não tem fonte, admite explicitamente.',
      'Tom: didático, organizado, orientado a evidência.',
    ].join(' '),
    temperature: 0.4,
    maxTokens: 1200,
    timeoutMs: 60000,
    retries: 1,
    canUseWebSearch: true,
    enabled: true,
    requestOptions: { tokenParam: 'max_completion_tokens' },
  },

  // ---------------------------------------------------------------------------
  // DEBATEDOR 3 — Gemini 2.5 Flash (Google Generative Language API)
  // ---------------------------------------------------------------------------
  {
    id: 'otimista',
    name: 'Otto',
    role: 'Otimista',
    avatar: '🌱',
    color: '#ffd166',
    provider: 'google',
    model: 'gemini-2.5-flash',
    apiKeyEnv: 'GEMINI_API_KEY',
    persona: [
      'Você é otimista construtivo. Procura o melhor caminho possível, oportunidades',
      'e soluções práticas. Otimismo aqui não é ingenuidade: você continua honesto',
      'sobre riscos, mas foca em o que dá para fazer com o que se sabe hoje.',
      'Tom: energético, prático, propositivo.',
    ].join(' '),
    temperature: 0.7,
    maxTokens: 1200,
    timeoutMs: 60000,
    retries: 1,
    canUseWebSearch: true,
    enabled: true,
  },

  // ---------------------------------------------------------------------------
  // EXEMPLO de 4o debatedor (desativado). Usa a MESMA chave da Groq, so muda o
  // modelo. Para ativar, troque `enabled` para true.
  // ---------------------------------------------------------------------------
  {
    id: 'advogado-do-diabo',
    name: 'Dante',
    role: 'Advogado do Diabo',
    avatar: '😈',
    color: '#ff6b6b',
    provider: 'groq',
    model: 'openai/gpt-oss-20b',
    apiKeyEnv: 'GROQ_API_KEY',
    baseUrl: 'https://api.groq.com/openai/v1',
    persona: [
      'Você é o advogado do diabo. Sua função é atacar a resposta mais provável:',
      'apontar o cenário em que ela falha, o contra-exemplo, o custo escondido,',
      'a premissa frágil. Você não discorda por esporte: cada objeção precisa ter',
      'um motivo concreto. Tom: provocativo, incisivo, porém honesto.',
    ].join(' '),
    temperature: 0.6,
    maxTokens: 1200,
    timeoutMs: 60000,
    retries: 1,
    canUseWebSearch: false,
    enabled: false,
    requestOptions: { tokenParam: 'max_completion_tokens' },
  },
];

/**
 * JUIZ FINAL (rodada 3) — Nemotron via OpenRouter.
 * Ele nao opina: le todo o debate e consolida o veredito em JSON.
 */
export const judge = {
  id: 'juiz',
  name: 'Juíza Íris',
  role: 'Juíza',
  avatar: '⚖️',
  color: '#9d8cff',
  provider: 'openrouter',
  model: 'nvidia/nemotron-3-ultra:free',
  // Se o OpenRouter responder "model not found", tente o slug completo:
  // 'nvidia/nemotron-3-ultra-550b-a55b:free'
  apiKeyEnv: 'OPENROUTER_API_KEY',
  baseUrl: 'https://openrouter.ai/api/v1',
  persona: [
    'Você é a juíza do conselho. Não defende nenhuma posição própria:',
    'sua função é ler todo o debate e consolidar o que ficou estabelecido,',
    'com honestidade sobre o que permaneceu em disputa.',
  ].join(' '),
  temperature: 0.2,
  maxTokens: 2000,
  timeoutMs: 90000,
  retries: 1,
  enabled: true,
};

/** Parametros gerais da orquestracao do debate. */
export const debateSettings = {
  /** Rotulos das rodadas (aparecem como divisores na UI). */
  rounds: {
    1: { key: 'respostas', label: 'Rodada 1 — Respostas independentes' },
    2: { key: 'debate', label: 'Rodada 2 — Debate cruzado' },
    3: { key: 'veredito', label: 'Rodada 3 — Veredito' },
  },

  /**
   * Atraso entre o disparo de cada agente (ms). Os agentes rodam em paralelo,
   * mas o pequeno escalonamento faz os indicadores de "digitando..." aparecerem
   * um depois do outro, dando sensacao de debate ao vivo — e ajuda a nao estourar
   * o limite de requisicoes por minuto das camadas gratuitas.
   */
  staggerMs: 600,

  /** Se true, a rodada 2 acontece. Se false, o juiz julga apenas a rodada 1. */
  enableDebateRound: true,

  /** Minimo de agentes que precisam responder para o debate continuar. */
  minAgentsToContinue: 1,

  /** Quantos caracteres de cada resposta alheia sao mostrados na rodada 2. */
  maxPeerAnswerChars: 2500,

  /** Idioma das respostas dos agentes. */
  language: 'português do Brasil',
};

// ---------------------------------------------------------------------------
// Helpers de leitura da configuracao (evitam repetir filtros pelo codigo)
// ---------------------------------------------------------------------------

/** Retorna apenas os agentes habilitados. */
export function getActiveAgents() {
  return agents.filter((agent) => agent.enabled !== false);
}

/**
 * Versao "publica" de um agente: apenas o que o frontend precisa para desenhar
 * o chat. Nunca inclui nome de variavel de ambiente, chave ou endpoint.
 */
export function toPublicAgent(agent) {
  return {
    id: agent.id,
    name: agent.name,
    role: agent.role,
    avatar: agent.avatar,
    color: agent.color,
    provider: agent.provider,
    model: agent.model,
  };
}

/** Lista publica de agentes + juiz, usada em GET /api/agents. */
export function getPublicRoster() {
  return {
    agents: getActiveAgents().map(toPublicAgent),
    judge: toPublicAgent(judge),
    rounds: debateSettings.rounds,
  };
}
