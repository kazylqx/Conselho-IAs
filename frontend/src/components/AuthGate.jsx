/**
 * ============================================================================
 *  AuthGate — protege rotas que dependem de conta
 * ============================================================================
 * Se o Firebase não estiver configurado, deixa passar: o projeto continua
 * utilizável em modo anônimo. Com Firebase e sem login, manda para /login
 * lembrando de onde a pessoa veio, para voltar ao lugar certo depois.
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthProvider.jsx';

export function AuthGate({ children }) {
  const { habilitado, autenticado, carregando } = useAuth();
  const location = useLocation();

  if (!habilitado) return children;

  if (carregando) {
    return (
      <div className="debate-empty">
        <span className="debate-empty__mark debate-empty__mark--pulse" aria-hidden="true">
          ⚖
        </span>
        <h2>Verificando sua sessão…</h2>
      </div>
    );
  }

  if (!autenticado) {
    return <Navigate to="/login" replace state={{ de: location.pathname }} />;
  }

  return children;
}
