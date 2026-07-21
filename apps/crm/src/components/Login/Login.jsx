// src/components/Login/Login.jsx
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import LogoMarca from '../LogoMarca/LogoMarca';
import './Login.css';

export default function Login() {
  const { entrar } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha]     = useState('');
  const [erro, setErro]       = useState(null);
  const [ent,  setEnt]        = useState(false);
  const [peek, setPeek]       = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErro(null);
    setEnt(true);
    const res = await entrar(usuario.trim().toLowerCase(), senha);
    setEnt(false);
    if (!res.ok) setErro('Usuário ou senha incorretos');
  }

  // Handlers que revelam a senha enquanto o botão estiver pressionado
  const mostrar = (e) => { e.preventDefault(); setPeek(true); };
  const esconder = () => setPeek(false);

  return (
    <div className="login">
      <div className="login__card">
        <div className="login__logo">
          <LogoMarca size={54} variant="full" />
        </div>
        <h1 className="login__titulo">CRM Verde Interior</h1>
        <p className="login__sub">Entre com seu usuário e senha</p>

        <form onSubmit={submit} className="login__form">
          <div className="login__campo">
            <label>Usuário</label>
            <input
              type="text"
              value={usuario}
              onChange={e => setUsuario(e.target.value)}
              placeholder="usuário"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
              autoFocus
            />
          </div>
          <div className="login__campo">
            <label>Senha</label>
            <div className="login__pwd-wrap">
              <input
                type={peek ? 'text' : 'password'}
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                className={`login__peek ${peek ? 'login__peek--on' : ''}`}
                aria-label="Mostrar senha enquanto pressionar"
                title="Segure para mostrar a senha"
                onMouseDown={mostrar}
                onMouseUp={esconder}
                onMouseLeave={esconder}
                onTouchStart={mostrar}
                onTouchEnd={esconder}
                onTouchCancel={esconder}
              >
                {peek ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {erro && <div className="login__erro">✕ {erro}</div>}

          <button
            className="login__btn"
            type="submit"
            disabled={ent || !usuario || !senha}
          >
            {ent ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="login__rodape">CRM Interno · Verde Interior</div>
      </div>
    </div>
  );
}
