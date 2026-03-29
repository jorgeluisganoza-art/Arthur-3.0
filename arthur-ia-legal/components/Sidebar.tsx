'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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

export default function Sidebar({ observadosCount = 0 }: SidebarProps) {
  const pathname = usePathname();
  const [count, setCount] = useState(observadosCount);

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then(r => r.json())
      .then(data => setCount(data.observados || 0))
      .catch(() => {});
  }, []);

  const links = [
    { href: '/dashboard', label: 'Mis Trámites', hasAlert: count > 0, Icon: IconGrid },
    { href: '/dashboard/agenda', label: 'Agenda de Plazos', hasAlert: false, Icon: IconCalendar },
    { href: '/dashboard/alertas', label: 'Alertas', hasAlert: false, Icon: IconBell },
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
        background: '#1a3d2b',
        position: 'fixed',
        left: 0,
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
      }}
    >
      {/* Logo */}
      <div style={{ padding: '32px 28px 0' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div
            style={{
              fontFamily: 'DM Serif Display, serif',
              fontSize: '64px',
              color: 'white',
              fontStyle: 'italic',
              lineHeight: 1,
              letterSpacing: '2px',
            }}
          >
            arthur
          </div>
        </Link>
        <div
          style={{
            width: '60px',
            height: '2px',
            background: '#2d5a3d',
            marginTop: '16px',
          }}
        />
      </div>

      {/* Navigation */}
      <nav style={{ marginTop: '48px', padding: '0 16px', flex: 1 }}>
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
              color: isActive(link.href) ? 'white' : 'rgba(255,255,255,0.6)',
              background: isActive(link.href) ? 'rgba(255,255,255,0.1)' : 'transparent',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'DM Mono, monospace',
              fontSize: '12px',
              color: 'white',
              flexShrink: 0,
            }}
          >
            HL
          </div>
          <div>
            <div
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '13px',
                color: 'white',
                lineHeight: 1.3,
              }}
            >
              Héctor Levano
            </div>
            <span
              style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: '10px',
                textTransform: 'uppercase',
                background: 'rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.75)',
                padding: '3px 8px',
                borderRadius: '2px',
                letterSpacing: '0.05em',
              }}
            >
              Plan Pro
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
