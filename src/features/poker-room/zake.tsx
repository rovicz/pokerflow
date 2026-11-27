'use client';
import { motion, useReducedMotion } from 'motion/react';

// Zake, o mascote do Sacflow: caminhos oficiais (#sf-icon) com ombros fixos e animações apenas na cabeça.
const MOODS = {
  idle: {},
  deal: { rotate: [0, -6, 6, -5, 5, -2, 0], transition: { duration: 1.5 } },
  nod: { y: [0, 3, 0], rotate: [0, -4, 0], transition: { duration: 0.48 } },
  cheer: { y: [0, -4, 0, -3, 0], rotate: [0, -8, 8, -6, 6, 0], transition: { duration: 1.7 } },
  wow: { scale: [1, 1.09, 1.04, 1.09, 1], y: [0, -3, 0], transition: { duration: 1.3 } },
  shrug: { rotate: [0, 8, -8, 0], transition: { duration: 0.68 } },
};
const EYES = { cheer: 0.38, wow: 1.35 };

// look: {x,y} entre -1 e 1 (para onde os olhos apontam). mood: chave de MOODS.
export default function Zake({
  look,
  mood,
}: {
  look: { x: number; y: number };
  mood: keyof typeof MOODS;
}) {
  const reduced = useReducedMotion();
  const tilt = reduced ? 0 : look.x * 7;

  return (
    <div className="zake">
      <svg
        viewBox="0 0 137 166"
        role="img"
        aria-label="Zake, o dealer"
        shapeRendering="geometricPrecision"
      >
        <defs>
          <linearGradient id="zakeBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="65%" stopColor="#F3F5FA" />
            <stop offset="100%" stopColor="#DDE3EE" />
          </linearGradient>
          <linearGradient id="zakeShoulders" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F5F7FB" />
            <stop offset="100%" stopColor="#CFD7E6" />
          </linearGradient>
          <linearGradient id="zakeVisor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#171C2B" />
            <stop offset="100%" stopColor="#0C0F18" />
          </linearGradient>
          <radialGradient id="zakeShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0, 0, 0, 0.55)" />
            <stop offset="70%" stopColor="rgba(0, 0, 0, 0.22)" />
            <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
          </radialGradient>
        </defs>

        {/* Sombra de contato vetorial (substitui CSS drop-shadow que rasterizava o SVG) */}
        <ellipse cx="68" cy="161" rx="48" ry="4.5" fill="url(#zakeShadow)" />

        {/* OMBROS / BASE: 100% fixos, nunca se movem */}
        <path
          fill="url(#zakeShoulders)"
          d="M106.658 160C111.198 160 113.746 154.837 110.684 151.659C103.946 144.643 91.1878 144 68.0137 144C44.8396 144 32.1021 144.643 25.343 151.659C22.2819 154.837 24.8294 160 29.3697 160H106.658Z"
        />

        {/* CABEÇA: todas as animações acontecem exclusivamente aqui, com pivô no pescoço */}
        <motion.g
          animate={{ rotate: tilt, x: reduced ? 0 : look.x * 2 }}
          transition={{ type: 'spring', stiffness: 105, damping: 14 }}
          style={{ transformBox: 'view-box', transformOrigin: '68px 136px' }}
        >
          <motion.g
            key={mood}
            animate={reduced ? undefined : MOODS[mood]}
            style={{ transformBox: 'view-box', transformOrigin: '68px 136px' }}
          >
            {/* Fundo do visor escuro para alto contraste dos olhos e sorriso */}
            <path
              fill="url(#zakeVisor)"
              d="M68.014 31.9998C106.197 31.9998 123.683 37.8142 123.683 68.0058C123.683 98.1973 106.197 104.012 68.014 104.012C29.8308 104.031 12.3451 98.217 12.3451 68.0254C12.3451 37.8338 29.8308 31.9998 68.014 31.9998Z"
            />

            {/* Moldura oficial da cabeça */}
            <path
              fill="url(#zakeBody)"
              d="M68.014 23.9998C22.8236 23.9998 0 33.0476 0 80C0 126.952 22.8236 136 68.014 136C113.204 136 136.028 126.952 136.028 80C136.028 33.0476 113.204 23.9998 68.014 23.9998ZM68.014 104.031C29.8308 104.031 12.3451 98.217 12.3451 68.0254C12.3451 37.8338 29.8308 31.9998 68.014 31.9998C106.197 31.9998 123.683 37.8142 123.683 68.0058C123.683 98.1973 106.197 104.012 68.014 104.012V104.031Z"
            />

            {/* Antena */}
            <motion.path
              fill={mood === 'wow' || mood === 'cheer' ? '#66A1FF' : 'url(#zakeBody)'}
              animate={reduced ? undefined : { scale: mood === 'wow' ? [1, 1.45, 1] : 1 }}
              transition={{ duration: 0.48, repeat: mood === 'wow' ? 2 : 0 }}
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              d="M12.0025 24.0001C18.6421 24.0001 24.0049 18.6171 24.0049 12C24.0049 5.383 18.6209 0 12.0025 0C5.38409 0 0 5.383 0 12C0 18.6171 5.38409 24.0001 12.0025 24.0001Z"
            />

            {/* Olhos */}
            <motion.g
              animate={{ x: reduced ? 0 : look.x * 8, y: reduced ? 0 : look.y * 5 }}
              transition={{ type: 'spring', stiffness: 150, damping: 15 }}
            >
              <motion.g
                animate={{ scaleY: EYES[mood as keyof typeof EYES] ?? 1 }}
                style={{ transformBox: 'view-box', transformOrigin: '68px 54px' }}
              >
                <motion.g
                  animate={reduced ? undefined : { scaleY: [1, 1, 0.08, 1] }}
                  transition={{ repeat: Infinity, duration: 4.2, times: [0, 0.92, 0.96, 1] }}
                  style={{ transformBox: 'view-box', transformOrigin: '68px 54px' }}
                >
                  <path
                    fill="#FFFFFF"
                    d="M52.8244 60.0809C57.0545 60.8885 60.6893 57.2544 59.8816 53.0253C59.4352 50.6875 57.5221 48.7536 55.1626 48.3073C50.9326 47.4997 47.2978 51.1338 48.1055 55.363C48.5519 57.7007 50.465 59.6346 52.8244 60.0809Z"
                  />
                  <path
                    fill="#FFFFFF"
                    d="M80.8299 59.9154C85.06 60.723 88.6948 57.0889 87.8871 52.8597C87.4407 50.522 85.5276 48.5881 83.1681 48.1418C78.9381 47.3342 75.3033 50.9683 76.111 55.1975C76.5574 57.5352 78.4705 59.4691 80.8299 59.9154Z"
                  />
                </motion.g>
              </motion.g>
            </motion.g>

            {/* Sorriso */}
            <motion.path
              fill="#FFFFFF"
              animate={{ scaleY: mood === 'cheer' ? 1.85 : 1 }}
              style={{ transformBox: 'fill-box', transformOrigin: 'center top' }}
              d="M108.976 67.2828C98.02 78.1505 83.467 84.1108 68.0152 84.1108C52.562 84.1107 37.9854 78.1258 27.0547 67.2828L32.5988 61.6956C42.0481 71.069 54.6288 76.241 68.0152 76.241C81.4029 76.241 93.9591 71.092 103.432 61.6956L108.976 67.2828Z"
            />
          </motion.g>
        </motion.g>
      </svg>
    </div>
  );
}
