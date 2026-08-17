/**
 * ============================================================================
 *  Sidebar — navegação e conversas recentes
 * ============================================================================
 * No desktop fica fixa à esquerda. No celular vira gaveta, aberta pela barra
 * superior.
 */

import { useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useDebateHistory } from '../hooks/useDebateHistory.js';
import { useBackendStatus } from '../hooks/useBackendStatus.js';
import { useAuth } from '../contexts/AuthProvider.jsx';
import { UserMenu } from './UserMenu.jsx';
import { tempoRelativo } from '../utils/time.js';
import { resumir } from '../utils/format.jsx';
import './Sidebar.css';

/** Bolinha de status do debate. */
function StatusDot({ status }) {
  const titulo =
    status === 'completed' ? 'concluído' : status === 'failed' ? 'falhou' : 'em andamento';
  return <span className={`dot dot--${status}`} title={titulo} aria-label={titulo} />;
}

/**
 * @param {object} props
 * @param {boolean} props.open gaveta aberta (mobile)
 * @param {() => void} props.onClose
 */
export function Sidebar({ open, onClose }) {
  const { debates, loading, refresh } = useDebateHistory(10);
  const backend = useBackendStatus();
  const { habilitado, autenticado } = useAuth();
  const location = useLocation();

  /** Com login ativo e ninguém logado, a lista não tem o que mostrar. */
  const precisaEntrar = habilitado && !autenticado;

  // Recarrega a lista ao navegar (debate novo aparece sozinho).
  useEffect(() => {
    refresh();
  }, [location.pathname, refresh]);

  return (
    <>
      {open && <div className="scrim" onClick={onClose} aria-hidden="true" />}

      <aside className={`side ${open ? 'side--open' : ''}`}>
        <Link to="/" className="side__brand" onClick={onClose}>
          <span className="side__mark" aria-hidden="true">
            ⚖
          </span>
          <span className="side__wordmark">
            <strong>Conselho</strong>
            <em>de IAs</em>
          </span>
        </Link>

        <Link to="/" className="button button--primary side__new" onClick={onClose}>
          <span aria-hidden="true">+</span> Novo debate
        </Link>

        <nav className="side__nav">
          <NavLink to="/" className="side__link" onClick={onClose} end>
            Início
          </NavLink>
          <NavLink to="/history" className="side__link" onClick={onClose}>
            Histórico
          </NavLink>
        </nav>

        <div className="side__section">
          <span className="eyebrow">conversas recentes</span>
          <button
            type="button"
            className="side__refresh"
            onClick={refresh}
            title="Atualizar lista"
            aria-label="Atualizar lista"
          >
            ↻
          </button>
        </div>

        <div className="side__list">
          {precisaEntrar && (
            <p className="side__empty">
              Entre na sua conta para ver seus debates salvos.
            </p>
          )}

          {!precisaEntrar && loading && <p className="side__empty">carregando…</p>}

          {!precisaEntrar && !loading && !debates.length && (
            <p className="side__empty">
              Nenhum debate ainda. Faça a primeira pergunta ao conselho.
            </p>
          )}

          {debates.map((debate) => (
            <NavLink
              key={debate.id}
              to={`/debate/${debate.id}`}
              className={({ isActive }) => `side__item ${isActive ? 'side__item--active' : ''}`}
              onClick={onClose}
            >
              <span className="side__item-top">
                <StatusDot status={debate.status} />
                <span className="side__item-question">{resumir(debate.question, 58)}</span>
              </span>
              <span className="side__item-meta mono">
                {tempoRelativo(debate.createdAt)}
                {debate.confidence != null && ` · ${debate.confidence}%`}
              </span>
            </NavLink>
          ))}
        </div>

        <footer className="side__foot">
          <UserMenu onNavigate={onClose} />

          <div className="side__estado">
            <span className={`side__status ${backend.online ? 'is-on' : 'is-off'}`}>
              <i aria-hidden="true" />
              {backend.loading
                ? 'verificando…'
                : backend.online
                  ? 'backend online'
                  : 'backend offline'}
            </span>
            {backend.mockMode && <span className="tag tag--ember">simulado</span>}
          </div>
        </footer>
      </aside>
    </>
  );
}
