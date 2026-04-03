'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface SidebarProps {
  observadosCount?: number;
}

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

const IconChat = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 2.5h12a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5H5L2 14V3a.5.5 0 0 1 .5-.5z" />
    <path d="M5 6h6M5 8.5h4" />
  </svg>
);

const IconSunarp = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="6.5" />
    <path d="M5.5 8h5M8 5.5v5" />
    <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" strokeWidth="1" opacity="0.5" />
  </svg>
);

const IconArchive = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="2" width="14" height="3" rx="0.5" />
    <path d="M2.5 5v8.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V5" />
    <path d="M6 8h4" />
  </svg>
);

const IconTrash = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 4h12M5 4V2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5V4" />
    <path d="M3.5 4l.5 10a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l.5-10" />
    <path d="M6.5 7v5M9.5 7v5" />
  </svg>
);

export default function Sidebar({ observadosCount = 0 }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [count, setCount] = useState(observadosCount);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then(r => r.json())
      .then(data => setCount(data.observados || 0))
      .catch(() => {});
    try {
      const auth = JSON.parse(localStorage.getItem('arthur_auth') || '{}');
      if (auth.email) setUserEmail(auth.email);
    } catch { /* ignore */ }
  }, []);

  const links = [
    { href: '/dashboard', label: 'Mis Trámites', hasAlert: count > 0, Icon: IconGrid },
    { href: '/dashboard/agenda', label: 'Agenda de Plazos', hasAlert: false, Icon: IconCalendar },
    { href: '/dashboard/alertas', label: 'Alertas', hasAlert: false, Icon: IconBell },
    { href: '/dashboard/chat', label: 'Consulta Legal', hasAlert: false, Icon: IconChat },
    { href: '/dashboard/siguelo', label: 'SUNARP Síguelo', hasAlert: false, Icon: IconSunarp },
    { href: '/dashboard/archivados', label: 'Archivados', hasAlert: false, Icon: IconArchive },
    { href: '/dashboard/eliminados', label: 'Eliminados', hasAlert: false, Icon: IconTrash },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

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
      {/* Logo */}
      <div style={{ padding: '32px 28px 0' }}>
        <Link href="/select" style={{ textDecoration: 'none' }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '36px',
              color: 'var(--sidebar-text)',
              fontStyle: 'italic',
              lineHeight: 1,
              letterSpacing: '0.5px',
            }}
          >
            arthur
          </div>
        </Link>
        <div
          style={{
            width: '60px',
            height: '2px',
            background: 'rgba(194, 164, 109, 0.35)',
            marginTop: '16px',
          }}
        />
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
          registral
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ marginTop: '36px', padding: '0 16px', flex: 1 }}>
        {links.map(link => (
          <Link
            key={link.href}
            href={link.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              color: isActive(link.href) ? 'var(--sidebar-text)' : 'var(--sidebar-muted)',
              background: isActive(link.href) ? 'var(--sidebar-active-bg)' : 'transparent',
              borderRadius: '4px',
              marginBottom: '4px',
              transition: 'color 0.15s, background 0.15s',
              textDecoration: 'none',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <link.Icon />
              {link.label}
            </span>
            {link.hasAlert && (
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#ef4444',
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
            )}
          </Link>
        ))}
      </nav>

      {/* User section */}
      <div
        style={{
          padding: '0 28px 24px',
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        }}
      >
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
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '12px',
              color: 'var(--sidebar-text)',
              lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {userEmail || 'Usuario'}
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            localStorage.removeItem('arthur_auth');
            router.push('/');
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
            transition: 'all 0.15s',
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
