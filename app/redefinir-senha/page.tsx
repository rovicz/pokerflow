'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { createBrowserSupabase } from '../../src/lib/supabase/browser.ts';
import BrandLogo from '../../src/features/poker-room/brand-logo';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    const supabase = createBrowserSupabase();
    if (!supabase) {
      setError('Autenticação indisponível neste ambiente.');
      return;
    }
    setPending(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (err) {
      setError('Sessão de recuperação expirada. Solicite um novo link.');
      return;
    }
    setDone(true);
  }

  return (
    <main className="reset-page">
      <div className="panel reset-card">
        <div className="reset-brand">
          <BrandLogo variant="compact" />
        </div>
        <div className="eyebrow">RECUPERAÇÃO DE SENHA</div>
        <h1>{done ? 'Senha atualizada!' : 'Escolha uma nova senha'}</h1>

        {done ? (
          <div className="auth-confirm-box">
            <p>Sua senha foi alterada com sucesso. Você já pode entrar nas mesas do PokerFlow.</p>
            <Link href="/" className="primary wide reset-home-link">
              Voltar para o PokerFlow →
            </Link>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              Nova senha (mínimo 8 caracteres)
              <input
                type="password"
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label>
              Confirmar nova senha
              <input
                type="password"
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="primary wide" disabled={pending}>
              {pending ? 'Salvando…' : 'Salvar nova senha'}
            </button>
            <Link href="/" className="text-button auth-link">
              Voltar para a página inicial
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
