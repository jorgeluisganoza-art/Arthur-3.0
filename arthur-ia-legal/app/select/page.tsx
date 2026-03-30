'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AnimatedBackground from '@/components/AnimatedBackground';

const gold = '194, 164, 109';

export default function SelectModulePage() {
  const router = useRouter();

  useEffect(() => {
    if (!localStorage.getItem('arthur_auth')) {
      router.replace('/login');
    }
  }, [router]);

  const cardBase: React.CSSProperties = {
    width: '320px',
    cursor: 'pointer',
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid rgba(${gold}, 0.28)`,
    padding: '40px 36px',
    borderRadius: 0,
    transition: 'all 0.2s ease',
    boxShadow: '0 0 0 1px rgba(0,0,0,0.2) inset',
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden', background: '#0b0b0b' }}>
      <AnimatedBackground />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(11,11,11,0.72) 100%)',
          zIndex: 1,
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '24px',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display), Georgia, serif',
            fontStyle: 'italic',
            fontSize: '28px',
            color: '#ffffff',
          }}
        >
          arthur
        </div>
        <div
          style={{
            width: '40px',
            height: '1px',
            marginTop: '12px',
            background: `linear-gradient(90deg, transparent, rgba(${gold}, 0.65), transparent)`,
          }}
        />

        <div
          style={{
            marginTop: '48px',
            marginBottom: '40px',
            fontFamily: 'DM Mono, monospace',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            color: 'rgba(248,248,248,0.48)',
          }}
        >
          ¿Qué deseas gestionar hoy?
        </div>

        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div
            style={cardBase}
            onClick={() => router.push('/dashboard')}
            onMouseOver={e => {
              e.currentTarget.style.background = 'rgba(194, 164, 109, 0.1)';
              e.currentTarget.style.borderColor = `rgba(${gold}, 0.55)`;
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = `0 12px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(${gold}, 0.2) inset`;
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.borderColor = `rgba(${gold}, 0.28)`;
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.2) inset';
            }}
          >
            <div
              style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: `rgba(${gold}, 0.75)`,
                marginBottom: '20px',
              }}
            >
              Registros públicos
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display), Georgia, serif',
                fontStyle: 'italic',
                fontSize: '42px',
                color: '#ffffff',
                lineHeight: 1.1,
              }}
            >
              registral
            </div>
            <p
              style={{
                fontFamily: 'var(--font-body), Inter, sans-serif',
                fontSize: '14px',
                color: 'rgba(248,248,248,0.62)',
                lineHeight: 1.6,
                marginTop: '16px',
              }}
            >
              Seguimiento de títulos y trámites ante SUNARP. Alertas automáticas por WhatsApp y email.
            </p>
            <div
              style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: '11px',
                textTransform: 'uppercase',
                color: `rgba(${gold}, 0.65)`,
                marginTop: '32px',
              }}
            >
              Ingresar →
            </div>
          </div>

          <div
            style={cardBase}
            onClick={() => router.push('/judicial')}
            onMouseOver={e => {
              e.currentTarget.style.background = 'rgba(194, 164, 109, 0.1)';
              e.currentTarget.style.borderColor = `rgba(${gold}, 0.55)`;
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = `0 12px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(${gold}, 0.2) inset`;
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.borderColor = `rgba(${gold}, 0.28)`;
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.2) inset';
            }}
          >
            <div
              style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: `rgba(${gold}, 0.75)`,
                marginBottom: '20px',
              }}
            >
              Poder Judicial · CEJ
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display), Georgia, serif',
                fontStyle: 'italic',
                fontSize: '42px',
                color: '#ffffff',
                lineHeight: 1.1,
              }}
            >
              judicial
            </div>
            <p
              style={{
                fontFamily: 'var(--font-body), Inter, sans-serif',
                fontSize: '14px',
                color: 'rgba(248,248,248,0.62)',
                lineHeight: 1.6,
                marginTop: '16px',
              }}
            >
              Seguimiento de procesos judiciales ante el CEJ. Alertas de movimientos, plazos y resoluciones.
            </p>
            <div
              style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: '11px',
                textTransform: 'uppercase',
                color: `rgba(${gold}, 0.65)`,
                marginTop: '32px',
              }}
            >
              Ingresar →
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            localStorage.removeItem('arthur_auth');
            router.push('/login');
          }}
          style={{
            marginTop: '44px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'DM Mono, monospace',
            fontSize: '10px',
            textTransform: 'uppercase',
            color: 'rgba(248,248,248,0.28)',
            letterSpacing: '0.12em',
          }}
          onMouseOver={e => {
            e.currentTarget.style.color = `rgba(${gold}, 0.85)`;
          }}
          onMouseOut={e => {
            e.currentTarget.style.color = 'rgba(248,248,248,0.28)';
          }}
        >
          ← Cerrar sesión
        </button>
      </div>
    </div>
  );
}
