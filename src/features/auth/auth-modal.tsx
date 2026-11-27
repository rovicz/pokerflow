'use client';
import { useEffect, useState, type FormEvent, type RefObject } from 'react';
import { useAuth } from './use-auth';

type View = 'login' | 'register' | 'confirm' | 'forgot' | 'forgot-sent';

export default function AuthModal({
  dialogRef,
  initialView = 'login',
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  initialView?: 'login' | 'register';
}) {
  const { signIn } = useAuth();
  const [view, setView] = useState<View>(initialView);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resendLeft, setResendLeft] = useState(0);
  const [resendMsg, setResendMsg] = useState('');

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  useEffect(() => {
    if (resendLeft <= 0) return;
    const t = setInterval(() => setResendLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [resendLeft]);

  function resetMessages() {
    setError('');
    setUnconfirmed(false);
    setResendMsg('');
  }

  function switchView(next: View) {
    resetMessages();
    setView(next);
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    resetMessages();
    setPending(true);
    const res = await signIn(email, password);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      setUnconfirmed(!!res.unconfirmed);
      return;
    }
    setPassword('');
    dialogRef.current?.close();
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    resetMessages();
    setPending(true);
    try {
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      const body = (await r.json().catch(() => null)) as { error?: string } | null;
      if (!r.ok) {
        setError(body?.error || 'Não foi possível criar sua conta.');
        return;
      }
      setPassword('');
      setResendLeft(60);
      setView('confirm');
    } catch {
      setError('Sem conexão com o servidor.');
    } finally {
      setPending(false);
    }
  }

  async function handleResend() {
    if (resendLeft > 0 || pending || !email.trim()) return;
    setError('');
    setResendMsg('');
    setPending(true);
    try {
      const r = await fetch('/api/auth/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = (await r.json().catch(() => null)) as { error?: string } | null;
      if (!r.ok) {
        setError(body?.error || 'Não foi possível reenviar.');
        return;
      }
      setResendLeft(60);
      setResendMsg('E-mail reenviado! Verifique sua caixa de entrada e spam.');
    } catch {
      setError('Sem conexão com o servidor.');
    } finally {
      setPending(false);
    }
  }

  async function handleForgot(e: FormEvent) {
    e.preventDefault();
    resetMessages();
    setPending(true);
    try {
      const r = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = (await r.json().catch(() => null)) as { error?: string } | null;
      if (!r.ok) {
        setError(body?.error || 'Não foi possível enviar o link.');
        return;
      }
      setView('forgot-sent');
    } catch {
      setError('Sem conexão com o servidor.');
    } finally {
      setPending(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal auth-modal"
      aria-labelledby="auth-modal-title"
      onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}
    >
      <div className="between auth-modal-head">
        <div>
          <div className="eyebrow">CONTA POKERFLOW</div>
          <h2 id="auth-modal-title">
            {view === 'login'
              ? 'Entrar na sua conta'
              : view === 'register'
                ? 'Criar conta gratuita'
                : view === 'confirm'
                  ? 'Confirme seu e-mail'
                  : view === 'forgot'
                    ? 'Recuperar senha'
                    : 'Link enviado'}
          </h2>
        </div>
        <button
          type="button"
          className="hh-close"
          aria-label="Fechar"
          onClick={() => dialogRef.current?.close()}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {(view === 'login' || view === 'register') && (
        <div className="seg auth-seg" role="tablist" aria-label="Entrar ou criar conta">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'login'}
            className={view === 'login' ? 'on' : ''}
            onClick={() => switchView('login')}
          >
            Entrar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'register'}
            className={view === 'register' ? 'on' : ''}
            onClick={() => switchView('register')}
          >
            Criar conta
          </button>
        </div>
      )}

      {view === 'login' && (
        <form className="auth-form" onSubmit={handleLogin}>
          <label>
            E-mail
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="voce@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              required
              autoComplete="current-password"
              placeholder="Sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {unconfirmed && (
            <button
              type="button"
              className="outline wide"
              disabled={pending || resendLeft > 0}
              onClick={handleResend}
            >
              {resendLeft > 0
                ? `Reenviar confirmação em ${resendLeft}s`
                : 'Reenviar e-mail de confirmação'}
            </button>
          )}
          {resendMsg && <p className="notice">{resendMsg}</p>}
          <button type="submit" className="primary wide" disabled={pending}>
            {pending ? 'Entrando…' : 'Entrar'}
          </button>
          <button
            type="button"
            className="text-button auth-link"
            onClick={() => switchView('forgot')}
          >
            Esqueci minha senha
          </button>
        </form>
      )}

      {view === 'register' && (
        <form className="auth-form" onSubmit={handleRegister}>
          <label>
            Apelido único
            <input
              type="text"
              required
              minLength={3}
              maxLength={20}
              pattern="[a-zA-Z0-9_]{3,20}"
              autoComplete="username"
              placeholder="ex: victor_poker"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label>
            E-mail
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="voce@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Senha (mínimo 8 caracteres)
            <input
              type="password"
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              placeholder="Crie uma senha forte"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="primary wide" disabled={pending}>
            {pending ? 'Criando conta…' : 'Criar conta e confirmar e-mail'}
          </button>
        </form>
      )}

      {view === 'confirm' && (
        <div className="auth-confirm-box">
          <div className="auth-mail-ico" aria-hidden="true">
            ✉
          </div>
          <p>
            Enviamos um link de confirmação para <b>{email}</b>. Clique no link do e-mail para
            ativar sua conta e entrar automaticamente no PokerFlow.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {resendMsg && <p className="notice">{resendMsg}</p>}
          <button
            type="button"
            className="outline wide"
            disabled={pending || resendLeft > 0}
            onClick={handleResend}
          >
            {resendLeft > 0
              ? `Reenviar e-mail em ${resendLeft}s`
              : 'Reenviar e-mail de confirmação'}
          </button>
          <button
            type="button"
            className="text-button auth-link"
            onClick={() => switchView('login')}
          >
            Já confirmei — ir para o login
          </button>
        </div>
      )}

      {view === 'forgot' && (
        <form className="auth-form" onSubmit={handleForgot}>
          <p className="lm-desc">
            Informe o e-mail da sua conta e enviaremos um link para redefinir sua senha.
          </p>
          <label>
            E-mail
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="voce@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="primary wide" disabled={pending}>
            {pending ? 'Enviando…' : 'Enviar link de recuperação'}
          </button>
          <button
            type="button"
            className="text-button auth-link"
            onClick={() => switchView('login')}
          >
            Voltar para o login
          </button>
        </form>
      )}

      {view === 'forgot-sent' && (
        <div className="auth-confirm-box">
          <div className="auth-mail-ico" aria-hidden="true">
            ✉
          </div>
          <p>
            Se existir uma conta cadastrada com <b>{email}</b>, você receberá um link de recuperação
            em instantes.
          </p>
          <button type="button" className="primary wide" onClick={() => dialogRef.current?.close()}>
            Fechar
          </button>
        </div>
      )}
    </dialog>
  );
}
