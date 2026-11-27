'use client';
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { EMOTE_MAP, notoLottieUrl, type EmoteId } from '../../poker/emotes.ts';

const lottieCache = new Map<string, Promise<Record<string, unknown> | null>>();

function loadNotoJson(codepoint: string): Promise<Record<string, unknown> | null> {
  const cached = lottieCache.get(codepoint);
  if (cached) return cached;
  const req = fetch(notoLottieUrl(codepoint))
    .then((r) => (r.ok ? (r.json() as Promise<Record<string, unknown>>) : null))
    .catch(() => null);
  lottieCache.set(codepoint, req);
  return req;
}

export default function NotoEmoji({
  id,
  size = 56,
  play = true,
  className = '',
}: {
  id: EmoteId;
  size?: number;
  play?: boolean;
  className?: string;
}) {
  const def = EMOTE_MAP[id];
  const hostRef = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  const [ready, setReady] = useState(false);
  const shouldAnimate = play && !reduced;

  useEffect(() => {
    if (!shouldAnimate || !def) {
      setReady(false);
      return;
    }
    let dead = false;
    let anim: { destroy: () => void } | null = null;

    (async () => {
      const [lottieMod, data] = await Promise.all([
        import('lottie-web'),
        loadNotoJson(def.codepoint),
      ]);
      if (dead || !data || !hostRef.current) return;
      const lottie = lottieMod.default ?? lottieMod;
      hostRef.current.innerHTML = '';
      anim = lottie.loadAnimation({
        container: hostRef.current,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData: structuredClone(data),
        rendererSettings: {
          preserveAspectRatio: 'xMidYMid meet',
        },
      });
      setReady(true);
    })();

    return () => {
      dead = true;
      anim?.destroy();
    };
  }, [shouldAnimate, def?.codepoint]);

  return (
    <span
      className={'noto-emoji ' + className}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.68) }}
      role="img"
      aria-label={def.label}
    >
      <span
        ref={hostRef}
        className={'noto-lottie' + (ready && shouldAnimate ? ' is-ready' : '')}
        aria-hidden="true"
      />
      {(!ready || !shouldAnimate) && <span className="noto-glyph">{def.glyph}</span>}
    </span>
  );
}
