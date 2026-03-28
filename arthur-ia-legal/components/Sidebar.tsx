'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface SidebarProps {
  observadosCount?: number;
}

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
    { href: '/dashboard', label: 'Mis Trámites', hasAlert: count > 0 },
    { href: '/dashboard/agenda', label: 'Agenda de Plazos', hasAlert: false },
    { href: '/dashboard/alertas', label: 'Alertas', hasAlert: false },
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
        background: '#1a3a5c',
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
        <div
          style={{
            fontFamily: 'DM Serif Display, serif',
            fontSize: '28px',
            color: 'white',
            fontStyle: 'italic',
            lineHeight: 1,
          }}
        >
          Arthur-IA
        </div>
        <div
          style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            color: 'rgba(245,240,232,0.45)',
            marginTop: '4px',
          }}
        >
          Legal · SUNARP
        </div>
        <div
          style={{
            width: '60px',
            height: '2px',
            background: '#c0392b',
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
              color: isActive(link.href) ? 'white' : 'rgba(245,240,232,0.6)',
              background: isActive(link.href) ? 'rgba(245,240,232,0.1)' : 'transparent',
              borderRadius: '4px',
              marginBottom: '4px',
              transition: 'color 0.15s, background 0.15s',
              textDecoration: 'none',
            }}
          >
            <span>
              {link.href === '/dashboard' && '📋 '}
              {link.href === '/dashboard/agenda' && '📅 '}
              {link.href === '/dashboard/alertas' && '🔔 '}
              {link.label}
            </span>
            {link.hasAlert && (
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#c0392b',
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
              background: 'rgba(245,240,232,0.15)',
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
                background: 'rgba(192,57,43,0.3)',
                color: '#e07070',
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
