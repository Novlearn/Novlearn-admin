import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NovLearn Admin',
  description: "Socle de l'application d'administration NovLearn.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
