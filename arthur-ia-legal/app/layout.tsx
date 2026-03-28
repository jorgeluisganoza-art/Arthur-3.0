import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'Arthur-IA Legal — SUNARP',
  description: 'Seguimiento automático de trámites SUNARP con IA',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" style={{ height: '100%' }}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400;500&family=Inter:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        style={{
          height: '100%',
          display: 'flex',
          background: 'var(--paper)',
          margin: 0,
        }}
      >
        <Sidebar />
        <main
          style={{
            marginLeft: '260px',
            flex: 1,
            minHeight: '100vh',
            background: 'var(--paper)',
          }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}
