'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../src/features/auth/use-auth';
import {
  LEADERBOARD_CATEGORIES,
  categoryValue,
  type LeaderboardCategory,
  type LeaderboardRow,
} from '../../src/poker/leaderboard.ts';
import type { AvatarStyle } from '../../src/poker/avatars.ts';
import AuthModal from '../../src/features/auth/auth-modal';
import Avatar from '../../src/features/poker-room/avatar';
import BrandLogo from '../../src/features/poker-room/brand-logo';
import { fmt } from '../../src/features/poker-room/table';

type LeaderboardPayload = {
  category: LeaderboardCategory;
  totalPlayers: number;
  rows: LeaderboardRow[];
  me: { rank: number; entry: LeaderboardRow } | null;
};

function winRateNum(won: number, played: number): number {
  if (!played) return 0;
  return Math.round((won / played) * 100);
}

export default function RankingPage() {
  const { user, profile, enabled } = useAuth();
  const authDialog = useRef<HTMLDialogElement>(null);
  const [category, setCategory] = useState<LeaderboardCategory>('matches_won');
  const [data, setData] = useState<LeaderboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/leaderboard?category=${category}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: LeaderboardPayload | null) => {
        if (alive && body) setData(body);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [category]);

  const catMeta =
    LEADERBOARD_CATEGORIES.find((c) => c.id === category) ?? LEADERBOARD_CATEGORIES[0];
  const rows = data?.rows ?? [];
  const top3 = rows.slice(0, 3);

  const rankedRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .map((row, idx) => ({ row, rank: idx + 1 }))
      .filter(
        ({ row }) =>
          !q || row.displayName.toLowerCase().includes(q) || row.username.toLowerCase().includes(q),
      );
  }, [rows, query]);

  const myRate = data?.me ? winRateNum(data.me.entry.handsWon, data.me.entry.handsPlayed) : 0;

  return (
    <div className="ranking-shell">
      <header className="profile-topbar">
        <div className="profile-topbar-left">
          <Link href="/" className="brand" aria-label="PokerFlow — página inicial">
            <BrandLogo variant="compact" />
          </Link>
          <div className="game-meta">
            <span className="meta-pill accent">Ranking do Clube</span>
            {data && (
              <span className="meta-pill hide-sm">
                {fmt(data.totalPlayers)} {data.totalPlayers === 1 ? 'jogador' : 'jogadores'}
              </span>
            )}
          </div>
        </div>
        <div className="profile-topbar-right">
          {user && (
            <Link href="/perfil" className="rk-user-pill">
              <Avatar
                a={{
                  style: (profile?.avatar_style || 'adventurer') as AvatarStyle,
                  seed: profile?.avatar_seed || user.id,
                }}
                name={profile?.display_name || 'Perfil'}
                size={22}
              />
              <span>{profile?.display_name || 'Meu perfil'}</span>
            </Link>
          )}
          <Link href="/" className="icon-btn topbar-link-btn" title="Voltar para a mesa">
            <span aria-hidden="true">←</span> Voltar
          </Link>
        </div>
      </header>

      <main className="ranking-page">
        {/* Cabeçalho editorial + seletor de categorias */}
        <div className="rk-head">
          <div className="rk-title-block">
            <div className="eyebrow">LEADERBOARD OFICIAL · MESAS COM 2+ HUMANOS</div>
            <h1>{catMeta.label}</h1>
            <p>{catMeta.desc}</p>
          </div>
          <div className="rk-tabs" role="tablist" aria-label="Categoria do ranking">
            {LEADERBOARD_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={category === c.id}
                className={category === c.id ? 'on' : ''}
                onClick={() => setCategory(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid equilibrada 2 colunas sem vazios mortos */}
        <div className="rk-grid">
          {/* Esquerda: Pódio Top 3 + Tabela Completa */}
          <div className="rk-main">
            <section className="panel rk-podium-card" aria-label="Pódio do clube">
              <div className="rk-section-head">
                <div>
                  <div className="eyebrow">PÓDIO DO CLUBE</div>
                  <h2>Top 3 em {catMeta.label}</h2>
                </div>
                <span className="rk-badge-subtle">
                  {rows.length} {rows.length === 1 ? 'classificado' : 'classificados'}
                </span>
              </div>

              {loading && !data ? (
                <p className="rk-empty">Carregando classificação…</p>
              ) : rows.length === 0 ? (
                <div className="rk-empty-state">
                  <div className="eyebrow">CLUBE ABERTO</div>
                  <h3>Nenhuma partida ranqueada ainda</h3>
                  <p>
                    Jogue mesas com pelo menos 2 jogadores humanos autenticados para registrar suas
                    vitórias e inaugurar o pódio.
                  </p>
                  <Link href="/" className="primary reset-home-link">
                    Abrir uma mesa agora →
                  </Link>
                </div>
              ) : (
                <div className="rk-podium">
                  {[top3[1], top3[0], top3[2]].map((r, slot) => {
                    const place = slot === 1 ? 1 : slot === 0 ? 2 : 3;
                    if (!r) {
                      return (
                        <div key={place} className={`rk-pod-slot is-vacant is-p${place}`}>
                          <span className="rk-medal">{place}º</span>
                          <div className="rk-vacant-ring" aria-hidden="true">
                            ?
                          </div>
                          <strong className="rk-pod-name">Vaga aberta</strong>
                          <small className="rk-pod-handle">Convide amigos para o pódio</small>
                        </div>
                      );
                    }
                    const rate = winRateNum(r.handsWon, r.handsPlayed);
                    return (
                      <div
                        key={r.username}
                        className={`rk-pod-slot is-p${place}` + (r.isMe ? ' is-me' : '')}
                      >
                        <span className="rk-medal">{place}º</span>
                        <div className="rk-pod-av">
                          <Avatar
                            a={{ style: r.avatarStyle as AvatarStyle, seed: r.avatarSeed }}
                            name={r.displayName}
                            size={place === 1 ? 68 : 54}
                          />
                        </div>
                        <strong className="rk-pod-name">{r.displayName}</strong>
                        <small className="rk-pod-handle">@{r.username}</small>
                        <div className="rk-pod-score">
                          <b>{fmt(categoryValue(r, category))}</b>
                          <span>{catMeta.unit}</span>
                        </div>
                        <span className="rk-pod-sub">
                          {rate}% aprov. · {fmt(r.handsPlayed)} mãos
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Tabela Classificatória Completa (sempre visível quando houver jogadores) */}
            {rows.length > 0 && (
              <section className="panel rk-table-card" aria-label="Classificação geral">
                <div className="rk-section-head">
                  <div>
                    <div className="eyebrow">CLASSIFICAÇÃO GERAL</div>
                    <h2>Todos os jogadores</h2>
                  </div>
                  {rows.length >= 4 && (
                    <input
                      type="search"
                      className="rk-search"
                      placeholder="Filtrar por nome ou @…"
                      aria-label="Filtrar jogadores no ranking"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  )}
                </div>

                <div className="rk-table-wrap">
                  <table className="rk-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Jogador</th>
                        <th className="num is-active-col">{catMeta.short}</th>
                        {category !== 'matches_won' && <th className="num hide-sm">Partidas</th>}
                        {category !== 'total_chips_won' && <th className="num hide-sm">Fichas</th>}
                        <th className="num hide-xs">Mãos</th>
                        <th className="num hide-xs">Aprov.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankedRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="rk-no-match">
                            Nenhum jogador encontrado para “{query}”.
                          </td>
                        </tr>
                      ) : (
                        rankedRows.map(({ row: r, rank }) => (
                          <tr key={r.username} className={r.isMe ? 'is-me' : ''}>
                            <td className="rk-pos">
                              <span className={rank <= 3 ? `rk-rank-pill is-p${rank}` : ''}>
                                {rank}º
                              </span>
                            </td>
                            <td>
                              <div className="rk-player-cell">
                                <Avatar
                                  a={{ style: r.avatarStyle as AvatarStyle, seed: r.avatarSeed }}
                                  name={r.displayName}
                                  size={32}
                                />
                                <div>
                                  <span className="rk-name-row">
                                    <b>{r.displayName}</b>
                                    {r.isMe && <em className="rk-you-tag">Você</em>}
                                  </span>
                                  <small>@{r.username}</small>
                                </div>
                              </div>
                            </td>
                            <td className="num rk-main-val">{fmt(categoryValue(r, category))}</td>
                            {category !== 'matches_won' && (
                              <td className="num hide-sm">{fmt(r.matchesWon)}</td>
                            )}
                            {category !== 'total_chips_won' && (
                              <td className="num hide-sm">{fmt(r.totalChipsWon)}</td>
                            )}
                            <td className="num hide-xs">{fmt(r.handsPlayed)}</td>
                            <td className="num hide-xs">
                              {winRateNum(r.handsWon, r.handsPlayed)}%
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>

          {/* Direita: Sua Posição + Regras do Clube */}
          <aside className="rk-side">
            <div className="panel rk-me-card">
              {user && data?.me ? (
                <>
                  <div className="rk-me-top">
                    <div>
                      <div className="eyebrow">SUA POSIÇÃO</div>
                      <h2>
                        #{data.me.rank}{' '}
                        <span className="rk-of-total">de {fmt(data.totalPlayers)}</span>
                      </h2>
                    </div>
                    <span className="rk-cat-chip">{catMeta.short}</span>
                  </div>

                  <div className="rk-me-hero">
                    <Avatar
                      a={{
                        style: data.me.entry.avatarStyle as AvatarStyle,
                        seed: data.me.entry.avatarSeed,
                      }}
                      name={data.me.entry.displayName}
                      size={48}
                    />
                    <div className="rk-me-id">
                      <strong>{data.me.entry.displayName}</strong>
                      <small>@{data.me.entry.username}</small>
                    </div>
                  </div>

                  <div className="rk-me-stats">
                    <div
                      className={'rk-stat-box' + (category === 'matches_won' ? ' is-active' : '')}
                    >
                      <small>Partidas vencidas</small>
                      <b>{fmt(data.me.entry.matchesWon)}</b>
                    </div>
                    <div
                      className={
                        'rk-stat-box' + (category === 'total_chips_won' ? ' is-active' : '')
                      }
                    >
                      <small>Banco acumulado</small>
                      <b>{fmt(data.me.entry.totalChipsWon)}</b>
                    </div>
                    <div className={'rk-stat-box' + (category === 'hands_won' ? ' is-active' : '')}>
                      <small>Mãos vencidas</small>
                      <b>{fmt(data.me.entry.handsWon)}</b>
                    </div>
                    <div
                      className={'rk-stat-box' + (category === 'biggest_pot' ? ' is-active' : '')}
                    >
                      <small>Maior pote</small>
                      <b>{fmt(data.me.entry.biggestPot)}</b>
                    </div>
                  </div>

                  <div className="rk-rate-block">
                    <div className="rk-rate-head">
                      <span>Aproveitamento em mãos</span>
                      <b>{myRate}%</b>
                    </div>
                    <div className="rk-progress" aria-hidden="true">
                      <span style={{ width: `${Math.min(100, myRate)}%` }} />
                    </div>
                  </div>

                  <Link href="/perfil" className="outline wide reset-home-link">
                    Personalizar meu perfil
                  </Link>
                </>
              ) : (
                <div className="rk-guest-cta">
                  <div className="eyebrow">DISPUTE O PÓDIO</div>
                  <h2>Entre no ranking oficial</h2>
                  <p>
                    Crie sua conta gratuita com e-mail confirmado para registrar automaticamente
                    suas vitórias, maior pote e banco acumulado em mesas contra amigos.
                  </p>
                  {user || !enabled ? (
                    <Link href="/" className="outline wide reset-home-link">
                      Jogar uma mesa agora
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="outline wide"
                      onClick={() => authDialog.current?.showModal()}
                    >
                      Entrar ou criar conta
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="panel rk-info-card">
              <div className="eyebrow">REGRAS OFICIAIS</div>
              <h3>Como funciona a pontuação</h3>
              <ul className="rk-rules-list">
                <li>
                  Contabiliza automaticamente mesas com <b>2+ jogadores humanos</b> autenticados.
                </li>
                <li>Mesas solo contra bots não alteram o ranking do clube (anti-farm).</li>
                <li>Gravação 100% autoritativa no servidor ao fim de cada mão e partida.</li>
              </ul>
              <Link href="/" className="outline wide reset-home-link">
                Abrir uma mesa
              </Link>
            </div>
          </aside>
        </div>
      </main>
      <AuthModal dialogRef={authDialog} initialView="login" />
    </div>
  );
}
