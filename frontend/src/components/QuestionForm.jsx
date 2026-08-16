/**
 * Formulário da pergunta: o ponto de entrada do debate.
 * Enter + Ctrl/Cmd envia; Enter simples quebra linha.
 */

import { useState } from 'react';
import './QuestionForm.css';

const EXEMPLOS = [
  'Vale a pena migrar meu projeto de REST para GraphQL?',
  'Qual a melhor estratégia para aprender inglês técnico em 3 meses?',
  'É seguro guardar dados de usuários em SQLite em produção?',
  'Investir em índice ou escolher ações individuais faz mais sentido?',
];

/**
 * @param {object} props
 * @param {(pergunta: string) => void} props.onSubmit
 * @param {boolean} [props.loading]
 * @param {string|null} [props.error]
 */
export function QuestionForm({ onSubmit, loading = false, error = null }) {
  const [pergunta, setPergunta] = useState('');
  const podeEnviar = pergunta.trim().length >= 5 && !loading;

  function enviar(evento) {
    evento?.preventDefault();
    if (!podeEnviar) return;
    onSubmit(pergunta.trim());
  }

  function aoDigitar(evento) {
    // Ctrl+Enter (ou Cmd+Enter) envia.
    if (evento.key === 'Enter' && (evento.ctrlKey || evento.metaKey)) enviar(evento);
  }

  return (
    <form className="question-form" onSubmit={enviar}>
      <label className="question-form__label" htmlFor="pergunta">
        Sua pergunta para o conselho
      </label>

      <textarea
        id="pergunta"
        className="textarea"
        placeholder="Ex.: devo reescrever meu app em outro framework ou refatorar o atual?"
        value={pergunta}
        onChange={(evento) => setPergunta(evento.target.value)}
        onKeyDown={aoDigitar}
        maxLength={2000}
        disabled={loading}
      />

      <div className="question-form__actions">
        <span className="question-form__hint">
          {pergunta.length > 0 && `${pergunta.length}/2000 · `}Ctrl + Enter para iniciar
        </span>
        <button type="submit" className="button button--primary" disabled={!podeEnviar}>
          {loading ? 'Convocando o conselho…' : 'Iniciar debate'}
        </button>
      </div>

      {error && (
        <div className="alert alert--danger">
          <span aria-hidden="true">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <div className="question-form__examples">
        <span className="faint">Exemplos:</span>
        {EXEMPLOS.map((exemplo) => (
          <button
            type="button"
            key={exemplo}
            className="question-form__example"
            onClick={() => setPergunta(exemplo)}
            disabled={loading}
          >
            {exemplo}
          </button>
        ))}
      </div>
    </form>
  );
}
