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
 *  - fallbacks     (array)   MODELOS DE RESERVA, em ordem. Se o primario falhar
 *                            (cota, instabilidade, timeout), o backend tenta o
 *                            proximo automaticamente. Cada reserva herda o que
 *                            nao sobrescrever, MENOS `requestOptions`, que eh
 *                            substituido (tem modelo que recusa parametro do
 *                            outro: o qwen rejeita `reasoning_effort`).
 *
 *                            POR QUE ISSO RESOLVE COTA GRATUITA: no Gemini o
 *                            limite do free tier eh POR MODELO — verificado em
 *                            17/08/2026, com o gemini-3.6-flash em 429 o
 *                            gemini-3.5-flash-lite respondeu 200 no mesmo
 *                            instante. Na Groq o limite de tokens por minuto
 *                            tambem eh por modelo. Trocar de modelo destrava sem
 *                            cartao e sem segunda conta.
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
 * ATENCAO AOS IDS DE MODELO: eles mudam com frequencia (e a Google desativa
 * modelo antigo para conta nova). Se a API responder "model not found" ou
 * "no longer available", rode:
 *
 *     npm run modelos:list
 *
 * Ele lista o que as SUAS chaves podem usar em cada provedor; basta trocar o
 * campo `model` do agente pelo id que aparecer ali.
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
    // Cores alinhadas ao design system do frontend (tinta + latão + sálvia + barro).
    color: '#7fa8c9',
    // Frase curta exibida na apresentação do elenco (o `persona` abaixo é o prompt).
    tagline: 'Duvida de tudo que chega sem evidência.',
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
    // O qwen NAO aceita `reasoning_effort` (responde HTTP 400).
    requestOptions: { tokenParam: 'max_completion_tokens' },
    fallbacks: [
      {
        provider: 'groq',
        model: 'openai/gpt-oss-20b',
        baseUrl: 'https://api.groq.com/openai/v1',
        maxTokens: 1600,
        // gpt-oss eh de raciocinio: precisa de esforco baixo e teto maior.
        requestOptions: {
          tokenParam: 'max_completion_tokens',
          extraBody: { reasoning_effort: 'low' },
        },
      },
      {
        provider: 'openrouter',
        model: 'nvidia/nemotron-3-super-120b-a12b:free',
        apiKeyEnv: 'OPENROUTER_API_KEY',
        baseUrl: 'https://openrouter.ai/api/v1',
        requestOptions: { tokenParam: 'max_tokens' },
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // DEBATEDOR 2 — GPT-OSS 120B via Groq (mesma chave, mesmo endpoint)
  // ---------------------------------------------------------------------------
  {
    id: 'pesquisador',
    name: 'Petra',
    role: 'Pesquisadora',
    avatar: '🔎',
    color: '#74a98f',
    tagline: 'Traz dados, fontes e números para a mesa.',
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
    // gpt-oss eh modelo de raciocinio: parte dos tokens vai para o "pensar",
    // entao o orcamento aqui eh maior que o dos outros agentes — mas nao alto
    // demais, porque o teto pedido conta no limite de tokens por minuto da Groq.
    maxTokens: 1600,
    timeoutMs: 60000,
    retries: 1,
    canUseWebSearch: true,
    enabled: true,
    requestOptions: {
      tokenParam: 'max_completion_tokens',
      // "low" deixa mais tokens para a resposta em si (aceita low|medium|high).
      extraBody: { reasoning_effort: 'low' },
    },
    fallbacks: [
      {
        provider: 'groq',
        model: 'openai/gpt-oss-20b',
        baseUrl: 'https://api.groq.com/openai/v1',
        requestOptions: {
          tokenParam: 'max_completion_tokens',
          extraBody: { reasoning_effort: 'low' },
        },
      },
      {
        provider: 'openrouter',
        model: 'nvidia/nemotron-3-super-120b-a12b:free',
        apiKeyEnv: 'OPENROUTER_API_KEY',
        baseUrl: 'https://openrouter.ai/api/v1',
        requestOptions: { tokenParam: 'max_tokens' },
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // DEBATEDOR 3 — Gemini 2.5 Flash (Google Generative Language API)
  // ---------------------------------------------------------------------------
  {
    id: 'otimista',
    name: 'Otto',
    role: 'Otimista',
    avatar: '🌱',
    color: '#e0a54a',
    tagline: 'Procura o melhor caminho possível sem virar ingênuo.',
    provider: 'google',
    // Verificado contra a API em 16/08/2026. O "gemini-2.5-flash" ainda aparece
    // na listagem, mas o generateContent recusa para contas novas.
    // Alternativas testadas e funcionando: 'gemini-3.7-flash', 'gemini-3.5-flash'
    // e o alias 'gemini-flash-latest' (segue sempre o flash mais novo).
    model: 'gemini-3.6-flash',
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
    /**
     * A cota gratuita do Gemini estoura rapido (limite de requisicoes POR MODELO,
     * e ela e compartilhada entre as duas chamadas de cada debate). As reservas
     * mantêm o Otto no Gemini: só troca a versão do flash, que tem cota propria.
     * Tempos medidos em 17/08/2026: 3.6 ~1,0s | 3.7 ~0,9s | 3.5-lite ~0,7s
     * (o 3.5-flash cheio ficou em 12s, por isso ele nao entra na fila).
     * O 3.5-flash-lite vem primeiro porque, em debate real, o 3.7-flash deu
     * timeout com o prompt cheio da rodada 2 — o lite eh feito para volume.
     */
    fallbacks: [
      { provider: 'google', model: 'gemini-3.5-flash-lite' },
      { provider: 'google', model: 'gemini-3.7-flash' },
      {
        // Ultimo recurso, fora do Google: mantem o conselho de pe.
        provider: 'openrouter',
        model: 'nvidia/nemotron-3-super-120b-a12b:free',
        apiKeyEnv: 'OPENROUTER_API_KEY',
        baseUrl: 'https://openrouter.ai/api/v1',
        requestOptions: { tokenParam: 'max_tokens' },
      },
    ],
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
    color: '#d2694a',
    tagline: 'Ataca a resposta fácil para ver se ela aguenta.',
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
    maxTokens: 2000,
    timeoutMs: 60000,
    retries: 1,
    canUseWebSearch: false,
    enabled: false,
    requestOptions: {
      tokenParam: 'max_completion_tokens',
      extraBody: { reasoning_effort: 'low' },
    },
    fallbacks: [
      {
        provider: 'openrouter',
        model: 'nvidia/nemotron-3-super-120b-a12b:free',
        apiKeyEnv: 'OPENROUTER_API_KEY',
        baseUrl: 'https://openrouter.ai/api/v1',
        requestOptions: { tokenParam: 'max_tokens' },
      },
    ],
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
  color: '#e4d9be',
  tagline: 'Lê o debate inteiro e assina o veredito final.',
  provider: 'openrouter',
  // Slug completo (o curto "nvidia/nemotron-3-ultra:free" NÃO existe na API).
  // Verificado em 16/08/2026: responde e devolve JSON limpo. 1M de contexto.
  // Alternativa mais leve, também gratuita: 'nvidia/nemotron-3-super-120b-a12b:free'.
  model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
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
  /**
   * O juiz eh o unico ponto do debate sem substituto natural, entao a cadeia
   * aqui importa mais. Os dois primeiros ja foram testados devolvendo JSON
   * limpo; o gpt-oss da Groq fecha a fila como terceira opcao.
   */
  fallbacks: [
    { provider: 'openrouter', model: 'nvidia/nemotron-3-super-120b-a12b:free' },
    {
      provider: 'groq',
      model: 'openai/gpt-oss-120b',
      apiKeyEnv: 'GROQ_API_KEY',
      baseUrl: 'https://api.groq.com/openai/v1',
      requestOptions: {
        tokenParam: 'max_completion_tokens',
        extraBody: { reasoning_effort: 'low' },
      },
    },
  ],
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

  /**
   * Busca na web (Tavily). A chave fica em WEB_SEARCH_API_KEY; se ela nao existir,
   * a busca simplesmente nao acontece e o debate roda sem fontes externas.
   *
   *  - maxPerDebate:  teto de chamadas por debate (protege os creditos).
   *                   Pior caso hoje: 1 busca compartilhada na rodada 1 +
   *                   1 por agente na rodada 2.
   *  - maxResults:    resultados por busca (1 a 10).
   *  - depth:         "basic" = 1 credito por busca | "advanced" = 2 creditos,
   *                   com mais contexto por fonte.
   *  - inDebateRound: deixa cada agente pedir UMA verificacao propria na
   *                   rodada 2, escrevendo "BUSCAR: <consulta>".
   */
  search: {
    maxPerDebate: 6,
    maxResults: 5,
    depth: 'basic',
    inDebateRound: true,
    /**
     * Quantas fontes entram no prompt da rodada 2 (com trecho encurtado).
     * Mandar as 5+ fontes inteiras junto com as respostas dos colegas estoura o
     * limite de tokens por minuto da camada gratuita da Groq (8k TPM).
     */
    maxSourcesInDebateRound: 4,
  },

  /**
   * Quantos caracteres de cada resposta alheia sao mostrados na rodada 2.
   * Valor conservador de proposito: e o que mais pesa no prompt da rodada 2 e o
   * que empurra os agentes da Groq contra o limite de tokens por minuto.
   */
  maxPeerAnswerChars: 1400,

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
    tagline: agent.tagline ?? '',
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
