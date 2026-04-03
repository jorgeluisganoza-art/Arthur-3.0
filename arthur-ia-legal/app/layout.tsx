import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Arthur — Asistente Legal IA',
  description: 'Seguimiento inteligente de trámites registrales y procesos judiciales',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" style={{ height: '100%' }}>
      <head>
        {/* Intentional global fonts for branding; next/font would split subsets per route */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=DM+Mono:wght@400;500&family=Inter:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        style={{
          height: '100%',
          background: 'var(--paper)',
          margin: 0,
          color: 'var(--ink)',
        }}
      >
        {children}
      </body>
    </html>
  );
}
