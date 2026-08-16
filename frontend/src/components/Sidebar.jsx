/**
 * ============================================================================
 *  Sidebar — navegação + debates anteriores
 * ============================================================================
 * No desktop fica fixa à esquerda. No celular vira uma gaveta que abre pelo
 * botão da barra superior.
 */

import { useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useDebateHistory } from '../hooks/useDebateHistory.js';
import { useBackendStatus } from '../hooks/useBackendStatus.js';
import { tempoRelativo } from '../utils/time.js';
import { resumir } from '../utils/format.jsx';
import './Sidebar.css';

/** Bolinha de status do debate. */
function StatusDot({ status }) {
  const titulo =
    status === 'completed' ? 'concluído' : status === 'failed' ? 'falhou' : 'em andamento';
  return <span className={`status-dot status-dot--${status}`} title={titulo} aria-label={titulo} />;
}

/**
 * @param {object} props
 * @param {boolean} props.open  gaveta aberta (mobile)
 * @param {() => void} props.onClose
 */
export function Sidebar({ open, onClose }) {
  const { debates, loading, refresh } = useDebateHistory(12);
  const backend = useBackendStatus();
  const location = useLocation();

  // Recarrega a lista ao navegar (um debate novo aparece sozinho).
  useEffect(() => {
    refresh();
  }, [location.pathname, refresh]);

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} aria-hidden="true" />}

      <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
        <div className="sidebar__brand">
          <Link to="/" className="sidebar__logo" onClick={onClose}>
            <span className="sidebar__logo-icon" aria-hidden="true">
              ⚖️
            </span>
            <span>
              <strong>Conselho de IAs</strong>
              <small>debate multiagente</small>
            </span>
          </Link>
        </div>

        <Link to="/" className="button button--primary sidebar__new" onClick={onClose}>
          + Novo debate
        </Link>

        <nav className="sidebar__nav">
          <NavLink to="/" className="sidebar__link" onClick={onClose} end>
            Início
          </NavLink>
          <NavLink to="/history" className="sidebar__link" onClick={onClose}>
            Histórico completo
          </NavLink>
        </nav>

        <div className="sidebar__section">
          <span className="sidebar__section-title">Debates recentes</span>
          <button
            type="button"
            className="sidebar__refresh"
            onClick={refresh}
            title="Atualizar lista"
          >
            ↻
          </button>
        </div>

        <div className="sidebar__list">
          {loading && <p className="sidebar__empty">Carregando…</p>}

          {!loading && !debates.length && (
            <p className="sidebar__empty">
              Nenhum debate ainda. Faça a primeira pergunta ao conselho.
            </p>
          )}

          {debates.map((debate) => (
            <NavLink
              key={debate.id}
              to={`/debate/${debate.id}`}
              className={({ isActive }) =>
                `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
              }
              onClick={onClose}
            >
              <span className="sidebar__item-question">
                <StatusDot status={debate.status} />
                {resumir(debate.question, 64)}
              </span>
              <span className="sidebar__item-meta">
                {tempoRelativo(debate.createdAt)}
                {debate.confidence != null && ` · ${debate.confidence}%`}
              </span>
            </NavLink>
          ))}
        </div>

        <footer className="sidebar__footer">
          <span className={`sidebar__status ${backend.online ? 'is-online' : 'is-offline'}`}>
            <i aria-hidden="true" />
            {backend.loading
              ? 'verificando backend…'
              : backend.online
                ? 'backend online'
                : 'backend offline'}
          </span>
          {backend.mockMode && <span className="chip chip--warn">modo simulado</span>}
        </footer>
      </aside>
    </>
  );
}
