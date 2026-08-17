/**
 * ============================================================================
 *  QuestionComposer — o convite para começar
 * ============================================================================
 * É o call-to-action central da landing: um campo grande, com moldura de latão
 * que acende no foco, contador de caracteres em mono e sugestões clicáveis.
 * Ctrl/Cmd + Enter envia.
 */

import { useState } from 'react';
import './QuestionComposer.css';

const SUGESTOES = [
  'Vale a pena migrar meu projeto de REST para GraphQL?',
  'Investir em índice ou escolher ações faz mais sentido?',
  'É seguro usar SQLite em produção?',
  'Qual a versão LTS atual do Node.js e vale atualizar?',
];

const LIMITE = 2000;

/**
 * @param {object} props
 * @param {(pergunta: string) => void} props.onSubmit
 * @param {boolean} [props.loading]
 * @param {string|null} [props.error]
 */
export function QuestionComposer({ onSubmit, loading = false, error = null }) {
  const [pergunta, setPergunta] = useState('');
  const [focado, setFocado] = useState(false);

  const podeEnviar = pergunta.trim().length >= 5 && !loading;

  function enviar(evento) {
    evento?.preventDefault();
    if (!podeEnviar) return;
    onSubmit(pergunta.trim());
  }

  function aoDigitar(evento) {
    if (evento.key === 'Enter' && (evento.ctrlKey || evento.metaKey)) enviar(evento);
  }

  return (
    <form className={`composer ${focado ? 'composer--active' : ''}`} onSubmit={enviar}>
      <div className="composer__frame">
        <label className="eyebrow composer__label" htmlFor="pergunta">
          sua pergunta ao conselho
        </label>

        <textarea
          id="pergunta"
          className="composer__input"
          placeholder="Ex.: devo reescrever meu app em outro framework ou refatorar o atual?"
          value={pergunta}
          onChange={(evento) => setPergunta(evento.target.value)}
          onKeyDown={aoDigitar}
          onFocus={() => setFocado(true)}
          onBlur={() => setFocado(false)}
          maxLength={LIMITE}
          rows={3}
          disabled={loading}
        />

        <div className="composer__actions">
          <span className="composer__hint mono">
            {pergunta.length > 0 && `${pergunta.length}/${LIMITE} · `}
            ctrl + enter
          </span>

          <button type="submit" className="button button--primary composer__submit" disabled={!podeEnviar}>
            {loading ? (
              <>
                <span className="composer__spinner" aria-hidden="true" /> convocando…
              </>
            ) : (
              <>
                Iniciar debate <span aria-hidden="true">→</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="notice notice--danger">
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </div>
      )}

      <div className="composer__suggestions">
        <span className="eyebrow">experimente</span>
        <div className="composer__chips">
          {SUGESTOES.map((sugestao) => (
            <button
              type="button"
              key={sugestao}
              className="composer__chip"
              onClick={() => setPergunta(sugestao)}
              disabled={loading}
            >
              {sugestao}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}
