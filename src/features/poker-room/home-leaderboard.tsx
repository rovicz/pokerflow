'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LEADERBOARD_CATEGORIES,
  categoryValue,
  type LeaderboardCategory,
  type LeaderboardRow,
} from '../../poker/leaderboard.ts';
import type { AvatarStyle } from '../../poker/avatars.ts';
import Avatar from './avatar';
import { IconTrophy } from './ui';
import { fmt } from './table';

export default function HomeLeaderboard() {
  const [category, setCategory] = useState<LeaderboardCategory>('matches_won');
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(`/api/leaderboard?category=${category}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { rows?: LeaderboardRow[] } | null) => {
        if (alive && body?.rows) setRows(body.rows.slice(0, 5));
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [category]);

  const cat = LEADERBOARD_CATEGORIES.find((c) => c.id === category) ?? LEADERBOARD_CATEGORIES[0];

  return (
    <section className="panel home-lb" aria-label="Ranking do clube">
      <div className="hlb-head">
        <div className="hlb-title">
          <span className="hlb-ico" aria-hidden="true">
            <IconTrophy />
          </span>
          <div>
            <div className="eyebrow">RANKING DO CLUBE</div>
            <h2>Top jogadores</h2>
          </div>
        </div>

        <div className="hlb-controls">
          <div className="hlb-tabs" role="tablist" aria-label="Categoria do ranking">
            {LEADERBOARD_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={category === c.id}
                className={category === c.id ? 'on' : ''}
                onClick={() => setCategory(c.id)}
              >
                {c.short}
              </button>
            ))}
          </div>
          <Link href="/ranking" className="hlb-all-link">
            Ver ranking completo →
          </Link>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <p className="hlb-empty">Carregando classificação…</p>
      ) : rows.length === 0 ? (
        <p className="hlb-empty">
          Nenhuma partida ranqueada ainda. Jogue com 2 ou mais amigos logados para inaugurar o
          pódio!
        </p>
      ) : (
        <div className="hlb-grid">
          {rows.map((r, i) => (
            <div key={r.username} className={`hlb-card is-p${i + 1}` + (r.isMe ? ' is-me' : '')}>
              <span className="hlb-rank">{i + 1}º</span>
              <Avatar
                a={{ style: r.avatarStyle as AvatarStyle, seed: r.avatarSeed }}
                name={r.displayName}
                size={38}
              />
              <div className="hlb-who">
                <b>{r.displayName}</b>
                <small>@{r.username}</small>
              </div>
              <div className="hlb-score">
                <strong>{fmt(categoryValue(r, category))}</strong>
                <small>{cat.unit}</small>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
