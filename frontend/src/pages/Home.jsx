/**
 * ============================================================================
 *  Home — tela principal
 * ============================================================================
 * Pergunta + botão "Iniciar debate". Ao criar o debate, navega para a sala
 * onde o chat em grupo acontece em tempo real.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QuestionForm } from '../components/QuestionForm.jsx';
import { AgentRoster } from '../components/AgentRoster.jsx';
import { useBackendStatus } from '../hooks/useBackendStatus.js';
import { api } from '../services/api.js';
import './Home.css';

const ETAPAS = [
  {
    numero: 1,
    titulo: 'Respostas independentes',
    texto: 'Cada IA responde sozinha, sem ver o que as outras escreveram.',
  },
  {
    numero: 2,
    titulo: 'Debate cruzado',
    texto: 'Todas leem as respostas alheias, apontam concordâncias e contestam o resto.',
  },
  {
    numero: 3,
    titulo: 'Veredito',
    texto: 'Um juiz consolida tudo: resposta final, nível de confiança e o que ficou em aberto.',
  },
];

export default function Home() {
  const navigate = useNavigate();
  const backend = useBackendStatus();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  async function iniciarDebate(pergunta) {
    setEnviando(true);
    setErro(null);

    try {
      const debate = await api.startDebate(pergunta);
      navigate(`/debate/${debate.id}`);
    } catch (error) {
      setErro(error.message);
      setEnviando(false);
    }
  }

  return (
    <div className="home">
      <div className="home__inner">
        <header className="home__hero">
          <span className="chip chip--accent">debate multiagente em tempo real</span>
          <h1 className="home__title">
            Uma pergunta.
            <br />
            Várias IAs. <span className="home__title-accent">Um veredito.</span>
          </h1>
          <p className="home__subtitle">
            O conselho responde em três rodadas: cada IA pensa sozinha, depois todas debatem
            entre si e, no fim, um juiz consolida a resposta com nível de confiança.
          </p>
        </header>

        {!backend.loading && !backend.online && (
          <div className="alert alert--danger">
            <span aria-hidden="true">⚠️</span>
            <div>
              <strong>Backend offline.</strong>
              <p style={{ margin: '0.25rem 0 0' }}>
                Não consegui falar com <code>{backend.url}</code>. Suba o backend
                (<code>npm run dev</code> na pasta <code>backend</code>) ou ajuste
                <code> VITE_BACKEND_URL</code>.
              </p>
            </div>
          </div>
        )}

        {backend.mockMode && (
          <div className="alert">
            <span aria-hidden="true">🧪</span>
            <div>
              <strong>Modo simulado ligado.</strong>
              <p style={{ margin: '0.25rem 0 0' }}>
                O backend está com <code>MOCK_AI=true</code>: as respostas são fictícias.
                Coloque suas chaves no <code>.env</code> e mude para <code>false</code> para
                ativar as IAs reais.
              </p>
            </div>
          </div>
        )}

        <section className="card home__form">
          <QuestionForm onSubmit={iniciarDebate} loading={enviando} error={erro} />
        </section>

        <section className="home__steps">
          {ETAPAS.map((etapa) => (
            <article className="home__step" key={etapa.numero}>
              <span className="home__step-number">{etapa.numero}</span>
              <h3>{etapa.titulo}</h3>
              <p className="muted">{etapa.texto}</p>
            </article>
          ))}
        </section>

        <AgentRoster />
      </div>
    </div>
  );
}
