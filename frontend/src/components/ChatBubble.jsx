/**
 * ============================================================================
 *  ChatBubble — uma fala do conselho
 * ============================================================================
 * Duas variantes:
 *  - "response" (rodada 1): a resposta independente, texto corrido formatado
 *  - "debate"   (rodada 2): concordâncias, discordâncias, posição (mantém /
 *                revisou) e a resposta revisada, cada bloco com seu peso visual
 */

import { AgentAvatar } from './AgentAvatar.jsx';
import { RichText } from '../utils/format.jsx';
import { duracao, horaCurta } from '../utils/time.js';
import './ChatBubble.css';

/**
 * @param {object} props
 * @param {object} props.agent agente público (nome, cor, avatar, papel)
 * @param {object} props.item  item da timeline (ver useDebateStream)
 */
export function ChatBubble({ agent, item }) {
  const cor = agent?.color ?? 'var(--brass)';
  const estruturado = item.structured;
  const mostrarEstrutura = item.variant === 'debate' && estruturado?.parsed;

  return (
    <article className="bubble" style={{ '--agent-color': cor }}>
      <div className="bubble__gutter">
        <AgentAvatar agent={agent} size={40} />
        <span className="bubble__thread" aria-hidden="true" />
      </div>

      <div className="bubble__body">
        <header className="bubble__head">
          <span className="bubble__name">{agent?.name ?? item.agentId}</span>
          {agent?.role && <span className="bubble__role">{agent.role}</span>}

          {estruturado?.position && (
            <span
              className={`bubble__stance bubble__stance--${
                estruturado.position === 'MANTENHO' ? 'keep' : 'revise'
              }`}
            >
              {estruturado.position === 'MANTENHO' ? 'mantém a posição' : 'revisou'}
            </span>
          )}

          <time className="bubble__time mono">{horaCurta(item.at)}</time>
        </header>

        <div className="bubble__content">
          {mostrarEstrutura ? (
            <>
              {estruturado.agreements && (
                <section className="block block--agree">
                  <span className="eyebrow">concordâncias</span>
                  <RichText text={estruturado.agreements} />
                </section>
              )}

              {estruturado.disagreements && (
                <section className="block block--disagree">
                  <span className="eyebrow">discordâncias</span>
                  <RichText text={estruturado.disagreements} />
                </section>
              )}

              {estruturado.updatedAnswer && (
                <section className="block block--answer">
                  <span className="eyebrow">resposta atualizada</span>
                  <RichText text={estruturado.updatedAnswer} />
                </section>
              )}
            </>
          ) : (
            <RichText text={item.content} />
          )}
        </div>

        <footer className="bubble__meta mono">
          {item.meta?.mocked ? (
            <span className="tag tag--ember">simulado</span>
          ) : (
            item.meta?.model && <span className="bubble__model">{item.meta.model}</span>
          )}
          {item.meta?.durationMs != null && <span>{duracao(item.meta.durationMs)}</span>}
          {item.meta?.usedWebSearch && <span className="bubble__searched">verificou na web</span>}
          {item.meta?.usedFallback && (
            <span className="tag tag--ember" title="o modelo principal estava sem cota; uma reserva respondeu">
              modelo reserva
            </span>
          )}
        </footer>
      </div>
    </article>
  );
}

/**
 * Fala que não aconteceu: o agente falhou, o debate seguiu sem ele.
 * @param {object} props
 * @param {object} props.agent
 * @param {object} props.item
 */
export function AgentErrorBubble({ agent, item }) {
  return (
    <article className="bubble bubble--failed" style={{ '--agent-color': 'var(--clay)' }}>
      <div className="bubble__gutter">
        <AgentAvatar agent={agent} size={40} failed />
        <span className="bubble__thread" aria-hidden="true" />
      </div>

      <div className="bubble__body">
        <header className="bubble__head">
          <span className="bubble__name">{agent?.name ?? item.agentId}</span>
          <span className="tag tag--clay">não respondeu</span>
          <time className="bubble__time mono">{horaCurta(item.at)}</time>
        </header>

        <div className="bubble__content bubble__content--failed">
          <p>{item.message}</p>
          {item.detail && item.detail !== item.message && (
            <details>
              <summary>detalhes técnicos</summary>
              <p className="faint">{item.detail}</p>
            </details>
          )}
        </div>
      </div>
    </article>
  );
}
