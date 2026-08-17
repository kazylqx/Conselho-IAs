/**
 * ============================================================================
 *  PERSISTENCIA (arquivo JSON local)
 * ============================================================================
 * Guardamos o historico completo de cada debate em um unico arquivo JSON.
 * Por que JSON e nao SQLite? Porque `better-sqlite3` eh um modulo nativo e
 * costuma dar dor de cabeca em hospedagens compartilhadas (a propria SquareCloud
 * lista erro de bindings do better-sqlite3 na pagina de troubleshooting).
 * JSON roda em qualquer lugar, com zero dependencia.
 *
 * >>> TROCAR POR SQLITE DEPOIS <<<
 * Toda a aplicacao so conhece a interface publica abaixo:
 *   createDebate, appendEvent, updateDebate, getDebate, listDebates, deleteDebate
 * Basta criar outra classe com esses metodos e trocar em `initDb()`.
 *
 * Cuidados implementados:
 *  - escrita atomica (grava em .tmp e renomeia) para nao corromper o arquivo
 *  - escrita agrupada (debounce) para nao gravar em disco a cada evento
 *  - poda automatica do historico (MAX_DEBATES)
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

/** Estado inicial do arquivo. */
const ESTRUTURA_VAZIA = { version: 1, debates: [] };

/** Quantos caracteres da resposta final entram na previa do historico. */
const TAMANHO_PREVIA = 180;

/** Primeira linha util do veredito, sem markdown, para a lista de conversas. */
function resumirVeredito(texto) {
  if (!texto) return null;
  // Remove marcacao leve (mas preserva "_", que aparece em nomes como MOCK_AI).
  const limpo = String(texto)
    .replace(/[*`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (limpo.length <= TAMANHO_PREVIA) return limpo;
  return `${limpo.slice(0, TAMANHO_PREVIA).trimEnd()}…`;
}

class JsonDebateStore {
  /**
   * @param {object} options
   * @param {string} options.filePath  caminho do arquivo JSON
   * @param {number} options.maxDebates quantos debates manter
   */
  constructor({ filePath, maxDebates = 200 }) {
    this.filePath = filePath;
    this.maxDebates = maxDebates;
    this.data = structuredClone(ESTRUTURA_VAZIA);

    // Controle de gravacao
    this.flushTimer = null;
    this.flushing = null;
    this.dirty = false;
  }

  /** Carrega o arquivo (ou cria um novo se nao existir/estiver corrompido). */
  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const conteudo = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(conteudo);
      this.data = {
        version: parsed.version ?? 1,
        debates: Array.isArray(parsed.debates) ? parsed.debates : [],
      };
    } catch (error) {
      if (error.code !== 'ENOENT') {
        // Arquivo existe mas esta ilegivel: preserva como .bak e comeca limpo.
        try {
          await fs.rename(this.filePath, `${this.filePath}.bak-${Date.now()}`);
          console.warn(
            `[db] arquivo ilegível (${error.message}). Backup criado e histórico reiniciado.`,
          );
        } catch {
          console.warn(`[db] arquivo ilegível e sem backup possível: ${error.message}`);
        }
      }
      this.data = structuredClone(ESTRUTURA_VAZIA);
      await this.flush();
    }

    return this;
  }

  /** Agenda gravacao em disco (agrupa varias mudancas em uma so escrita). */
  scheduleFlush() {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush().catch((error) => console.error('[db] falha ao gravar:', error.message));
    }, 250);
  }

  /** Grava agora, de forma atomica e sem concorrencia. */
  async flush() {
    if (this.flushing) {
      await this.flushing;
      if (!this.dirty) return;
    }

    this.dirty = false;
    const tmp = `${this.filePath}.tmp`;
    const conteudo = JSON.stringify(this.data, null, 2);

    this.flushing = (async () => {
      await fs.writeFile(tmp, conteudo, 'utf8');
      await fs.rename(tmp, this.filePath);
    })();

    try {
      await this.flushing;
    } finally {
      this.flushing = null;
    }
  }

  /** Remove os debates mais antigos que passarem do limite. */
  podar() {
    if (this.data.debates.length <= this.maxDebates) return;
    // O array esta ordenado do mais novo para o mais antigo.
    this.data.debates.length = this.maxDebates;
  }

  // -------------------------------------------------------------------------
  // Interface publica
  // -------------------------------------------------------------------------

  /**
   * Cria o registro de um debate novo.
   * @param {object} params
   * @param {string} params.question
   * @param {Array}  params.agents  agentes publicos participantes
   * @param {object} params.judge   juiz publico
   * @param {boolean} [params.mock]
   * @returns {object} debate criado
   */
  async createDebate({ question, agents, judge, mock = false }) {
    const agora = new Date().toISOString();
    const debate = {
      id: randomUUID(),
      question,
      status: 'running', // running | completed | failed
      createdAt: agora,
      updatedAt: agora,
      completedAt: null,
      mock,
      agents,
      judge,
      events: [],
      verdict: null,
      confidence: null,
      error: null,
    };

    this.data.debates.unshift(debate);
    this.podar();
    this.scheduleFlush();
    return debate;
  }

  /**
   * Acrescenta um evento ao historico do debate (o que permite "replay" na UI).
   * @param {string} debateId
   * @param {object} event { type, ...payload }
   */
  async appendEvent(debateId, event) {
    const debate = this.data.debates.find((item) => item.id === debateId);
    if (!debate) return null;

    const registro = { seq: debate.events.length + 1, at: new Date().toISOString(), ...event };
    debate.events.push(registro);
    debate.updatedAt = registro.at;
    this.scheduleFlush();
    return registro;
  }

  /**
   * Atualiza campos do debate (status, verdict, confidence, error...).
   * @param {string} debateId
   * @param {object} patch
   */
  async updateDebate(debateId, patch) {
    const debate = this.data.debates.find((item) => item.id === debateId);
    if (!debate) return null;

    Object.assign(debate, patch, { updatedAt: new Date().toISOString() });
    this.scheduleFlush();
    return debate;
  }

  /** Retorna o debate completo (com todos os eventos). */
  async getDebate(debateId) {
    return this.data.debates.find((item) => item.id === debateId) ?? null;
  }

  /**
   * Lista resumos dos debates, do mais novo para o mais antigo.
   * @param {object} [options]
   * @param {number} [options.limit]
   */
  async listDebates({ limit = 50 } = {}) {
    return this.data.debates.slice(0, limit).map((debate) => ({
      id: debate.id,
      question: debate.question,
      status: debate.status,
      createdAt: debate.createdAt,
      completedAt: debate.completedAt,
      confidence: debate.confidence,
      agentCount: debate.agents?.length ?? 0,
      mock: debate.mock,
      hasVerdict: Boolean(debate.verdict),
      // Prévia da resposta final: a lista de conversas do frontend mostra o
      // começo do veredito, como um app de mensagens mostra a última mensagem.
      preview: resumirVeredito(debate.verdict?.finalAnswer),
    }));
  }

  /** Apaga um debate do historico. */
  async deleteDebate(debateId) {
    const indice = this.data.debates.findIndex((item) => item.id === debateId);
    if (indice === -1) return false;
    this.data.debates.splice(indice, 1);
    this.scheduleFlush();
    return true;
  }

  /** Marca debates que ficaram "running" de uma execucao anterior como falhos. */
  async recoverInterrupted() {
    let recuperados = 0;
    for (const debate of this.data.debates) {
      if (debate.status === 'running') {
        debate.status = 'failed';
        debate.error = 'Debate interrompido por reinício do servidor.';
        recuperados += 1;
      }
    }
    if (recuperados) this.scheduleFlush();
    return recuperados;
  }

  /** Grava tudo antes de desligar. */
  async close() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
}

let instancia = null;

/**
 * Inicializa (uma unica vez) o banco de dados da aplicacao.
 * @returns {Promise<JsonDebateStore>}
 */
export async function initDb() {
  if (instancia) return instancia;

  const filePath = path.resolve(process.env.DB_FILE || './data/debates.json');
  const maxDebates = Number.parseInt(process.env.MAX_DEBATES ?? '200', 10) || 200;

  instancia = new JsonDebateStore({ filePath, maxDebates });
  await instancia.init();
  const recuperados = await instancia.recoverInterrupted();

  console.log(`[db] histórico em ${filePath} (limite: ${maxDebates} debates)`);
  if (recuperados) {
    console.log(`[db] ${recuperados} debate(s) interrompido(s) marcado(s) como falha`);
  }

  return instancia;
}

/** Acesso ao banco ja inicializado. */
export function getDb() {
  if (!instancia) throw new Error('Banco não inicializado: chame initDb() antes.');
  return instancia;
}
