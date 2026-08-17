/**
 * ============================================================================
 *  App — layout e rotas
 * ============================================================================
 * Sidebar fixa (gaveta no celular) + área de conteúdo com as três telas:
 * Home (landing + pergunta), Debate (sala ao vivo) e History (arquivo).
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

export default function App() {
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
            <Route path="/debate/:id" element={<Debate />} />
            <Route path="/history" element={<History />} />
            <Route path="*" element={<NaoEncontrado />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
