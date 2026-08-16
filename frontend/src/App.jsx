/**
 * ============================================================================
 *  App — layout e rotas
 * ============================================================================
 * Sidebar fixa (gaveta no celular) + área de conteúdo com as três telas:
 * Home (fazer a pergunta), Debate (sala ao vivo) e History (debates antigos).
 */

import { useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar.jsx';
import Home from './pages/Home.jsx';
import Debate from './pages/Debate.jsx';
import History from './pages/History.jsx';

/** Tela para rotas inexistentes. */
function NaoEncontrado() {
  return (
    <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
      <h1>Página não encontrada</h1>
      <p className="muted">Essa rota não existe no Conselho de IAs.</p>
      <Link to="/" className="button button--primary" style={{ textDecoration: 'none' }}>
        Voltar ao início
      </Link>
    </div>
  );
}

export default function App() {
  const [menuAberto, setMenuAberto] = useState(false);
  const location = useLocation();

  // Fecha a gaveta ao trocar de página (comportamento esperado no mobile).
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
          <span className="topbar__title">⚖️ Conselho de IAs</span>
        </header>

        <main className="app__content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/debate/:id" element={<Debate />} />
            <Route path="/history" element={<History />} />
            <Route path="*" element={<NaoEncontrado />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
