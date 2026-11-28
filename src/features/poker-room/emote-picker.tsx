'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { EMOTES, EMOTE_COOLDOWN_MS, type EmoteId } from '../../poker/emotes.ts';
import NotoEmoji from './noto-emoji.tsx';

export default function EmotePicker({
  onSend,
  muted,
  onToggleMute,
  disabled = false,
}: {
  onSend: (emote: EmoteId) => void;
  muted: boolean;
  onToggleMute: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<EmoteId | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const rootRef = useRef<HTMLDivElement | null>(null);

  const cooling = cooldownUntil > now;
  const remaining = Math.max(0, cooldownUntil - now);

  useEffect(() => {
    if (!cooling) return;
    const id = setInterval(() => setNow(Date.now()), 80);
    return () => clearInterval(id);
  }, [cooling]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (open && rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (document.querySelector('dialog[open]')) return;
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function handleSelect(id: EmoteId) {
    if (disabled || cooling) return;
    const t = Date.now();
    setNow(t);
    setCooldownUntil(t + EMOTE_COOLDOWN_MS);
    setOpen(false);
    setHovered(null);
    onSend(id);
  }

  return (
    <div ref={rootRef} className="emote-dock">
      <AnimatePresence>
        {open && (
          <motion.div
            className="emote-popover"
            role="dialog"
            aria-label="Enviar reação animada"
            initial={{ opacity: 0, y: 12, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
          >
            <div className="emote-pop-head">
              <strong>Reações</strong>
              <button
                type="button"
                className={'emote-mute-btn' + (muted ? ' is-muted' : '')}
                onClick={onToggleMute}
                aria-pressed={muted}
                title={muted ? 'Mostrar reações dos jogadores' : 'Silenciar reações dos jogadores'}
              >
                {muted ? '🔇 Silenciado' : '🔔 Ativas'}
              </button>
            </div>

            <div className="emote-grid">
              {EMOTES.map((e) => (
                <motion.button
                  key={e.id}
                  type="button"
                  className="emote-item"
                  title={e.label}
                  aria-label={e.label}
                  disabled={disabled || cooling}
                  whileHover={{ scale: 1.14 }}
                  whileTap={{ scale: 0.92 }}
                  onMouseEnter={() => setHovered(e.id)}
                  onMouseLeave={() => setHovered((cur) => (cur === e.id ? null : cur))}
                  onFocus={() => setHovered(e.id)}
                  onBlur={() => setHovered((cur) => (cur === e.id ? null : cur))}
                  onClick={() => handleSelect(e.id)}
                >
                  <NotoEmoji id={e.id} size={40} play={hovered === e.id} />
                </motion.button>
              ))}
            </div>

            {cooling && (
              <div className="emote-coolbar" aria-live="polite">
                <span
                  style={{ width: `${Math.min(100, (remaining / EMOTE_COOLDOWN_MS) * 100)}%` }}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        className={'emote-fab' + (open ? ' is-open' : '') + (muted ? ' is-muted' : '')}
        aria-expanded={open}
        aria-label="Abrir reações animadas (atalho E)"
        title="Reações (E)"
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          <circle cx="9.5" cy="11" r=".8" fill="currentColor" stroke="none" />
          <circle cx="14.5" cy="11" r=".8" fill="currentColor" stroke="none" />
          <path d="M9.5 14.2c.8 1 2 1.5 3 1.5s2.2-.5 3-1.5" />
        </svg>
        <kbd className="emote-kbd" aria-hidden="true">
          E
        </kbd>
      </motion.button>
    </div>
  );
}
