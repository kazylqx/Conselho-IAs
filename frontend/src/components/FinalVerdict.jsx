/**
 * ============================================================================
 *  FinalVerdict — o clímax do debate
 * ============================================================================
 * Deliberadamente NÃO é uma bolha de chat: é um documento. Cartão largo, borda
 * de latão, resposta final em tipografia serifada maior, mostrador de confiança,
 * e as seções de consenso / divergência / fontes separadas com clareza.
 */

import { AgentAvatar } from './AgentAvatar.jsx';
import { ConfidenceMeter } from './ConfidenceMeter.jsx';
import { RichText } from '../utils/format.jsx';
import './FinalVerdict.css';

/**
 * @param {object} props
 * @param {object} props.verdict veredito emitido pelo backend
 * @param {object} [props.agentsById] mapa id -> agente (para nomear falhas)
 * @param {number[]} [props.confidenceHistory]
 */
export function FinalVerdict({ verdict, agentsById = {}, confidenceHistory = [] }) {
  if (!verdict) return null;

  const juiz = verdict.generatedBy;
  const consenso = verdict.consensusPoints ?? [];
  const divergencias = verdict.disagreementPoints ?? [];
  const fontes = verdict.sources ?? [];
  const falharam = (verdict.failedAgents ?? []).map((id) => agentsById[id]?.name ?? id);

  return (
    <section className="verdict anim-rise" aria-labelledby="verdict-title">
      <span className="verdict__seal" aria-hidden="true" />

      <header className="verdict__head">
        <div className="verdict__identity">
          <AgentAvatar agent={juiz} size={44} />
          <div>
            <span className="eyebrow eyebrow--brass">veredito do conselho</span>
            <h2 className="verdict__title" id="verdict-title">
              Resposta final
            </h2>
            <p className="verdict__by">
              consolidada por {juiz?.name ?? 'juiz'}
              {verdict.fallback && ' · veredito de emergência'}
            </p>
          </div>
        </div>

        <ConfidenceMeter
          value={verdict.confidence}
          final
          size="lg"
          history={confidenceHistory}
          showLabel={false}
        />
      </header>

      <div className="verdict__answer">
        <RichText text={verdict.finalAnswer} />
      </div>

      <div className="verdict__grid">
        <div className="verdict__block verdict__block--consensus">
          <span className="eyebrow">
            <i aria-hidden="true">◆</i> pontos de consenso
          </span>
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
          <span className="eyebrow">
            <i aria-hidden="true">◆</i> divergências em aberto
          </span>
          {divergencias.length ? (
            <ul>
              {divergencias.map((ponto, indice) => (
                <li key={indice}>{ponto}</li>
              ))}
            </ul>
          ) : (
            <p className="faint">Nenhuma divergência ficou sem resolução.</p>
          )}
        </div>
      </div>

      {fontes.length > 0 && (
        <section className="verdict__sources">
          <span className="eyebrow">
            {verdict.sourcesFromRegistry ? 'fontes consultadas no debate' : 'fontes do veredito'}
          </span>
          <ul>
            {fontes.map((fonte) => (
              <li key={fonte.url}>
                <a href={fonte.url} target="_blank" rel="noopener noreferrer">
                  <span className="verdict__source-number mono">[{fonte.n}]</span> {fonte.title}
                </a>
                <span className="verdict__source-meta mono">
                  {fonte.source}
                  {fonte.publishedAt ? ` · ${fonte.publishedAt}` : ''}
                </span>
              </li>
            ))}
          </ul>
          {verdict.sourcesFromRegistry && (
            <p className="verdict__note">
              A juíza não indicou quais fontes sustentam a resposta; estas são todas as que o
              conselho consultou.
            </p>
          )}
        </section>
      )}

      {(verdict.caveats || falharam.length > 0) && (
        <footer className="verdict__foot">
          {verdict.caveats && (
            <p className="verdict__caveats">
              <strong>Ressalvas:</strong> {verdict.caveats}
            </p>
          )}
          {falharam.length > 0 && (
            <p className="verdict__note">
              Conselheiros que não participaram: {falharam.join(', ')}.
            </p>
          )}
        </footer>
      )}
    </section>
  );
}
