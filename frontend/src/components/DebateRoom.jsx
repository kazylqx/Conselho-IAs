/**
 * ============================================================================
 *  DebateRoom — a sala da conversa
 * ============================================================================
 * Regra central do redesign: UMA COISA DE CADA VEZ. A timeline não é renderizada
 * crua; ela passa pela fila de apresentação (useSequentialReveal), que revela um
 * item por vez com intervalo. Enquanto a fila não esvazia, o "está pensando" e o
 * veredito ficam escondidos — assim o usuário sempre acompanha o ritmo em vez de
 * receber tudo de uma vez.
 *
 * Debate antigo (vindo do histórico) aparece na hora: encenar 40 segundos de
 * releitura seria só irritante.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChatBubble, AgentErrorBubble } from './ChatBubble.jsx';
import { RoundDivider } from './RoundDivider.jsx';
import { TypingIndicator } from './TypingIndicator.jsx';
import { FinalVerdict } from './FinalVerdict.jsx';
import { SearchCard } from './SearchCard.jsx';
import { DebateSkeleton } from './DebateSkeleton.jsx';
import { useSequentialReveal } from '../hooks/useSequentialReveal.js';
import './DebateRoom.css';

/** Distância do fim (px) em que ainda consideramos que o usuário está acompanhando. */
const MARGEM_FIM = 140;

/**
 * @param {object} props
 * @param {Array} props.timeline
 * @param {object} props.agentsById
 * @param {Array} props.typingAgents
 * @param {object|null} props.verdict
 * @param {'running'|'completed'|'failed'} props.status
 * @param {string|null} [props.error]
 * @param {Array} [props.agents] elenco (para o esqueleto de carregamento)
 * @param {number[]} [props.confidenceHistory]
 */
export function DebateRoom({
  timeline = [],
  agentsById = {},
  typingAgents = [],
  verdict = null,
  status = 'running',
  error = null,
  agents = [],
  confidenceHistory = [],
}) {
  const areaRef = useRef(null);
  const fimRef = useRef(null);
  const [seguirFim, setSeguirFim] = useState(true);

  const { visibleItems, isRevealing, pending } = useSequentialReveal(timeline);

  // Detecta se o usuário subiu para reler algo.
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
  }, [visibleItems.length, typingAgents.length, verdict, seguirFim]);

  // Fila em dia = pode mostrar quem está pensando e o veredito.
  const filaEmDia = !isRevealing;
  const mostrarEsqueleto = status === 'running' && !visibleItems.length;

  return (
    <div className="room">
      <div className="room__scroll" ref={areaRef}>
        <div className="room__stream">
          {mostrarEsqueleto && <DebateSkeleton agents={agents} />}

          {visibleItems.map((item) => {
            if (item.kind === 'round') {
              return <RoundDivider key={item.key} round={item.round} label={item.label} />;
            }

            if (item.kind === 'system') {
              return (
                <p className="room__system" key={item.key}>
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

          {filaEmDia && <TypingIndicator agents={typingAgents} />}

          {filaEmDia && verdict && (
            <FinalVerdict
              verdict={verdict}
              agentsById={agentsById}
              confidenceHistory={confidenceHistory}
            />
          )}

          {status === 'failed' && error && filaEmDia && (
            <div className="notice notice--danger room__failure">
              <span aria-hidden="true">⚠</span>
              <div>
                <strong>O debate foi interrompido.</strong>
                <p>{error}</p>
              </div>
            </div>
          )}

          <div ref={fimRef} className="room__end" />
        </div>
      </div>

      {!seguirFim && (
        <button
          type="button"
          className="room__jump"
          onClick={() => {
            setSeguirFim(true);
            fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }}
        >
          <span aria-hidden="true">↓</span> acompanhar o debate
          {pending > 0 && <span className="room__jump-count mono">{pending}</span>}
        </button>
      )}
    </div>
  );
}
