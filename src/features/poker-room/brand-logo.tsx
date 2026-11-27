'use client';

type BrandLogoProps = {
  variant?: 'full' | 'compact' | 'watermark';
  className?: string;
};

// Wordmark editorial do PokerFlow (100% por escrito, sem ícones):
// O traço SVG é ancorado à largura exata de "Flow" (0% a 100%), imune a métricas de fonte.
export default function BrandLogo({ variant = 'full', className = '' }: BrandLogoProps) {
  const isWatermark = variant === 'watermark';
  const gradId = `pfFlow-${variant}`;

  return (
    <span
      className={'pf-wordmark pf-' + variant + (className ? ' ' + className : '')}
      aria-label={isWatermark ? undefined : 'PokerFlow'}
      aria-hidden={isWatermark ? true : undefined}
    >
      <span className="pf-poker">Poker</span>
      <span className="pf-flow">
        Flow
        <svg
          className="pf-flow-stroke"
          viewBox="0 0 100 10"
          preserveAspectRatio="none"
          aria-hidden="true"
          shapeRendering="geometricPrecision"
        >
          {!isWatermark && (
            <defs>
              <linearGradient id={gradId} x1="0" y1="5" x2="100" y2="5" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#0A64FF" stopOpacity="0.35" />
                <stop offset="45%" stopColor="#0A64FF" stopOpacity="1" />
                <stop offset="100%" stopColor="#66A1FF" stopOpacity="0.95" />
              </linearGradient>
            </defs>
          )}
          <path
            d="M 2 7.5 C 32 3.2, 68 3.2, 98 6.4"
            fill="none"
            stroke={isWatermark ? 'currentColor' : `url(#${gradId})`}
            strokeWidth={isWatermark ? '2.4' : '2.6'}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </span>
    </span>
  );
}
