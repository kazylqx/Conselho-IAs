/**
 * ============================================================================
 *  DebateRoom — a sala de sessões
 * ============================================================================
 * Duas decisões estruturam esta tela:
 *
 * 1. TURNOS. A timeline não é renderizada crua: passa pela fila de apresentação
 *    (useSequentialReveal), que anuncia quem vai falar e só então revela a fala,
 *    uma por vez. Enquanto a fila não esvazia, o veredito fica escondido — o
 *    usuário nunca recebe três respostas de uma vez.
 *
 * 2. SESSÕES. Cada rodada é um bloco fechado, com cabeçalho, contador de quem já
 *    falou e as falas dentro. Em vez de cards soltos empilhados, a tela lê como
 *    a ata de um tribunal: dá para ver onde uma etapa termina e a outra começa.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChatBubble, AgentErrorBubble } from './ChatBubble.jsx';
import { RoundDivider } from './RoundDivider.jsx';
import { TypingIndicator } from './TypingIndicator.jsx';
import { FinalVerdict } from './FinalVerdict.jsx';
import { SearchCard } from './SearchCard.jsx';
import { DebateSkeleton } from './DebateSkeleton.jsx';
import { useSequentialReveal } from '../hooks/useSequentialReveal.js';
import './DebateRoom.css';

/** Distância do fim (px) em que ainda consideramos que o usuário acompanha. */
const MARGEM_FIM = 140;

/**
 * Agrupa os itens por rodada. O que vier antes do primeiro marcador de rodada
 * (avisos de busca, por exemplo) fica em um grupo sem cabeçalho.
 */
function agruparPorRodada(itens) {
  const grupos = [];

  for (const item of itens) {
    if (item.kind === 'round') {
      grupos.push({ round: item.round, label: item.label, key: item.key, itens: [] });
      continue;
    }

    if (!grupos.length) grupos.push({ round: null, label: null, key: 'abertura', itens: [] });
    grupos[grupos.length - 1].itens.push(item);
  }

  return grupos;
}

/**
 * @param {object} props
 * @param {Array} props.timeline
 * @param {object} props.agentsById
 * @param {Array} props.typingAgents  agentes que o backend diz estarem pensando
 * @param {object|null} props.verdict
 * @param {'running'|'completed'|'failed'} props.status
 * @param {string|null} [props.error]
 * @param {Array} [props.agents] elenco (esqueleto de carregamento e contadores)
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

  /**
   * Quem pediu menos animação no sistema recebe o conteúdo direto, sem
   * encenação de turnos.
   */
  const [semEncenacao] = useState(
    () =>
      typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches),
  );

  const { visibleItems, announcing, isRevealing, pending } = useSequentialReveal(timeline, {
    enabled: !semEncenacao,
  });
  const grupos = useMemo(() => agruparPorRodada(visibleItems), [visibleItems]);

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
  }, [visibleItems.length, announcing, verdict, seguirFim]);

  const filaEmDia = !isRevealing;

  // Enquanto nada foi revelado, o esqueleto sozinho conta a história de que a
  // sala está se formando — sem ele e as pílulas de "formulando" competindo.
  const mostrarEsqueleto = status === 'running' && !visibleItems.length;

  /**
   * Quem aparece como "formulando":
   *  - se há um turno sendo anunciado, é só ele (uma coisa de cada vez);
   *  - se a fila está em dia, mostramos o que o backend reporta.
   */
  const anunciado = announcing?.agentId ? agentsById[announcing.agentId] : null;
  const pensando = mostrarEsqueleto
    ? []
    : anunciado
      ? [{ agent: anunciado, round: announcing.round }]
      : filaEmDia
        ? typingAgents
        : [];
  const totalDeAgentes = agents.length || Object.keys(agentsById).length;

  return (
    <div className="room">
      <div className="room__scroll" ref={areaRef}>
        <div className="room__stream">
          {mostrarEsqueleto && <DebateSkeleton agents={agents} />}

          {grupos.map((grupo, indiceGrupo) => {
            const ultimo = indiceGrupo === grupos.length - 1;
            const falas = grupo.itens.filter(
              (item) => item.kind === 'message' || item.kind === 'error',
            ).length;

            const conteudo = (
              <>
                {grupo.itens.map((item) => {
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
                      <AgentErrorBubble
                        key={item.key}
                        agent={agentsById[item.agentId]}
                        item={item}
                      />
                    );
                  }

                  return (
                    <ChatBubble key={item.key} agent={agentsById[item.agentId]} item={item} />
                  );
                })}

                {/* Quem está com a palavra aparece no fim da sessão corrente */}
                {ultimo && pensando.length > 0 && <TypingIndicator agents={pensando} />}

                {/* O veredito fecha a sessão 3 */}
                {ultimo && filaEmDia && verdict && (
                  <FinalVerdict
                    verdict={verdict}
                    agentsById={agentsById}
                    confidenceHistory={confidenceHistory}
                  />
                )}
              </>
            );

            // Grupo de abertura (avisos antes da rodada 1): sem moldura.
            if (grupo.round == null) {
              return (
                <div className="room__opening" key={grupo.key}>
                  {conteudo}
                </div>
              );
            }

            return (
              <section className={`session session--${grupo.round}`} key={grupo.key}>
                <RoundDivider
                  round={grupo.round}
                  label={grupo.label}
                  count={falas}
                  total={totalDeAgentes}
                />
                <div className="session__body">{conteudo}</div>
              </section>
            );
          })}

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
          <span aria-hidden="true">↓</span> acompanhar a sessão
          {pending > 0 && <span className="room__jump-count mono">{pending}</span>}
        </button>
      )}
    </div>
  );
}
