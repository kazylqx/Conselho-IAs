/**
 * Identidade de quem está logado, no pé da sidebar: avatar, nome e sair.
 * Sem login, vira o convite para entrar.
 */

import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthProvider.jsx';
import './UserMenu.css';

/** Iniciais para quem não tem foto. */
function iniciais(usuario) {
  const base = usuario?.displayName || usuario?.email || '?';
  return base
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join('');
}

export function UserMenu({ onNavigate }) {
  const { usuario, autenticado, habilitado, carregando, sair } = useAuth();

  if (!habilitado) return null;

  if (carregando) {
    return <div className="usermenu usermenu--carregando">verificando login…</div>;
  }

  if (!autenticado) {
    return (
      <Link to="/login" className="usermenu usermenu--convite" onClick={onNavigate}>
        <span className="usermenu__avatar usermenu__avatar--vazio" aria-hidden="true">
          ⌾
        </span>
        <span className="usermenu__texto">
          <strong>Entrar</strong>
          <small>salve seus debates</small>
        </span>
      </Link>
    );
  }

  const nome = usuario.displayName || usuario.email?.split('@')[0] || 'conselheiro';

  return (
    <div className="usermenu">
      {usuario.photoURL ? (
        <img className="usermenu__avatar" src={usuario.photoURL} alt="" referrerPolicy="no-referrer" />
      ) : (
        <span className="usermenu__avatar" aria-hidden="true">
          {iniciais(usuario)}
        </span>
      )}

      <span className="usermenu__texto">
        <strong title={usuario.email ?? nome}>{nome}</strong>
        <small>{usuario.email}</small>
      </span>

      <button type="button" className="usermenu__sair" onClick={sair} title="Sair da conta">
        sair
      </button>
    </div>
  );
}
