'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const IconGrid = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="1" width="6" height="6" rx="0.5" />
    <rect x="9" y="1" width="6" height="6" rx="0.5" />
    <rect x="1" y="9" width="6" height="6" rx="0.5" />
    <rect x="9" y="9" width="6" height="6" rx="0.5" />
  </svg>
);

const IconCalendar = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1.5" y="2.5" width="13" height="12" rx="1" />
    <path d="M1.5 6.5h13" />
    <path d="M5 1v3M11 1v3" />
  </svg>
);

const IconBell = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 1.5a4.5 4.5 0 0 0-4.5 4.5v3l-1 1.5h11l-1-1.5V6A4.5 4.5 0 0 0 8 1.5z" />
    <path d="M6.5 13a1.5 1.5 0 0 0 3 0" />
  </svg>
);

const IconSettings = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

export default function JudicialSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    try {
      const auth = JSON.parse(localStorage.getItem('arthur_auth') || '{}');
      if (auth.email) queueMicrotask(() => setUserEmail(auth.email));
    } catch {
      // ignore
    }
  }, []);

  const links = [
    { href: '/judicial', label: 'Mis Procesos', Icon: IconGrid },
    { href: '/judicial/agenda', label: 'Agenda', Icon: IconCalendar },
    { href: '/judicial/alertas', label: 'Alertas', Icon: IconBell },
    { href: '/judicial/config', label: 'Configuración', Icon: IconSettings },
  ];

  const isActive = (href: string) => (href === '/judicial' ? pathname === '/judicial' : pathname.startsWith(href));

  return (
    <aside
      style={{
        width: '260px',
        minWidth: '260px',
        height: '100vh',
        backgroundColor: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-edge)',
        boxShadow: 'var(--sidebar-shadow)',
        position: 'fixed',
        left: 0,
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 300,
        color: 'var(--sidebar-text)',
        overflowY: 'auto',
      }}
    >
      <div style={{ padding: '32px 28px 0' }}>
        <Link href="/select" style={{ textDecoration: 'none' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '36px', color: 'var(--sidebar-text)', fontStyle: 'italic', lineHeight: 1 }}>
            arthur
          </div>
        </Link>
        <div style={{ width: '60px', height: '2px', background: 'rgba(194, 164, 109, 0.4)', marginTop: '16px' }} />
        <div
          style={{
            marginTop: '10px',
            fontFamily: 'DM Mono, monospace',
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--sidebar-module-label)',
          }}
        >
          judicial
        </div>
      </div>

      <nav style={{ marginTop: '36px', padding: '0 16px', flex: 1 }}>
        {links.map(link => (
          <Link
            key={link.href}
            href={link.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '10px 16px',
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              color: isActive(link.href) ? 'var(--sidebar-text)' : 'var(--sidebar-muted)',
              background: isActive(link.href) ? 'var(--sidebar-active-bg)' : 'transparent',
              borderRadius: '4px',
              marginBottom: '4px',
              textDecoration: 'none',
              transition: 'color 0.15s, background 0.15s',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <link.Icon />
              {link.label}
            </span>
          </Link>
        ))}
      </nav>

      <div style={{ padding: '0 28px 24px', position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'var(--sidebar-avatar-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'DM Mono, monospace',
              fontSize: '12px',
              color: 'var(--sidebar-text)',
              flexShrink: 0,
            }}
          >
            {userEmail ? userEmail.charAt(0).toUpperCase() : 'U'}
          </div>
          <div
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '12px',
              color: 'var(--sidebar-text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {userEmail || 'Usuario'}
          </div>
        </div>
        <button
          onClick={() => {
            localStorage.removeItem('arthur_auth');
            router.push('/login');
          }}
          style={{
            width: '100%',
            fontFamily: 'DM Mono, monospace',
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            padding: '8px',
            background: 'var(--sidebar-btn-bg)',
            border: '1px solid var(--sidebar-btn-border)',
            color: 'var(--sidebar-btn-fg)',
            cursor: 'pointer',
            borderRadius: '2px',
          }}
          onMouseOver={e => {
            e.currentTarget.style.background = 'var(--sidebar-hover-bg)';
            e.currentTarget.style.color = 'var(--sidebar-text)';
          }}
          onMouseOut={e => {
            e.currentTarget.style.background = 'var(--sidebar-btn-bg)';
            e.currentTarget.style.color = 'var(--sidebar-btn-fg)';
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
