'use client';

type BrandLogoProps = {
  variant?: 'full' | 'compact' | 'watermark';
  className?: string;
};

// Wordmark vetorial 100% tipográfica do PokerFlow (sem ícones):
// "Poker" reto editorial + "Flow" em itálico fluido com um único traço contínuo de fluxo.
export default function BrandLogo({ variant = 'full', className = '' }: BrandLogoProps) {
  const isWatermark = variant === 'watermark';
  const height = variant === 'compact' ? 26 : variant === 'watermark' ? 76 : 34;

  return (
    <svg
      className={'brand-wordmark ' + variant + (className ? ' ' + className : '')}
      viewBox="0 0 218 46"
      height={height}
      role={isWatermark ? undefined : 'img'}
      aria-label={isWatermark ? undefined : 'PokerFlow'}
      aria-hidden={isWatermark ? true : undefined}
      shapeRendering="geometricPrecision"
    >
      {!isWatermark && (
        <defs>
          <linearGradient
            id="pfFlowStroke"
            x1="108"
            y1="38"
            x2="208"
            y2="34"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#0A64FF" stopOpacity="0.3" />
            <stop offset="48%" stopColor="#0A64FF" stopOpacity="1" />
            <stop offset="100%" stopColor="#66A1FF" stopOpacity="0.95" />
          </linearGradient>
        </defs>
      )}

      <text
        x="2"
        y="32"
        fontFamily="'Behind The Nineties', 'Iowan Old Style', Georgia, serif"
        fontSize="36"
        fontWeight="400"
        letterSpacing="-0.9"
      >
        <tspan fill={isWatermark ? 'currentColor' : '#F6F6F3'}>Poker</tspan>
        <tspan dx="1" fontStyle="italic" fill={isWatermark ? 'currentColor' : '#8FB8FF'}>
          Flow
        </tspan>
      </text>

      {/* Único gesto gráfico: traço contínuo sutil sob "Flow" */}
      <path
        d="M 106 39.5 C 134 36.2, 166 36.2, 198 38.6"
        fill="none"
        stroke={isWatermark ? 'currentColor' : 'url(#pfFlowStroke)'}
        strokeWidth={isWatermark ? '2' : '2.2'}
        strokeLinecap="round"
        opacity={isWatermark ? '0.65' : '1'}
      />
    </svg>
  );
}
