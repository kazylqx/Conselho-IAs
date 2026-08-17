/**
 * ============================================================================
 *  App — layout e rotas
 * ============================================================================
 * Sidebar fixa (gaveta no celular) + área de conteúdo. Tudo dentro do
 * AuthProvider, porque login define o que cada pessoa vê no histórico.
 *
 * Rotas:
 *   /            landing pública (a pergunta pede login para ser enviada)
 *   /login       entrar / criar conta
 *   /debate/:id  sala do debate (exige conta)
 *   /history     arquivo pessoal (exige conta)
 */

import { useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar.jsx';
import { AuthGate } from './components/AuthGate.jsx';
import { AuthProvider } from './contexts/AuthProvider.jsx';
import Home from './pages/Home.jsx';
import Debate from './pages/Debate.jsx';
import History from './pages/History.jsx';
import Login from './pages/Login.jsx';

/** Tela para rotas inexistentes. */
function NaoEncontrado() {
  return (
    <div className="debate-empty">
      <span className="debate-empty__mark" aria-hidden="true">
        ⚖
      </span>
      <h2>Página não encontrada</h2>
      <p className="muted">Essa rota não existe no Conselho de IAs.</p>
      <div className="debate-empty__actions">
        <Link to="/" className="button button--primary">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}

function Layout() {
  const [menuAberto, setMenuAberto] = useState(false);
  const location = useLocation();

  // Fecha a gaveta ao trocar de página (esperado no mobile).
  useEffect(() => {
    setMenuAberto(false);
  }, [location.pathname]);

  return (
    <div className="app">
      <Sidebar open={menuAberto} onClose={() => setMenuAberto(false)} />

      <div className="app__main">
        <header className="topbar">
          <button
            type="button"
            className="icon-button"
            onClick={() => setMenuAberto((atual) => !atual)}
            aria-label="Abrir menu"
            aria-expanded={menuAberto}
          >
            ☰
          </button>

          <Link to="/" className="topbar__brand">
            <span aria-hidden="true">⚖</span> Conselho <span>de IAs</span>
          </Link>
        </header>

        <main className="app__content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/debate/:id"
              element={
                <AuthGate>
                  <Debate />
                </AuthGate>
              }
            />
            <Route
              path="/history"
              element={
                <AuthGate>
                  <History />
                </AuthGate>
              }
            />
            <Route path="*" element={<NaoEncontrado />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Layout />
    </AuthProvider>
  );
}
