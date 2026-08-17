# ⚖️ Conselho de IAs

Um site onde **várias IAs debatem entre si em tempo real** até chegar a uma resposta final
consolidada, com nível de confiança, pontos de consenso e divergências que ficaram abertas.

O debate acontece em três rodadas:

| Rodada | O que acontece | Evento WebSocket |
| ------ | -------------- | ---------------- |
| 1 | Cada agente responde sozinho, sem ver os outros. Se a pergunta depender de dado atual, todos recebem as mesmas fontes de uma busca na web (Tavily) | `agent_response` |
| 2 | Cada agente lê as respostas alheias, aponta concordâncias, contesta discordâncias e mantém ou revisa a própria posição. Pode pedir **uma** busca na web para checar o que o outro afirmou | `agent_debate`, `web_search` |
| 3 | Um agente juiz lê todo o histórico e emite o veredito: resposta final, confiança de 0 a 100%, consenso, divergências e **as fontes usadas** | `final_verdict` |

Tudo é transmitido mensagem por mensagem pelo Socket.IO, com indicador de "digitando…" por
agente, barra de confiança animada e histórico persistido para revisitar debates antigos.

---

## Stack

| Camada | Tecnologia | Deploy |
| ------ | ---------- | ------ |
| Backend | Node.js + Express + Socket.IO (ESM, sem SDKs de IA — só `fetch`) | SquareCloud |
| Frontend | React 18 + Vite + React Router + socket.io-client | Netlify |
| Persistência | Arquivo JSON local (`backend/data/debates.json`) | — |
| IAs | Groq + Google Gemini + OpenRouter (todas com camada gratuita) | — |

Dependências do backend: `express`, `cors`, `socket.io`, `dotenv`. Nada nativo, nada pago.

As três APIs são chamadas via `fetch` nativo, sem SDK: Groq e OpenRouter falam o dialeto
`/chat/completions` da OpenAI e o Gemini usa a Generative Language API. Menos dependência para
instalar, atualizar e quebrar no deploy.

---

## Estrutura

```
/backend
  /scripts
    smoke-debate.js       # roda um debate no terminal (sem HTTP)
  /src
    /agents
      providers.js        # chamadas HTTP para Groq / Gemini / OpenRouter (+ mock e alternativas)
      prompts.js          # todos os prompts das 3 rodadas
      parsers.js          # extrai posição, concordâncias e o JSON do juiz
      confidence.js       # confiança provisória (heurística) durante o debate
      orchestrator.js     # as 3 rodadas + tolerância a falhas
      debateRunner.js     # cria o debate e roda em segundo plano
      webSearch.js        # busca na web via Tavily (+ heurística de "precisa de dado atual?")
    /routes
      index.js            # /api/health, /api/agents
      debate.routes.js    # POST /debate, GET /debate/:id, DELETE /debate/:id, GET /history
    /sockets
      index.js            # salas por debate, snapshot ao entrar, emissor de eventos
    /db
      index.js            # persistência JSON (escrita atômica + poda do histórico)
    /utils
      httpError.js
      middleware.js       # token opcional, rate limit, handler de erros
    agents.config.js      # ⭐ o único arquivo que você precisa editar para mudar o conselho
    server.js
  squarecloud.config
  .env.example
  package.json

/frontend
  /src
    /components           # ChatBubble, ConfidenceBar, AgentAvatar, DebateRoom, TypingIndicator,
                          # FinalVerdict, RoundDivider, Sidebar, QuestionForm, AgentRoster
    /pages                # Home, Debate, History
    /services             # api.js (REST) e socket.js (WebSocket)
    /hooks                # useDebateStream, useDebateHistory, useBackendStatus
    /utils                # format.jsx (mini markdown), time.js
    App.jsx
    main.jsx
    index.css
  netlify.toml
  .env.example
  package.json
```

---

## Rodando localmente

Requisito: **Node.js 20 ou superior** (usa `fetch` nativo e `--watch`).

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # no Windows/PowerShell: Copy-Item .env.example .env
npm run dev               # http://localhost:3000
```

Quer ver o site funcionando **antes** de ter chaves de API? Coloque no `.env`:

```
MOCK_AI=true
```

Nesse modo nenhuma API externa é chamada: os agentes devolvem respostas simuladas, e todo o
fluxo (rodadas, digitando…, veredito, histórico) funciona igual.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env      # no Windows/PowerShell: Copy-Item .env.example .env
npm run dev               # http://localhost:5173
```

O `.env` do frontend só precisa de:

```
VITE_BACKEND_URL=http://localhost:3000
```

### 3. Conferir as chaves e testar o debate pelo terminal

```bash
cd backend
npm run providers:check                       # valida GROQ / GEMINI / OPENROUTER, um agente por vez
npm run modelos:list                          # lista os modelos que suas chaves podem usar
npm run busca:check                           # valida a chave da Tavily com 1 busca real
npm run debate:teste                          # debate completo em modo simulado
npm run debate:teste -- --real "sua pergunta" # debate usando as APIs reais do .env
```

`providers:check` faz uma chamada mínima por agente e diz exatamente o que falta (variável não
definida, chave inválida ou id de modelo errado). Ele nunca imprime o valor da chave, só o nome
da variável.

---

## Interface e design system

A identidade é a de uma **câmara de conselho**, não de dashboard de IA: tinta esverdeada
profunda como a sala, latão/âmbar como a autoridade (a balança), sálvia para consenso e barro
para divergência. Dark mode é o padrão.

Tudo está declarado em `frontend/src/styles/tokens.css` — trocar a paleta, a escala tipográfica
ou os raios de borda do produto inteiro é mexer nesse arquivo.

| Camada | Escolha |
| ------ | ------- |
| Superfícies | `--ink-900` a `--ink-500` (tinta esverdeada) |
| Acentos | `--brass` `#e0a54a`, `--sage` `#74a98f`, `--clay` `#d2694a`, `--ivory` `#e4d9be` |
| Títulos | **Fraunces** (serifada com personalidade) |
| Corpo | **Outfit** (sans geométrica) |
| Números e rótulos | **JetBrains Mono** |
| Motion | entradas `rise-in`/`fade-in` com `--ease-out`, sempre respeitando `prefers-reduced-motion` |

As cores dos agentes fazem parte do sistema: ficam em `agents.config.js` (backend) e são
consumidas como `--agent-color` nas bolhas, avatares e nomes — por isso foram harmonizadas com a
paleta (aço, sálvia, latão, barro; a juíza em marfim).

### A tela de debate: uma coisa de cada vez

O problema do layout antigo era o despejo de informação: três respostas caindo juntas. Agora a
timeline passa por uma **fila de apresentação** (`useSequentialReveal`), que revela um item por
vez com intervalo — mais longo nos marcadores de rodada, mais curto quando a fila acumula.
Enquanto a fila não esvazia, o "está pensando" e o veredito ficam escondidos, então o usuário
sempre acompanha o ritmo.

Debate antigo aberto pelo histórico aparece na hora: cada item vem marcado com `fromSnapshot` e
a encenação é ignorada — ninguém quer esperar 40 segundos para reler algo.

Outras peças do redesign:

- **`RoundDivider`** virou marcador de capítulo (linha, losango de latão, número em mono, nome da
  etapa e uma linha explicando o que acontece ali) com respiro generoso entre rodadas.
- **`ConfidenceMeter`** substituiu a barra genérica: anel que preenche, cor migrando de barro
  para sálvia conforme a convicção sobe, e marcas mostrando a evolução ao longo do debate.
- **`FinalVerdict`** não é bolha de chat: é documento, com fio de latão no topo, resposta em
  serifada maior, mostrador grande, consenso/divergências em colunas e as fontes clicáveis.
- **`DebateSkeleton`** cobre a espera da primeira resposta usando os avatares reais dos
  conselheiros em vez de retângulos cinzas.
- **Histórico** virou lista de conversas (pergunta, prévia da resposta final, tempo relativo,
  confiança) com exclusão que remove na hora e só chama o `DELETE` no fim da janela de
  "Desfazer" — o desfazer é real, não teatro.

---

## Configuração das chaves de API (obrigatório para rodar)

O projeto usa **três provedores, todos com camada gratuita**:

| Onde é usado | Modelo | Provedor | Variável de ambiente |
| ------------ | ------ | -------- | -------------------- |
| Debatedor 1 (Cassandra 🧐, Cética) | `qwen/qwen3.6-27b` | Groq | `GROQ_API_KEY` |
| Debatedor 2 (Petra 🔎, Pesquisadora) | `openai/gpt-oss-120b` | Groq (mesma chave) | `GROQ_API_KEY` |
| Debatedor 3 (Otto 🌱, Otimista) | `gemini-3.6-flash` | Google Gemini | `GEMINI_API_KEY` |
| Juiz final (Juíza Íris ⚖️) | `nvidia/nemotron-3-ultra-550b-a55b:free` | OpenRouter | `OPENROUTER_API_KEY` |

**Nenhuma chave existe no código.** Os agentes guardam apenas o *nome* da variável (`apiKeyEnv`)
e o backend lê com `process.env.NOME_DA_VARIAVEL` na hora da chamada. O frontend nunca vê
chave nenhuma: ele só conversa com o seu backend.

### 1. Local — copie o `.env.example` e preencha

```bash
cd backend
cp .env.example .env        # Windows/PowerShell: Copy-Item .env.example .env
```

Abra `backend/.env` e preencha:

```env
GROQ_API_KEY=
GEMINI_API_KEY=
OPENROUTER_API_KEY=
FRONTEND_URL=http://localhost:5173
MOCK_AI=false

# opcional, mas é o que dá dados atuais ao conselho
WEB_SEARCH_PROVIDER=tavily
WEB_SEARCH_API_KEY=
```

Onde pegar cada chave (todas gratuitas, cadastro de ~1 minuto):

| Chave | Link | Obrigatória? |
| ----- | ---- | ------------ |
| `GROQ_API_KEY` | <https://console.groq.com/keys> | sim (2 debatedores) |
| `GEMINI_API_KEY` | <https://aistudio.google.com/app/apikey> | sim (1 debatedor) |
| `OPENROUTER_API_KEY` | <https://openrouter.ai/keys> | sim (juiz) |
| `WEB_SEARCH_API_KEY` | <https://app.tavily.com> | não — sem ela o debate roda sem busca na web |

O `.env` está no `.gitignore` (junto com `.env.*`), então ele nunca vai para o repositório.
Quer testar a interface antes de ter as chaves? Use `MOCK_AI=true` que o fluxo inteiro funciona
com respostas simuladas.

### 2. Produção (backend) — painel da SquareCloud

As mesmas variáveis vão no **painel de variáveis de ambiente do app**, nunca no código nem no
zip do deploy:

```
GROQ_API_KEY=...
GEMINI_API_KEY=...
OPENROUTER_API_KEY=...
WEB_SEARCH_PROVIDER=tavily
WEB_SEARCH_API_KEY=tvly-...
FRONTEND_URL=https://seu-site.netlify.app
PORT=80
MOCK_AI=false
```

`PORT=80` é obrigatório na SquareCloud (é a porta do balanceador deles).

### 3. Produção (frontend) — painel da Netlify

Em *Site configuration → Environment variables*, só uma variável:

```
VITE_BACKEND_URL=https://<seu-subdominio>.squareweb.app
```

Aponta para a URL pública do backend na SquareCloud, sem barra no final. Nunca coloque chave de
IA em variável `VITE_*` — tudo que começa com `VITE_` vai para o navegador.

### Se algum agente falhar

Se a chave de um agente estiver ausente ou inválida, **só aquele agente falha**: o debate segue
com os demais e a interface mostra "não respondeu" na bolha dele. Duas mensagens de erro comuns:

- `está sem chave de API configurada` → falta a variável no `.env`/painel.
- `[openrouter] HTTP 401: Missing Authentication header` → apesar do texto, quase sempre é
  **formato de chave inválido**: a chave do OpenRouter começa com `sk-or-v1-`. Com o formato
  certo e chave inexistente a mensagem muda para `User not found.`.
- **Id de modelo inválido** — o erro mais comum, porque os provedores trocam e aposentam modelos
  sem aviso. Sintomas reais já vistos neste projeto:
  - `[google] HTTP 404: This model models/gemini-2.5-flash is no longer available to new users`
  - `[openrouter] HTTP 400: nvidia/nemotron-3-ultra:free is not a valid model ID`

  Nos dois casos, rode:

  ```bash
  cd backend
  npm run modelos:list          # lista o que suas chaves podem usar e marca ❌ o que está errado
  npm run modelos:list -- flash # filtra por pedaço do nome
  ```

  Depois troque o campo `model` do agente em `agents.config.js` pelo id que apareceu.
  Atenção: no Gemini, aparecer na listagem **não** garante acesso — modelos antigos ficam
  visíveis mas recusam contas novas. O `providers:check` é quem dá a palavra final.
- `resposta vazia: o modelo gastou os N tokens raciocinando` → modelo de raciocínio (os `gpt-oss`
  da Groq, o-series, Nemotron) consumiu o orçamento pensando e devolveu conteúdo vazio. Aumente
  `maxTokens` do agente ou use `requestOptions.extraBody = { reasoning_effort: 'low' }` — é assim
  que a Petra está configurada.
- **Modelo despejando o "pensamento" na resposta** (bloco `<think>` em inglês, ou o veredito
  vindo como rascunho mental em vez de JSON). Foi o que aconteceu em produção; a defesa hoje é em
  três camadas, e cada parâmetro abaixo foi testado contra a API real em 17/08/2026:

  | Modelo | Parâmetro | Efeito verificado |
  | ------ | --------- | ----------------- |
  | Groq `qwen` | `reasoning_effort: 'none'` | elimina o `<think>`; com `default` ele vaza. Só aceita `none`/`default` — `low` dá HTTP 400 |
  | OpenRouter `nemotron` (juíza) | `response_format: { type: 'json_object' }` + `reasoning: { enabled: false }` | JSON garantido. Cuidado: `reasoning: { exclude: true }` devolveu conteúdo **vazio** |
  | Gemini 3.x | nada — só `maxTokens` folgado | `thinkingConfig.thinkingBudget: 0` é recusado (HTTP 400) por parte dos modelos |

  Camada 2: `limparRaciocinio()` em `providers.js` remove `<think>`, `<thinking>`, `<reasoning>` e
  `<reflection>` de qualquer resposta. Se a tag abrir e não fechar, o texto inteiro é considerado
  rascunho e vira nova tentativa — melhor repetir que mostrar o rascunho.

  Camada 3: o juiz passa um `validate` ao `callModel`. Veredito que não seja JSON válido com
  resposta utilizável conta como falha do provedor e aciona a cadeia de reserva.
- **Resposta cortada no meio da frase** → os Gemini 3.x gastam parte do `maxOutputTokens`
  "pensando", então o teto estoura antes do texto terminar. O backend agora detecta
  `finishReason: MAX_TOKENS` (e `finish_reason: length` nos endpoints estilo OpenAI) e repete com o
  dobro do orçamento, em vez de entregar a frase pela metade. O Otto roda com `maxTokens: 2600`
  por causa disso.

> Nota sobre o juiz: o slug curto `nvidia/nemotron-3-ultra:free` deve resolver no OpenRouter,
> mas se ele reclamar, use o slug completo `nvidia/nemotron-3-ultra-550b-a55b:free` (está
> comentado no `agents.config.js`, ao lado do campo `model`).

### Cota gratuita e modelos de reserva

Cada debate faz `2 × nº de debatedores + 1` chamadas de modelo (7 com os 3 debatedores padrão),
mais uma por agente que pedir verificação na rodada 2. As camadas gratuitas são apertadas: a Groq
limita **tokens por minuto por modelo** (8k) e o Gemini limita **requisições por modelo**
(estourou com 20 no `gemini-3.6-flash`, pedindo 50s de espera).

A saída não é trocar de plano: é **cadeia de reserva**. Cada agente tem uma lista `fallbacks` e,
quando o modelo primário responde 429/5xx/timeout, o backend passa para o próximo na hora.

> **Por que funciona:** a cota do free tier é *por modelo*. Verificado em 17/08/2026 — com o
> `gemini-3.6-flash` retornando 429, o `gemini-3.5-flash-lite` respondeu 200 no mesmo instante.
> O mesmo vale para o limite de tokens por minuto da Groq. Trocar de modelo destrava sem cartão
> e sem segunda conta.

As cadeias configuradas (todas com os ids validados por `npm run modelos:list`):

| Agente | Primário | Reservas, em ordem |
| ------ | -------- | ------------------ |
| Cassandra 🧐 | Groq `qwen/qwen3.6-27b` | Groq `gpt-oss-20b` → OpenRouter `nemotron-3-super-120b-a12b:free` |
| Petra 🔎 | Groq `gpt-oss-120b` | Groq `gpt-oss-20b` → OpenRouter `nemotron-3-super…` |
| Otto 🌱 | Gemini `gemini-3.6-flash` | Gemini `3.5-flash-lite` → Gemini `3.7-flash` → OpenRouter `nemotron-3-super…` |
| Juíza Íris ⚖️ | OpenRouter `nemotron-3-ultra-550b-a55b:free` | OpenRouter `nemotron-3-super…` → Groq `gpt-oss-120b` |

Política de espera, em `providers.js`:

- provedor pede **até 8s** → espera e repete o mesmo modelo;
- pede mais que isso e existe reserva → **troca na hora** (quem espera é o usuário);
- pede mais que isso e não existe reserva → espera o tempo pedido, com teto de 60s.

Quando uma reserva responde, a fala aparece na interface com a etiqueta **modelo reserva** e o
nome real do modelo que respondeu — nada de fingir que foi o primário.

Detalhe importante ao editar as cadeias: a reserva herda os campos que não sobrescrever
(`temperature`, `maxTokens`, `timeoutMs`), **menos `requestOptions`**, que é substituído. Isso é
proposital: o `qwen` responde HTTP 400 se receber o `reasoning_effort` que o `gpt-oss` exige.

Para reduzir o consumo: aumente `staggerMs`, baixe `search.maxSourcesInDebateRound` ou desligue a
rodada 2 (`enableDebateRound: false`) em `debateSettings`.

---

## Configurando o conselho

Tudo em um único arquivo: `backend/src/agents.config.js`.

```js
{
  id: 'cetico',                  // id usado nos eventos do WebSocket
  name: 'Cassandra',             // nome no chat
  role: 'Cética',                // badge exibido na bolha
  avatar: '🧐',                  // emoji do avatar
  color: '#7c9cff',              // cor da bolha/avatar no frontend
  provider: 'groq',              // groq | google | openrouter | openai | openai-compatible | anthropic | mock
  model: 'qwen/qwen3.6-27b',
  apiKeyEnv: 'GROQ_API_KEY',     // só o NOME da variável, nunca o valor
  baseUrl: 'https://api.groq.com/openai/v1',
  persona: 'Você é cética por natureza...',  // vai para o prompt de sistema
  temperature: 0.3,
  maxTokens: 1200,
  timeoutMs: 60000,              // depois disso o agente é marcado como falho
  retries: 1,                    // tentativas extras em erro 429/5xx
  canUseWebSearch: true,
  enabled: true,                 // false = fica de fora do debate
  requestOptions: { tokenParam: 'max_completion_tokens' },
}
```

O conselho que vem configurado:

| Agente | Papel | Provedor / modelo |
| ------ | ----- | ----------------- |
| Cassandra 🧐 | Cética | Groq · `qwen/qwen3.6-27b` |
| Petra 🔎 | Pesquisadora | Groq · `openai/gpt-oss-120b` |
| Otto 🌱 | Otimista | Gemini · `gemini-3.6-flash` |
| Dante 😈 | Advogado do Diabo (**desativado** — exemplo de 4º debatedor) | Groq · `openai/gpt-oss-20b` |
| Juíza Íris ⚖️ | Juíza (rodada 3) | OpenRouter · `nvidia/nemotron-3-ultra-550b-a55b:free` |

Adicionar um agente = copiar um bloco e ajustar (ou só trocar `enabled: false` para `true` no
Dante). Nada mais precisa ser mexido: o frontend lê o conselho de `GET /api/agents` e desenha os
avatares sozinho.

Trocar de provedor é trocar três campos: `provider`, `model` e `apiKeyEnv` (mais `baseUrl`, se o
provedor não tiver padrão embutido). Já vêm implementados: `groq`, `google`, `openrouter`,
`openai`, `openai-compatible` (qualquer endpoint no dialeto da OpenAI), `anthropic` e `mock`.

Outros ajustes em `debateSettings`, no mesmo arquivo:

- `staggerMs` — atraso entre os agentes (o que faz os "digitando…" aparecerem em sequência)
- `enableDebateRound` — desliga a rodada 2 se quiser um fluxo mais curto/barato
- `maxPeerAnswerChars` — quanto de cada resposta alheia entra no prompt da rodada 2

---

## API

| Método | Rota | O que faz |
| ------ | ---- | --------- |
| `GET` | `/api/health` | status, modo simulado, se a busca web está ligada |
| `GET` | `/api/agents` | conselho configurado (sem nada sensível) |
| `POST` | `/api/debate` | `{ "question": "..." }` → cria o debate e responde na hora com o `id` |
| `GET` | `/api/debate/:id` | debate completo, com todos os eventos (permite reconstruir a tela) |
| `DELETE` | `/api/debate/:id` | apaga do histórico |
| `GET` | `/api/history?limit=50` | resumos dos debates anteriores |

### Eventos do WebSocket

Cliente envia: `join_debate <debateId>` (e recebe `debate_snapshot` com tudo que já aconteceu),
`leave_debate <debateId>`.

Servidor envia: `debate_started`, `round_started`, `search_note`, `web_search`, `agent_typing`,
`agent_response`, `agent_debate`, `agent_error`, `confidence_update`, `final_verdict`,
`debate_completed`, `debate_error`, `debate_not_found`.

`web_search` traz `{ agentId, round, shared, cached, query, results: [{ n, title, url, source,
publishedAt }] }` — `agentId: null` significa a busca compartilhada da rodada 1.

Todo evento persistido tem um `seq` incremental — é isso que permite recarregar a página no meio
do debate sem duplicar mensagens.

---

## Deploy do backend na SquareCloud

### Deploy automático pelo GitHub (o caminho usado hoje)

Na aba **Deploys** do app, com a integração do GitHub ligada em *Automático*, todo push na `main`
dispara um deploy.

> **Detalhe que já causou problema aqui:** a integração envia o **repositório inteiro** — não
> existe opção de escolher a subpasta `backend`. Por isso a **raiz** do repositório é que precisa
> ser um app válido, e é o `squarecloud.config` da raiz que vale:
>
> ```
> MAIN=backend/src/server.js
> RUNTIME=nodejs
> VERSION=recommended
> MEMORY=512
> AUTORESTART=true
> START=npm start
> SUBDOMAIN=conselho-de-ias
> ```
>
> O `package.json` da raiz declara as dependências do backend (o `npm install` roda na raiz do
> app) e o `start` executa `node backend/src/server.js`. O Node resolve os imports de
> `backend/src` subindo os diretórios, então os pacotes instalados na raiz atendem o backend.
>
> Se você criou o app antes com um zip da pasta `backend`, o container ainda tem um `src/` antigo
> na raiz: os deploys do GitHub davam "Success", o app reiniciava e continuava rodando o código
> velho. Com a config da raiz apontando para `backend/src/server.js`, isso deixa de acontecer —
> mas vale limpar os arquivos órfãos (`src/` na raiz do container) pelo painel uma vez.

Para conferir se o deploy realmente entrou em vigor, não confie no restart: compare os modelos.

```bash
curl https://<subdominio>.squareweb.app/api/agents
```

### Alternativa: zip manual (sem GitHub)

Compacte **o conteúdo da pasta `backend`** (o `backend/squarecloud.config`, que aponta para
`src/server.js`, e o `package.json` na raiz do zip), sem `node_modules`, sem `.env` e sem `data/`.
No Windows, gere o zip pela API do .NET e não com `Compress-Archive`: o cmdlet grava os caminhos
com barra invertida e o Linux da SquareCloud extrai tudo como arquivo solto, fazendo o `MAIN` não
ser encontrado.

### Variáveis de ambiente (nos dois casos)

Configure no painel do app — **as chaves ficam aqui, nunca no código nem no repositório**:

   ```
   GROQ_API_KEY=...
   GEMINI_API_KEY=...
   OPENROUTER_API_KEY=...
   WEB_SEARCH_PROVIDER=tavily
   WEB_SEARCH_API_KEY=tvly-...
   FRONTEND_URL=https://seu-site.netlify.app
   PORT=80
   MOCK_AI=false
   ```

   > **`PORT=80` é obrigatório**: o balanceador da SquareCloud roteia o tráfego web pela porta 80.

Depois confira `https://<subdominio>.squareweb.app/api/health` (deve trazer `mockMode: false` e
`webSearchImplemented: true`).

O histórico fica em `data/debates.json` **relativo ao diretório de execução** — na SquareCloud,
a raiz do app. Ele sobrevive a restarts e a deploys, mas some se você apagar/recriar a aplicação;
baixe o arquivo pelo painel se quiser guardar.

---

## Deploy do frontend na Netlify

1. Conecte o repositório na Netlify e configure:

   - **Base directory**: `frontend`
   - **Build command**: `npm run build` (já vem do `netlify.toml`)
   - **Publish directory**: `dist` (idem)

2. Em *Site configuration → Environment variables*, adicione:

   ```
   VITE_BACKEND_URL=https://<subdominio>.squareweb.app
   ```

   (sem barra no final). Se você usar o token opcional, adicione também `VITE_API_TOKEN`.

3. Faça o deploy. O `netlify.toml` já cuida do redirect de SPA (`/*` → `/index.html`), então
   rotas como `/debate/<id>` funcionam ao recarregar a página.

4. Volte na SquareCloud e coloque a URL final da Netlify em `FRONTEND_URL` (é o que o CORS
   libera). Aceita várias origens separadas por vírgula, por exemplo:
   `https://seu-site.netlify.app,http://localhost:5173`.

Deploy manual, sem Git: `cd frontend && npm run build` e arraste a pasta `dist` para a Netlify —
nesse caso passe a URL do backend na hora do build (`VITE_BACKEND_URL=... npm run build`).

---

## Busca na web (Tavily) — dados atuais no debate

Implementada em `backend/src/agents/webSearch.js`. Sem ela o conselho responde apenas com o
conhecimento treinado dos modelos; com ela, as respostas passam a ter fonte verificável.

### Ligando

1. Pegue a chave gratuita em <https://app.tavily.com> (1.000 créditos/mês, sem cartão).
2. No `backend/.env`:

   ```env
   WEB_SEARCH_PROVIDER=tavily
   WEB_SEARCH_API_KEY=tvly-...
   WEB_SEARCH_DEPTH=basic          # basic = 1 crédito | advanced = 2 créditos
   WEB_SEARCH_TIMEOUT_MS=15000
   ```

3. Confirme com uma busca real (custa 1 crédito):

   ```bash
   cd backend
   npm run busca:check
   npm run busca:check -- "cotação do dólar hoje"
   ```

Se `WEB_SEARCH_API_KEY` ficar vazia, nada quebra: o debate roda sem fontes e a interface avisa
"a busca na web está desligada".

### Como a busca entra no debate

**Rodada 1 — busca compartilhada.** Se `needsFreshData(question)` detectar que a pergunta
depende de dado atual (palavras como "hoje", "atual", "preço", "última versão", ano recente),
o backend faz **uma** busca e entrega as mesmas fontes a todos os agentes com
`canUseWebSearch: true`. Uma busca, um crédito, todos com a mesma base — a divergência que
sobrar é de interpretação, não de fonte.

**Rodada 2 — verificação por agente.** Cada agente pode pedir **uma** checagem própria
escrevendo `BUSCAR: <consulta>` na primeira linha. O backend executa, devolve o resultado e
chama o modelo de novo com os dados em mão. É isso que permite contestar o colega com evidência
nova em vez de só opinião.

**Rodada 3 — fontes no veredito.** Todas as fontes do debate entram em um registro numerado
(`[1]`, `[2]`…) compartilhado por agentes, juiz e interface. O juiz devolve `fontes_usadas: [1, 3]`
no JSON, o backend resolve esses números nas fontes reais (número inventado é descartado) e a UI
mostra os links no cartão da Resposta Final. Se o juiz não citar nada e houver busca, a UI mostra
as fontes consultadas com o rótulo correspondente.

Cada busca aparece na tela como um cartão 🔎 com a consulta e os links numerados, tanto na
compartilhada quanto nas verificações de cada agente.

### Controle de gasto

Configurável em `debateSettings.search`, em `backend/src/agents.config.js`:

```js
search: {
  maxPerDebate: 6,      // teto de chamadas por debate
  maxResults: 5,        // resultados por busca
  depth: 'basic',       // 'basic' = 1 crédito | 'advanced' = 2
  inDebateRound: true,  // permite o "BUSCAR:" na rodada 2
}
```

Além do teto, há cache por consulta dentro do debate: se dois agentes pedirem a mesma coisa, a
segunda vem do cache (o evento aparece com a marca `reaproveitada` e não gasta crédito). Pior
caso com os 3 debatedores padrão: 1 busca na rodada 1 + 3 na rodada 2 = **4 créditos por debate**;
na prática costuma ser menos. Para desligar só a rodada 2, use `inDebateRound: false`.

### Trocando de provedor

O contrato de retorno é o único acoplamento:

```js
{ implemented: true, query, provider: 'tavily', results: [{ title, url, snippet, publishedAt, source }] }
```

Para usar Brave, Serper, Exa ou SearXNG, troque só o corpo do `fetch` em `webSearch.js`
mantendo esse formato. E qualquer falha (chave inválida, 429, timeout, rede) deve continuar
voltando como `{ implemented: false, results: [] }` — é assim que o orquestrador segue o debate
sem quebrar.

---

## Notas de segurança

- As chaves de IA (`GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`) existem **somente** no
  backend, sempre lidas de `process.env`. Nenhuma aparece hardcoded em arquivo nenhum, e nada de
  `VITE_*` com chave de provedor — variável `VITE_*` é enviada para o navegador.
- A API **não tem autenticação de usuário** (é uso pessoal, como pedido). Como a URL fica
  pública, existem duas travas embutidas:
  - `API_TOKEN` no backend + `VITE_API_TOKEN` no frontend: se preenchido, REST e WebSocket
    passam a exigir esse token. Se vazio, a API fica aberta para qualquer um que descobrir a URL.
  - rate limit em memória: 120 requisições/min por IP na API e 10/min para criar debates.
- `MAX_CONCURRENT_DEBATES` (padrão 3) limita quantos debates rodam ao mesmo tempo, o que segura
  o consumo das cotas gratuitas.
- Cada debate faz `2 × nº de debatedores + 1` chamadas de modelo (7 com os 3 debatedores padrão),
  mais 1 chamada extra por agente que pedir verificação na rodada 2, e até 4 buscas na Tavily.
  Tudo dentro das camadas gratuitas para uso pessoal, mas as cotas da Groq e do OpenRouter são
  por minuto/dia e a da Tavily é por mês — vale evitar deixar o link circulando sem `API_TOKEN`.
- As URLs que a Tavily devolve são conteúdo de terceiros: os links do veredito abrem com
  `rel="noopener noreferrer"` e nada do que volta da busca é executado, apenas exibido como texto.

---

## O que já foi verificado

- `npm install` e boot do backend com debate completo de ponta a ponta em modo simulado
  (REST + WebSocket): 18 eventos persistidos, veredito salvo, histórico funcionando.
- Cliente WebSocket real: `join_debate` → `debate_snapshot` → `agent_typing` → `agent_response`
  → `agent_debate` → `confidence_update` (10% → 60% → 85% → 72%) → `final_verdict` →
  `debate_completed`.
- Caminho de falha: sem chaves, cada agente emite `agent_error` individualmente e o debate
  termina com mensagem clara em vez de derrubar o servidor.
- `npm run build` do frontend e renderização das quatro rotas (`/`, `/debate/:id`, `/history`,
  rota inexistente) sem erro de runtime.
- Endpoints dos 3 provedores, com chave falsa de propósito, para validar URL e formato da
  requisição: Groq respondeu `401 Invalid API Key`, Gemini `400 API key not valid` e OpenRouter
  `401` — ou seja, as três requisições chegam corretamente e só a credencial é recusada.
- Busca na web (Tavily) com a API dublada: debate inteiro com 1 busca compartilhada na rodada 1,
  3 pedidos de verificação na rodada 2 resolvidos com **2 chamadas reais** (as outras vieram do
  cache), `search_depth: basic` e `max_results: 5` no corpo enviado, fontes numeradas [1]/[2]
  chegando aos prompts e o juiz citando `fontes_usadas: [1]` — que a UI renderizou como link.
- Erros da busca: sem chave, chave inválida no endpoint real (HTTP 401) e timeout — os três
  voltam como `{ implemented: false, results: [] }` e o debate segue até o veredito.
- Componentes novos renderizados fora do navegador: cartão de busca com resultados, cartão de
  busca com erro, veredito com fontes citadas, veredito com fontes do registro e veredito sem
  fonte (seção escondida).

### Com as chaves reais (16/08/2026)

- `providers:check`: os 4 agentes respondendo — Groq (`qwen/qwen3.6-27b` e `openai/gpt-oss-120b`),
  Gemini (`gemini-3.6-flash`) e OpenRouter (`nvidia/nemotron-3-ultra-550b-a55b:free`).
- Debate real de ponta a ponta com busca ligada, sobre preço de hospedagem: rodada 1 com 5 fontes
  compartilhadas onde todos concluíram "as fontes não têm valores"; na rodada 2 um agente pediu
  verificação, trouxe as fontes [6] e [7] com os preços e **a incerteza foi resolvida dentro do
  debate**; outro agente apontou que [8] e [9] falavam do Square de pagamentos, não do Square
  Cloud. O juiz citou `fontes_usadas: [6, 7]` e a UI recebeu os dois links.
- Debate real sem busca (pergunta atemporal): posições `REVISO`/`MANTENHO`/`MANTENHO` detectadas,
  confiança 60% → 58% → 85% (final do juiz), nenhum `agent_error`.
- Parser da rodada 2 contra os formatos que os modelos realmente usam: rótulos em negrito sem
  dois-pontos, cabeçalhos `###`, eco das instruções dentro da resposta, posição escrita só no meio
  do parágrafo e texto sem rótulo algum.
