/**
 * ============================================================================
 *  UndoToast — exclusão com rede de proteção
 * ============================================================================
 * O item sai da lista na hora, mas o DELETE só vai para o backend quando esta
 * janela fecha. Enquanto a barrinha corre, "Desfazer" realmente desfaz — nada
 * foi apagado ainda.
 */

import './UndoToast.css';

/**
 * @param {object} props
 * @param {string} props.message
 * @param {() => void} props.onUndo
 * @param {number} props.duration duração da janela, em ms
 */
export function UndoToast({ message, onUndo, duration = 6000 }) {
  return (
    <div className="toast" role="status">
      <div className="toast__body">
        <span className="toast__message">{message}</span>
        <button type="button" className="toast__undo" onClick={onUndo}>
          Desfazer
        </button>
      </div>
      <span
        className="toast__timer"
        style={{ animationDuration: `${duration}ms` }}
        aria-hidden="true"
      />
    </div>
  );
}
