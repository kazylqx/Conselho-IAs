/**
 * ============================================================================
 *  AuthProvider — quem está logado, disponível em toda a aplicação
 * ============================================================================
 * Mantém o usuário do Firebase em contexto, expõe as ações de login/logout e
 * avisa o cliente de WebSocket quando a identidade muda (o backend precisa do
 * ID token no handshake para liberar os debates da pessoa).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { firebaseConfigurado, obterIdToken } from '../services/firebase.js';
import {
  criarConta,
  entrarComEmail,
  entrarComGoogle,
  observarLogin,
  recuperarSenha,
  sair,
} from '../services/auth.js';
import { reconectarSocket } from '../services/socket.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(firebaseConfigurado);

  useEffect(() => {
    return observarLogin(async (conta) => {
      setUsuario(conta ?? null);
      setCarregando(false);

      // Reabre o socket com (ou sem) credencial, para o backend reconhecer.
      const token = conta ? await obterIdToken() : null;
      reconectarSocket(token);
    });
  }, []);

  const encerrarSessao = useCallback(async () => {
    await sair();
    reconectarSocket(null);
  }, []);

  const valor = useMemo(
    () => ({
      usuario,
      carregando,
      /** true quando o projeto tem Firebase configurado. */
      habilitado: firebaseConfigurado,
      /** true quando há alguém logado. */
      autenticado: Boolean(usuario),
      entrarComGoogle,
      entrarComEmail,
      criarConta,
      recuperarSenha,
      sair: encerrarSessao,
    }),
    [usuario, carregando, encerrarSessao],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

/** Acesso ao estado de login. */
export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return contexto;
}
