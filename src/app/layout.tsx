import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const inter = localFont({
  src: '../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  variable: '--font-inter',
  display: 'swap',
  weight: '100 900',
});

const fredoka = localFont({
  src: '../../node_modules/@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2',
  variable: '--font-fredoka',
  display: 'swap',
  weight: '300 700',
});

export const metadata: Metadata = {
  title: 'NovLearn Admin',
  description: 'Espace privé de gestion pédagogique NovLearn.',
  robots: { index: false, follow: false },
  icons: { icon: '/logo/novlearn-logo-ui.svg' },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${inter.variable} ${fredoka.variable}`}>
      <body>{children}</body>
    </html>
  );
}
