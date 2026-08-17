/**
 * ============================================================================
 *  DebateRoom — a sala de chat em grupo
 * ============================================================================
 * Renderiza a linha do tempo do debate: divisores de rodada, falas dos agentes,
 * avisos do sistema, falhas e o veredito final. Rola sozinho para acompanhar as
 * novas mensagens, mas respeita o usuário quando ele sobe para reler algo.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChatBubble, AgentErrorBubble } from './ChatBubble.jsx';
import { RoundDivider } from './RoundDivider.jsx';
import { TypingIndicator } from './TypingIndicator.jsx';
import { FinalVerdict } from './FinalVerdict.jsx';
import { SearchCard } from './SearchCard.jsx';
import './DebateRoom.css';

/** Distância do fim (px) em que ainda consideramos que o usuário está "no fim". */
const MARGEM_FIM = 120;

/**
 * @param {object} props
 * @param {Array} props.timeline
 * @param {object} props.agentsById
 * @param {Array} props.typingAgents
 * @param {object|null} props.verdict
 * @param {'running'|'completed'|'failed'} props.status
 * @param {string|null} [props.error]
 */
export function DebateRoom({
  timeline = [],
  agentsById = {},
  typingAgents = [],
  verdict = null,
  status = 'running',
  error = null,
}) {
  const areaRef = useRef(null);
  const fimRef = useRef(null);
  const [seguirFim, setSeguirFim] = useState(true);

  // Detecta se o usuário saiu do fim da conversa.
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return undefined;

    const aoRolar = () => {
      const distancia = area.scrollHeight - area.scrollTop - area.clientHeight;
      setSeguirFim(distancia < MARGEM_FIM);
    };

    area.addEventListener('scroll', aoRolar, { passive: true });
    return () => area.removeEventListener('scroll', aoRolar);
  }, []);

  // Acompanha as novidades (só quando o usuário está no fim).
  useLayoutEffect(() => {
    if (!seguirFim) return;
    fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [timeline.length, typingAgents.length, verdict, seguirFim]);

  return (
    <div className="debate-room">
      <div className="debate-room__scroll" ref={areaRef}>
        <div className="debate-room__list">
          {timeline.map((item) => {
            if (item.kind === 'round') {
              return <RoundDivider key={item.key} round={item.round} label={item.label} />;
            }

            if (item.kind === 'system') {
              return (
                <p className="debate-room__system" key={item.key}>
                  {item.message}
                </p>
              );
            }

            if (item.kind === 'search') {
              return (
                <SearchCard
                  key={item.key}
                  agent={item.agentId ? agentsById[item.agentId] : null}
                  item={item}
                />
              );
            }

            if (item.kind === 'error') {
              return (
                <AgentErrorBubble key={item.key} agent={agentsById[item.agentId]} item={item} />
              );
            }

            return <ChatBubble key={item.key} agent={agentsById[item.agentId]} item={item} />;
          })}

          <TypingIndicator agents={typingAgents} />

          {verdict && <FinalVerdict verdict={verdict} agentsById={agentsById} />}

          {status === 'failed' && error && (
            <div className="alert alert--danger debate-room__failure">
              <span aria-hidden="true">⚠️</span>
              <div>
                <strong>O debate foi interrompido.</strong>
                <p style={{ margin: '0.25rem 0 0' }}>{error}</p>
              </div>
            </div>
          )}

          <div ref={fimRef} />
        </div>
      </div>

      {!seguirFim && (
        <button
          type="button"
          className="debate-room__jump"
          onClick={() => {
            setSeguirFim(true);
            fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }}
        >
          ↓ acompanhar o debate
        </button>
      )}
    </div>
  );
}
