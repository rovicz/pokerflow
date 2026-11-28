'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../src/features/auth/use-auth';
import { AVATAR_LABELS, AVATAR_STYLES, type AvatarStyle } from '../../src/poker/avatars.ts';
import { DELETE_CONFIRM_WORD } from '../../src/auth/validation.ts';
import AuthModal from '../../src/features/auth/auth-modal';
import Avatar from '../../src/features/poker-room/avatar';
import BrandLogo from '../../src/features/poker-room/brand-logo';
import { fmt } from '../../src/features/poker-room/table';

const mkSeeds = () => Array.from({ length: 8 }, () => Math.random().toString(36).slice(2, 8));

function isAvatarStyle(v: string | undefined): v is AvatarStyle {
  return !!v && (AVATAR_STYLES as readonly string[]).includes(v);
}

export default function ProfilePage() {
  const router = useRouter();
  const { loading, enabled, user, profile, stats, refresh, signOut } = useAuth();
  const authDialog = useRef<HTMLDialogElement>(null);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [avatarStyle, setAvatarStyle] = useState<AvatarStyle>('lorelei');
  const [avatarSeed, setAvatarSeed] = useState('');
  const [seeds, setSeeds] = useState(mkSeeds);

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileErr, setProfileErr] = useState('');
  const [profileOk, setProfileOk] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwErr, setPwErr] = useState('');
  const [pwOk, setPwOk] = useState('');

  const deleteDialog = useRef<HTMLDialogElement>(null);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState('');

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name || '');
    setUsername(profile.username || '');
    setAvatarStyle(isAvatarStyle(profile.avatar_style) ? profile.avatar_style : 'lorelei');
    setAvatarSeed(profile.avatar_seed || profile.username || 'player');
  }, [profile]);

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setProfileErr('');
    setProfileOk('');
    setSavingProfile(true);
    try {
      const r = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName,
          username,
          avatar: { style: avatarStyle, seed: avatarSeed || displayName || username },
        }),
      });
      const body = (await r.json().catch(() => null)) as { error?: string } | null;
      if (!r.ok) {
        setProfileErr(body?.error || 'Não foi possível salvar seu perfil.');
        return;
      }
      await refresh();
      setProfileOk('Perfil atualizado! Seu novo avatar e nome já valem para as próximas mesas.');
    } catch {
      setProfileErr('Sem conexão com o servidor.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPwErr('');
    setPwOk('');
    if (newPassword.length < 8) {
      setPwErr('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwErr('A confirmação da nova senha não coincide.');
      return;
    }
    setSavingPw(true);
    try {
      const r = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = (await r.json().catch(() => null)) as { error?: string } | null;
      if (!r.ok) {
        setPwErr(body?.error || 'Não foi possível alterar sua senha.');
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwOk('Senha alterada com sucesso!');
    } catch {
      setPwErr('Sem conexão com o servidor.');
    } finally {
      setSavingPw(false);
    }
  }

  async function handleDeleteAccount(e: FormEvent) {
    e.preventDefault();
    setDeleteErr('');
    if (deleteInput.trim().toUpperCase() !== DELETE_CONFIRM_WORD) {
      setDeleteErr(`Digite ${DELETE_CONFIRM_WORD} para confirmar.`);
      return;
    }
    setDeleting(true);
    try {
      const r = await fetch('/api/profile', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: deleteInput }),
      });
      const body = (await r.json().catch(() => null)) as { error?: string } | null;
      if (!r.ok) {
        setDeleteErr(body?.error || 'Não foi possível excluir sua conta.');
        return;
      }
      deleteDialog.current?.close();
      await signOut();
      router.push('/');
    } catch {
      setDeleteErr('Sem conexão com o servidor.');
    } finally {
      setDeleting(false);
    }
  }

  const joinedAt = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <div className="profile-shell">
      <header className="profile-topbar">
        <div className="profile-topbar-left">
          <Link href="/" className="brand" aria-label="PokerFlow — página inicial">
            <BrandLogo variant="compact" />
          </Link>
          <div className="game-meta">
            <span className="meta-pill accent">Perfil</span>
            {username && <span className="meta-pill">@{username}</span>}
          </div>
        </div>
        <div className="profile-topbar-right">
          <Link href="/ranking" className="icon-btn topbar-link-btn" title="Ver ranking do clube">
            Ranking
          </Link>
          <Link href="/" className="icon-btn topbar-link-btn" title="Voltar para a mesa">
            <span aria-hidden="true">←</span> Voltar
          </Link>
          {user && (
            <button
              type="button"
              className="icon-btn danger-ghost"
              onClick={async () => {
                await signOut();
                router.push('/');
              }}
            >
              Sair
            </button>
          )}
        </div>
      </header>

      <main className="profile-page">
        {loading ? (
          <section className="panel profile-empty-card">
            <p className="lm-desc">Carregando seu perfil…</p>
          </section>
        ) : !user ? (
          <section className="panel profile-empty-card">
            <div className="eyebrow">CONTA POKERFLOW</div>
            <h1>Entre para gerenciar seu perfil</h1>
            <p className="lm-desc">
              A personalização permanente de avatar, estatísticas e configurações de segurança está
              disponível para contas autenticadas.
            </p>
            {enabled ? (
              <div className="profile-empty-actions">
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    setAuthView('login');
                    authDialog.current?.showModal();
                  }}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  className="outline"
                  onClick={() => {
                    setAuthView('register');
                    authDialog.current?.showModal();
                  }}
                >
                  Criar conta
                </button>
              </div>
            ) : (
              <Link href="/" className="outline reset-home-link">
                Ir para a página inicial
              </Link>
            )}
          </section>
        ) : (
          <div className="profile-layout">
            {/* Hero Banner: Identidade + 4 KPIs horizontais + atalho direto para o Ranking */}
            <section className="panel profile-banner">
              <div className="pb-identity">
                <div className="pb-avatar-ring">
                  <Avatar
                    a={{ style: avatarStyle, seed: avatarSeed || displayName || 'player' }}
                    name={displayName || username || 'Jogador'}
                    size={72}
                  />
                </div>
                <div className="pb-meta">
                  <div className="pb-title-row">
                    <h1>{displayName || username}</h1>
                    <span className="pb-verified">● Verificado</span>
                  </div>
                  <div className="pb-sub-row">
                    <span className="pb-handle">@{username}</span>
                    <span aria-hidden="true">·</span>
                    <span>{user.email}</span>
                    {joinedAt && (
                      <>
                        <span className="hide-sm" aria-hidden="true">
                          ·
                        </span>
                        <span className="hide-sm">Membro desde {joinedAt}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="pb-kpis">
                <div className="pb-kpi">
                  <small>Mãos jogadas</small>
                  <b>{fmt(stats?.hands_played ?? 0)}</b>
                </div>
                <div className="pb-kpi">
                  <small>Mãos vencidas</small>
                  <b>{fmt(stats?.hands_won ?? 0)}</b>
                </div>
                <div className="pb-kpi">
                  <small>Partidas vencidas</small>
                  <b>{fmt(stats?.matches_won ?? 0)}</b>
                </div>
                <div className="pb-kpi">
                  <small>Maior pote</small>
                  <b>{fmt(stats?.biggest_pot ?? 0)}</b>
                </div>
                <Link href="/ranking" className="pb-ranking-cta">
                  <span>Ver Ranking</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </section>

            {/* Grid principal balanceado em 2 colunas (sem buracos vazios) */}
            <div className="profile-columns">
              <section className="panel profile-card">
                <div className="profile-card-head">
                  <div className="eyebrow">IDENTIDADE NA MESA</div>
                  <h2>Personalizar perfil e avatar</h2>
                  <p>Seu nome e avatar aparecem automaticamente ao criar ou entrar em salas.</p>
                </div>

                <form className="auth-form" onSubmit={handleSaveProfile}>
                  <div className="profile-name-fields">
                    <label>
                      Nome de exibição
                      <input
                        type="text"
                        required
                        minLength={2}
                        maxLength={24}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                      />
                    </label>
                    <label>
                      Apelido único (@)
                      <input
                        type="text"
                        required
                        minLength={3}
                        maxLength={20}
                        pattern="[a-zA-Z0-9_]{3,20}"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                    </label>
                  </div>

                  <div className="profile-avatar-picker">
                    <div className="between">
                      <span className="field-lbl">Estilo do avatar</span>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setSeeds(mkSeeds())}
                      >
                        Sortear outros
                      </button>
                    </div>

                    <div
                      className="profile-style-tabs"
                      role="tablist"
                      aria-label="Estilo do avatar"
                    >
                      {AVATAR_STYLES.map((st) => (
                        <button
                          key={st}
                          type="button"
                          role="tab"
                          aria-selected={avatarStyle === st}
                          className={avatarStyle === st ? 'on' : ''}
                          onClick={() => setAvatarStyle(st)}
                        >
                          {AVATAR_LABELS[st]}
                        </button>
                      ))}
                    </div>

                    <div
                      className="profile-av-grid"
                      role="radiogroup"
                      aria-label="Opções de avatar"
                    >
                      {seeds.map((sd) => {
                        const selected = avatarSeed === sd;
                        return (
                          <button
                            key={sd}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            className={'av-opt' + (selected ? ' on' : '')}
                            onClick={() => setAvatarSeed(sd)}
                          >
                            <Avatar
                              a={{ style: avatarStyle, seed: sd }}
                              name={displayName}
                              size={52}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {profileErr && (
                    <p className="error" role="alert">
                      {profileErr}
                    </p>
                  )}
                  {profileOk && (
                    <p className="notice" role="status">
                      {profileOk}
                    </p>
                  )}
                  <button type="submit" className="primary wide" disabled={savingProfile}>
                    {savingProfile ? 'Salvando…' : 'Salvar alterações'}
                  </button>
                </form>
              </section>

              <div className="profile-security-col">
                <section className="panel profile-card">
                  <div className="profile-card-head">
                    <div className="eyebrow">SEGURANÇA</div>
                    <h2>Alterar senha</h2>
                    <p>Confirme sua senha atual antes de escolher uma nova.</p>
                  </div>
                  <form className="auth-form" onSubmit={handleChangePassword}>
                    <label>
                      Senha atual
                      <input
                        type="password"
                        required
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                    </label>
                    <div className="profile-name-fields">
                      <label>
                        Nova senha (8+ chars)
                        <input
                          type="password"
                          required
                          minLength={8}
                          maxLength={72}
                          autoComplete="new-password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
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
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                      </label>
                    </div>
                    {pwErr && (
                      <p className="error" role="alert">
                        {pwErr}
                      </p>
                    )}
                    {pwOk && (
                      <p className="notice" role="status">
                        {pwOk}
                      </p>
                    )}
                    <button type="submit" className="outline wide" disabled={savingPw}>
                      {savingPw ? 'Atualizando…' : 'Atualizar senha'}
                    </button>
                  </form>
                </section>

                <section className="panel profile-card profile-danger-card">
                  <div className="profile-danger-row">
                    <div className="profile-card-head">
                      <h2>Zona de perigo</h2>
                      <p>
                        Apaga permanentemente sua conta, avatar salvo e estatísticas do ranking.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="lm-danger"
                      onClick={() => {
                        setDeleteInput('');
                        setDeleteErr('');
                        deleteDialog.current?.showModal();
                      }}
                    >
                      Excluir conta
                    </button>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal de confirmação definitiva de exclusão de conta */}
      <dialog
        ref={deleteDialog}
        className="modal leave-modal"
        aria-labelledby="del-account-title"
        onClick={(e) => e.target === deleteDialog.current && deleteDialog.current?.close()}
      >
        <div className="lm-head">
          <span className="lm-ico" aria-hidden="true">
            !
          </span>
          <div>
            <h2 id="del-account-title">Excluir conta permanentemente?</h2>
            <p className="lm-desc">
              Todos os seus dados de perfil e estatísticas serão apagados e não poderão ser
              recuperados. Para confirmar, digite <b>{DELETE_CONFIRM_WORD}</b> abaixo.
            </p>
          </div>
        </div>
        <form className="auth-form del-confirm-form" onSubmit={handleDeleteAccount}>
          <input
            type="text"
            placeholder={`Digite ${DELETE_CONFIRM_WORD}`}
            value={deleteInput}
            onChange={(e) => setDeleteInput(e.target.value)}
            autoFocus
          />
          {deleteErr && (
            <p className="error" role="alert">
              {deleteErr}
            </p>
          )}
          <div className="lm-actions">
            <button type="button" className="outline" onClick={() => deleteDialog.current?.close()}>
              Cancelar
            </button>
            <button
              type="submit"
              className="lm-danger"
              disabled={deleting || deleteInput.trim().toUpperCase() !== DELETE_CONFIRM_WORD}
            >
              {deleting ? 'Excluindo…' : 'Excluir permanentemente'}
            </button>
          </div>
        </form>
      </dialog>
      <AuthModal dialogRef={authDialog} initialView={authView} />
    </div>
  );
}
