'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import {
  LEADERBOARD_CATEGORIES,
  categoryValue,
  type LeaderboardCategory,
  type LeaderboardRow,
} from '../../poker/leaderboard.ts';
import type { AvatarStyle } from '../../poker/avatars.ts';
import Avatar from './avatar';
import { fmt } from './table';

// Widget de ranking integrado sob o hero na tela inicial: mesmo visual .panel, abas .seg e pódio compacto (Top 3).
export default function HomeLeaderboard({
  initialRows = null,
}: {
  initialRows?: LeaderboardRow[] | null;
}) {
  const reducedMotion = useReducedMotion();
  const [category, setCategory] = useState<LeaderboardCategory>('matches_won');
  const [rows, setRows] = useState<LeaderboardRow[]>(initialRows ?? []);
  const [loading, setLoading] = useState(initialRows == null);
  const seeded = useRef(initialRows != null); // o servidor já entregou a aba inicial

  useEffect(() => {
    if (seeded.current && category === 'matches_won') {
      seeded.current = false;
      return;
    }
    seeded.current = false;
    setLoading(true);
    let alive = true;
    fetch(`/api/leaderboard?category=${category}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { rows?: LeaderboardRow[] } | null) => {
        if (alive && body?.rows) setRows(body.rows.slice(0, 3));
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
    <motion.aside
      className="panel home-lb-widget"
      aria-label="Ranking do clube"
      initial={reducedMotion ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="hlb-head">
        <div className="eyebrow">RANKING DO CLUBE</div>
        <Link href="/ranking" className="hlb-more">
          Ver ranking completo →
        </Link>
      </div>

      <div className="seg hlb-seg" role="tablist" aria-label="Categoria do ranking">
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

      <div className={'hlb-body' + (loading ? ' is-loading' : '')} aria-busy={loading}>
        {loading && rows.length === 0 ? (
          <ol className="hlb-list" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <li key={i} className="hlb-row is-skeleton" />
            ))}
          </ol>
        ) : rows.length === 0 ? (
          <p className="hlb-empty">Jogue com 2+ amigos logados para inaugurar o pódio do clube.</p>
        ) : (
          <ol className="hlb-list">
            {rows.map((r, i) => (
              <li key={r.username} className={`hlb-row is-p${i + 1}` + (r.isMe ? ' is-me' : '')}>
                <span className="hlb-pos">{i + 1}º</span>
                <Avatar
                  a={{ style: r.avatarStyle as AvatarStyle, seed: r.avatarSeed }}
                  name={r.displayName}
                  size={34}
                />
                <div className="hlb-who">
                  <b>{r.displayName}</b>
                  <small>@{r.username}</small>
                </div>
                <div className="hlb-score">
                  <strong>{fmt(categoryValue(r, category))}</strong>
                  <small>{cat.unit}</small>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </motion.aside>
  );
}
