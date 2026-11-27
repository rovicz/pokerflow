import type { NextConfig } from 'next';

const dev = process.env.NODE_ENV !== 'production';
// CSP: o app só carrega código próprio; fontes da marca, emoji animados e Supabase Realtime são as únicas origens externas.
// shortcut: 'unsafe-inline' em script/style por causa do Next sem nonce; trocar por CSP com nonce se o app passar a exibir conteúdo de terceiros.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data: https://sacflow.com.br",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://fonts.gstatic.com${dev ? ' ws: wss:' : ''}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const config: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};
export default config;
