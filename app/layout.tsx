import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '../src/styles/globals.css';
import { AuthProvider } from '../src/features/auth/use-auth';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = { title: 'PokerFlow — Mesa privada de poker' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
