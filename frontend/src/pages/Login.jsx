/**
 * ============================================================================
 *  Login — entrar ou criar conta
 * ============================================================================
 * Dois caminhos: Google (um clique) e e-mail/senha. Mesmo visual do resto do
 * site: câmara de conselho, latão, serifada nos títulos.
 */

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthProvider.jsx';
import './Login.css';

/** Ícone do Google (SVG inline, sem biblioteca). */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1A6.2 6.2 0 0 1 12 5.8c1.6 0 2.9.6 3.7 1.4l2.7-2.6A9.7 9.7 0 0 0 12 2a10 10 0 1 0 0 20c5.8 0 9.6-4 9.6-9.7 0-.7-.1-1.2-.2-1.8H12z"
      />
    </svg>
  );
}

export default function Login() {
  const { entrarComGoogle, entrarComEmail, criarConta, recuperarSenha, habilitado } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const destino = location.state?.de ?? '/';

  const [modo, setModo] = useState('entrar'); // entrar | criar
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  async function executar(acao) {
    setErro(null);
    setAviso(null);
    setOcupado(true);
    try {
      await acao();
      navigate(destino, { replace: true });
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setOcupado(false);
    }
  }

  function enviarFormulario(evento) {
    evento.preventDefault();
    if (modo === 'entrar') {
      executar(() => entrarComEmail(email, senha));
    } else {
      executar(() => criarConta(nome, email, senha));
    }
  }

  async function esqueciSenha() {
    setErro(null);
    if (!email.trim()) {
      setErro('Digite seu e-mail para eu enviar o link de recuperação.');
      return;
    }
    try {
      await recuperarSenha(email);
      setAviso(`Enviei um link de recuperação para ${email.trim()}.`);
    } catch (falha) {
      setErro(falha.message);
    }
  }

  if (!habilitado) {
    return (
      <div className="login">
        <div className="login__card">
          <span className="eyebrow eyebrow--brass">login indisponível</span>
          <h1 className="login__title">Firebase não configurado</h1>
          <p className="muted">
            Preencha as variáveis <code>VITE_FIREBASE_*</code> no <code>.env</code> do frontend
            para ativar contas e histórico por usuário. Sem elas o site funciona em modo anônimo.
          </p>
          <Link to="/" className="button button--primary">
            Voltar ao início
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="login">
      <div className="login__card">
        <span className="login__mark" aria-hidden="true">
          ⚖
        </span>

        <span className="eyebrow eyebrow--brass">
          {modo === 'entrar' ? 'bem-vindo de volta' : 'criar conta'}
        </span>

        <h1 className="login__title">
          {modo === 'entrar' ? 'Entre no conselho' : 'Sua cadeira no conselho'}
        </h1>

        <p className="login__lead muted">
          {modo === 'entrar'
            ? 'Seus debates ficam salvos na sua conta, com transcrição e veredito.'
            : 'Crie uma conta para guardar seu histórico de debates separado de todo mundo.'}
        </p>

        <button
          type="button"
          className="login__google"
          onClick={() => executar(entrarComGoogle)}
          disabled={ocupado}
        >
          <GoogleIcon /> Continuar com Google
        </button>

        <div className="login__ou">
          <span />
          <em>ou com e-mail</em>
          <span />
        </div>

        <form className="login__form" onSubmit={enviarFormulario}>
          {modo === 'criar' && (
            <label className="login__campo">
              <span className="eyebrow">como quer ser chamado</span>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
                autoComplete="name"
                disabled={ocupado}
              />
            </label>
          )}

          <label className="login__campo">
            <span className="eyebrow">e-mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              autoComplete="email"
              required
              disabled={ocupado}
            />
          </label>

          <label className="login__campo">
            <span className="eyebrow">senha</span>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder={modo === 'criar' ? 'mínimo de 6 caracteres' : '••••••••'}
              autoComplete={modo === 'criar' ? 'new-password' : 'current-password'}
              required
              minLength={6}
              disabled={ocupado}
            />
          </label>

          {erro && (
            <div className="notice notice--danger">
              <span aria-hidden="true">⚠</span>
              <span>{erro}</span>
            </div>
          )}

          {aviso && (
            <div className="notice">
              <span aria-hidden="true">✉</span>
              <span>{aviso}</span>
            </div>
          )}

          <button type="submit" className="button button--primary login__enviar" disabled={ocupado}>
            {ocupado ? 'Só um instante…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <div className="login__rodape">
          {modo === 'entrar' ? (
            <>
              <button type="button" className="login__link" onClick={() => setModo('criar')}>
                Não tenho conta
              </button>
              <button type="button" className="login__link" onClick={esqueciSenha}>
                Esqueci a senha
              </button>
            </>
          ) : (
            <button type="button" className="login__link" onClick={() => setModo('entrar')}>
              Já tenho conta
            </button>
          )}
        </div>

        <Link to="/" className="login__voltar">
          ← voltar ao início
        </Link>
      </div>
    </div>
  );
}
