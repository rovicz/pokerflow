'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../src/features/auth/use-auth';
import {
  LEADERBOARD_CATEGORIES,
  categoryValue,
  type LeaderboardCategory,
  type LeaderboardRow,
} from '../../src/poker/leaderboard.ts';
import type { AvatarStyle } from '../../src/poker/avatars.ts';
import Avatar from '../../src/features/poker-room/avatar';
import BrandLogo from '../../src/features/poker-room/brand-logo';
import { fmt } from '../../src/features/poker-room/table';

type LeaderboardPayload = {
  category: LeaderboardCategory;
  totalPlayers: number;
  rows: LeaderboardRow[];
  me: { rank: number; entry: LeaderboardRow } | null;
};

function winRate(won: number, played: number): string {
  if (!played) return '0%';
  return Math.round((won / played) * 100) + '%';
}

export default function RankingPage() {
  const { user, profile } = useAuth();
  const [category, setCategory] = useState<LeaderboardCategory>('matches_won');
  const [data, setData] = useState<LeaderboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

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
  const rest = rows.slice(3);

  return (
    <div className="ranking-shell">
      <header className="profile-topbar">
        <div className="profile-topbar-left">
          <Link href="/" className="brand" aria-label="PokerFlow — página inicial">
            <BrandLogo variant="compact" />
          </Link>
          <div className="game-meta">
            <span className="meta-pill accent">Ranking do Clube</span>
            {data && <span className="meta-pill hide-sm">{fmt(data.totalPlayers)} jogadores</span>}
          </div>
        </div>
        <div className="profile-topbar-right">
          {user && (
            <Link href="/perfil" className="outline profile-back-btn">
              {profile?.display_name || 'Meu perfil'}
            </Link>
          )}
          <Link href="/" className="outline profile-back-btn">
            ← Voltar para a mesa
          </Link>
        </div>
      </header>

      <main className="ranking-page">
        {/* Barra de categorias */}
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

        {/* Grid fluido 2 colunas em 100dvh */}
        <div className="rk-grid">
          {/* Esquerda: Pódio Top 3 + Tabela Classificatória */}
          <section className="panel rk-board-card">
            {loading && !data ? (
              <p className="rk-empty">Carregando classificação…</p>
            ) : rows.length === 0 ? (
              <div className="rk-empty-state">
                <div className="eyebrow">CLUBE ABERTO</div>
                <h2>Nenhuma partida ranqueada ainda</h2>
                <p>
                  Jogue mesas com pelo menos 2 jogadores humanos autenticados para registrar suas
                  vitórias e inaugurar o pódio!
                </p>
                <Link href="/" className="primary reset-home-link">
                  Abrir uma mesa agora →
                </Link>
              </div>
            ) : (
              <>
                <div className="rk-podium">
                  {[top3[1], top3[0], top3[2]].map((r, slot) => {
                    const place = slot === 1 ? 1 : slot === 0 ? 2 : 3;
                    if (!r) return <div key={place} className="rk-pod-slot is-empty" />;
                    return (
                      <div
                        key={r.username}
                        className={`rk-pod-slot is-p${place}` + (r.isMe ? ' is-me' : '')}
                      >
                        <span className="rk-medal">{place}º</span>
                        <Avatar
                          a={{ style: r.avatarStyle as AvatarStyle, seed: r.avatarSeed }}
                          name={r.displayName}
                          size={place === 1 ? 64 : 52}
                        />
                        <strong className="rk-pod-name">{r.displayName}</strong>
                        <small className="rk-pod-handle">@{r.username}</small>
                        <div className="rk-pod-score">
                          <b>{fmt(categoryValue(r, category))}</b>
                          <span>{catMeta.unit}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {rest.length > 0 && (
                  <div className="rk-table-wrap">
                    <table className="rk-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Jogador</th>
                          <th className="num">{catMeta.short}</th>
                          <th className="num hide-xs">Mãos</th>
                          <th className="num hide-sm">Aprov.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rest.map((r, i) => (
                          <tr key={r.username} className={r.isMe ? 'is-me' : ''}>
                            <td className="rk-pos">{i + 4}º</td>
                            <td>
                              <div className="rk-player-cell">
                                <Avatar
                                  a={{ style: r.avatarStyle as AvatarStyle, seed: r.avatarSeed }}
                                  name={r.displayName}
                                  size={28}
                                />
                                <div>
                                  <b>{r.displayName}</b>
                                  <small>@{r.username}</small>
                                </div>
                              </div>
                            </td>
                            <td className="num rk-main-val">{fmt(categoryValue(r, category))}</td>
                            <td className="num hide-xs">{fmt(r.handsPlayed)}</td>
                            <td className="num hide-sm">{winRate(r.handsWon, r.handsPlayed)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Direita: Sua Posição / CTA */}
          <aside className="panel rk-me-card">
            {user && data?.me ? (
              <>
                <div className="profile-card-head">
                  <div className="eyebrow">SUA POSIÇÃO</div>
                  <h2>
                    #{data.me.rank} <span className="rk-of-total">de {fmt(data.totalPlayers)}</span>
                  </h2>
                  <p>
                    Classificação atual em <b>{catMeta.label}</b>.
                  </p>
                </div>

                <div className="rk-me-hero">
                  <Avatar
                    a={{
                      style: data.me.entry.avatarStyle as AvatarStyle,
                      seed: data.me.entry.avatarSeed,
                    }}
                    name={data.me.entry.displayName}
                    size={54}
                  />
                  <div>
                    <strong>{data.me.entry.displayName}</strong>
                    <small>@{data.me.entry.username}</small>
                  </div>
                </div>

                <div className="rk-me-stats">
                  <div className="rk-stat-box">
                    <small>Partidas vencidas</small>
                    <b>{fmt(data.me.entry.matchesWon)}</b>
                  </div>
                  <div className="rk-stat-box">
                    <small>Banco acumulado</small>
                    <b>{fmt(data.me.entry.totalChipsWon)}</b>
                  </div>
                  <div className="rk-stat-box">
                    <small>Mãos vencidas</small>
                    <b>{fmt(data.me.entry.handsWon)}</b>
                  </div>
                  <div className="rk-stat-box">
                    <small>Maior pote</small>
                    <b>{fmt(data.me.entry.biggestPot)}</b>
                  </div>
                </div>

                <div className="rk-me-footer">
                  <span className="rk-rate-pill">
                    Aproveitamento em mãos:{' '}
                    <b>{winRate(data.me.entry.handsWon, data.me.entry.handsPlayed)}</b>
                  </span>
                  <Link href="/perfil" className="outline wide reset-home-link">
                    Personalizar meu perfil
                  </Link>
                </div>
              </>
            ) : (
              <div className="rk-guest-cta">
                <div className="eyebrow">DISPUTE O PÓDIO</div>
                <h2>Entre no ranking oficial</h2>
                <p>
                  Crie sua conta gratuita com e-mail confirmado para registrar automaticamente suas
                  vitórias, maior pote e banco acumulado em mesas contra amigos.
                </p>
                <ul className="rk-rules-list">
                  <li>Válido em mesas com 2 ou mais jogadores humanos.</li>
                  <li>Gravação 100% autoritativa no servidor (anti-fraude).</li>
                  <li>4 categorias independentes para disputar.</li>
                </ul>
                <Link href="/" className="primary wide reset-home-link">
                  {user ? 'Jogar uma mesa agora →' : 'Voltar e criar conta →'}
                </Link>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
