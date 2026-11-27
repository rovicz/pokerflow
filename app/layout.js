import {Inter} from 'next/font/google';
import './style.css';

const inter = Inter({subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-inter', display: 'swap'});

export const metadata = {title: 'PokerFlow — Mesa privada de poker'};
export const viewport = {width: 'device-width', initialScale: 1};

export default function Layout({children}) {
  return <html lang="pt-BR" className={inter.variable}><body>{children}</body></html>;
}
