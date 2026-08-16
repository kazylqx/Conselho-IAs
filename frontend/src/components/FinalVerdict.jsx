/**
 * ============================================================================
 *  FinalVerdict — destaque da resposta final
 * ============================================================================
 * Cartão em evidência com: resposta consolidada, nível de confiança,
 * pontos de consenso, discordâncias não resolvidas e ressalvas.
 */

import { AgentAvatar } from './AgentAvatar.jsx';
import { ConfidenceBar } from './ConfidenceBar.jsx';
import { RichText } from '../utils/format.jsx';
import './FinalVerdict.css';

/**
 * @param {object} props
 * @param {object} props.verdict veredito emitido pelo backend
 * @param {object} [props.agentsById] mapa id -> agente (para nomear falhas)
 */
export function FinalVerdict({ verdict, agentsById = {} }) {
  if (!verdict) return null;

  const juiz = verdict.generatedBy;
  const consenso = verdict.consensusPoints ?? [];
  const discordancias = verdict.disagreementPoints ?? [];
  const falharam = (verdict.failedAgents ?? []).map(
    (id) => agentsById[id]?.name ?? id,
  );

  return (
    <section className="verdict" aria-labelledby="verdict-title">
      <header className="verdict__head">
        <div className="verdict__identity">
          <AgentAvatar agent={juiz} size={46} />
          <div>
            <h2 className="verdict__title" id="verdict-title">
              Resposta Final
            </h2>
            <p className="verdict__by">
              consolidada por {juiz?.name ?? 'juiz'}
              {verdict.fallback && ' · veredito de emergência'}
            </p>
          </div>
        </div>

        <div className="verdict__confidence">
          <ConfidenceBar value={verdict.confidence} final />
        </div>
      </header>

      <div className="verdict__answer">
        <RichText text={verdict.finalAnswer} />
      </div>

      <div className="verdict__grid">
        <div className="verdict__block verdict__block--consensus">
          <h3>
            <span aria-hidden="true">✓</span> Pontos de consenso
          </h3>
          {consenso.length ? (
            <ul>
              {consenso.map((ponto, indice) => (
                <li key={indice}>{ponto}</li>
              ))}
            </ul>
          ) : (
            <p className="faint">O conselho não registrou consenso explícito.</p>
          )}
        </div>

        <div className="verdict__block verdict__block--conflict">
          <h3>
            <span aria-hidden="true">⚡</span> Discordâncias não resolvidas
          </h3>
          {discordancias.length ? (
            <ul>
              {discordancias.map((ponto, indice) => (
                <li key={indice}>{ponto}</li>
              ))}
            </ul>
          ) : (
            <p className="faint">Nenhuma divergência ficou aberta.</p>
          )}
        </div>
      </div>

      {verdict.caveats && (
        <p className="verdict__caveats">
          <strong>Ressalvas:</strong> {verdict.caveats}
        </p>
      )}

      {falharam.length > 0 && (
        <p className="verdict__failures">
          Conselheiros que não participaram: {falharam.join(', ')}.
        </p>
      )}
    </section>
  );
}
