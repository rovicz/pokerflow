'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../src/features/auth/use-auth';
import { AVATAR_LABELS, AVATAR_STYLES, type AvatarStyle } from '../../src/poker/avatars.ts';
import { DELETE_CONFIRM_WORD } from '../../src/auth/validation.ts';
import Avatar from '../../src/features/poker-room/avatar';
import BrandLogo from '../../src/features/poker-room/brand-logo';
import { fmt } from '../../src/features/poker-room/table';

const mkSeeds = () => Array.from({ length: 8 }, () => Math.random().toString(36).slice(2, 8));

function isAvatarStyle(v: string | undefined): v is AvatarStyle {
  return !!v && (AVATAR_STYLES as readonly string[]).includes(v);
}

export default function ProfilePage() {
  const router = useRouter();
  const { loading, user, profile, stats, refresh, signOut } = useAuth();

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
            {joinedAt && <span className="meta-pill hide-sm">Desde {joinedAt}</span>}
          </div>
        </div>
        <div className="profile-topbar-right">
          <Link href="/" className="outline profile-back-btn">
            ← Voltar para a mesa
          </Link>
          {user && (
            <button
              type="button"
              className="outline danger-ghost profile-signout"
              onClick={async () => {
                await signOut();
                router.push('/');
              }}
            >
              Sair da conta
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
            <Link href="/" className="primary reset-home-link">
              Ir para a página inicial →
            </Link>
          </section>
        ) : (
          <div className="profile-grid">
            {/* Coluna 1: Identidade & Avatar */}
            <section className="panel profile-card profile-identity-card">
              <div className="profile-card-head">
                <div>
                  <div className="eyebrow">IDENTIDADE NA MESA</div>
                  <h2>Perfil e avatar</h2>
                </div>
                <p>Escolha como seus amigos te veem em todas as salas.</p>
              </div>

              <div className="profile-preview-box">
                <Avatar
                  a={{ style: avatarStyle, seed: avatarSeed || displayName || 'player' }}
                  name={displayName || username || 'Jogador'}
                  size={66}
                />
                <div className="profile-preview-meta">
                  <strong>{displayName || username}</strong>
                  <span>@{username}</span>
                  <small>{user.email}</small>
                </div>
              </div>

              <form className="auth-form profile-identity-form" onSubmit={handleSaveProfile}>
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

                  <div className="seg" role="tablist" aria-label="Estilo do avatar">
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

                  <div className="profile-av-grid" role="radiogroup" aria-label="Opções de avatar">
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
                            size={54}
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
                <button
                  type="submit"
                  className="primary wide profile-save-btn"
                  disabled={savingProfile}
                >
                  {savingProfile ? 'Salvando…' : 'Salvar alterações'}
                </button>
              </form>
            </section>

            {/* Coluna 2: Estatísticas & Resumo da Conta */}
            <section className="panel profile-card profile-stats-card">
              <div className="profile-card-head">
                <div className="eyebrow">DESEMPENHO</div>
                <h2>Suas estatísticas</h2>
                <p>Base para futuros leaderboards e histórico permanente do clube.</p>
              </div>
              <div className="profile-stats-grid">
                <div className="pstat">
                  <small>Mãos jogadas</small>
                  <b>{fmt(stats?.hands_played ?? 0)}</b>
                </div>
                <div className="pstat">
                  <small>Mãos vencidas</small>
                  <b>{fmt(stats?.hands_won ?? 0)}</b>
                </div>
                <div className="pstat">
                  <small>Partidas vencidas</small>
                  <b>{fmt(stats?.matches_won ?? 0)}</b>
                </div>
                <div className="pstat">
                  <small>Maior pote</small>
                  <b>{fmt(stats?.biggest_pot ?? 0)}</b>
                </div>
              </div>
              <div className="profile-account-meta">
                <div className="pam-row">
                  <span>Status da conta</span>
                  <strong className="pam-verified">● E-mail confirmado</strong>
                </div>
                <div className="pam-row">
                  <span>E-mail</span>
                  <strong>{user.email}</strong>
                </div>
                {joinedAt && (
                  <div className="pam-row">
                    <span>Membro desde</span>
                    <strong>{joinedAt}</strong>
                  </div>
                )}
              </div>
            </section>

            {/* Coluna 3: Segurança & Zona de Perigo */}
            <div className="profile-side-col">
              <section className="panel profile-card profile-pw-card">
                <div className="profile-card-head">
                  <div className="eyebrow">SEGURANÇA</div>
                  <h2>Alterar senha</h2>
                  <p>Confirme sua senha atual antes de escolher uma nova.</p>
                </div>
                <form className="auth-form profile-pw-form" onSubmit={handleChangePassword}>
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
                  <label>
                    Nova senha (mínimo 8 caracteres)
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
                  <button
                    type="submit"
                    className="outline wide profile-save-btn"
                    disabled={savingPw}
                  >
                    {savingPw ? 'Atualizando…' : 'Atualizar senha'}
                  </button>
                </form>
              </section>

              <section className="panel profile-card profile-danger-card">
                <div className="profile-card-head">
                  <h2>Zona de perigo</h2>
                  <p>
                    Remove permanentemente seu perfil, avatar e estatísticas. Ação irreversível.
                  </p>
                </div>
                <button
                  type="button"
                  className="lm-danger wide"
                  onClick={() => {
                    setDeleteInput('');
                    setDeleteErr('');
                    deleteDialog.current?.showModal();
                  }}
                >
                  Excluir minha conta
                </button>
              </section>
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
    </div>
  );
}
