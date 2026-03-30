'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AnimatedBackground from '@/components/AnimatedBackground';

/** Misma caja para «arthur» y «Empieza Ahora» (hover). */
const LOGO_BOX = {
  width: 'min(88vw, 420px)',
  height: '112px',
  boxSizing: 'border-box' as const,
};

export default function LandingPage() {
  const router = useRouter();
  const [hoverLogo, setHoverLogo] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('arthur_auth')) {
      router.replace('/select');
    }
  }, [router]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        overflow: 'hidden',
        background: '#000000',
      }}
    >
      <AnimatedBackground />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'clamp(32px, 6vw, 64px)',
          textAlign: 'center',
        }}
      >
        <button
          type="button"
          onClick={() => router.push('/login')}
          onMouseEnter={() => setHoverLogo(true)}
          onMouseLeave={() => setHoverLogo(false)}
          aria-label={hoverLogo ? 'Empieza ahora' : 'arthur'}
          style={{
            ...LOGO_BOX,
            position: 'relative',
            background: 'transparent',
            border: hoverLogo ? '1px solid rgba(255, 255, 255, 0.92)' : '1px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 16px',
            transition: 'border-color 0.2s ease',
          }}
        >
          <span
            style={{
              fontFamily: hoverLogo
                ? 'var(--font-body), Inter, system-ui, sans-serif'
                : 'var(--font-display), Georgia, serif',
              fontSize: hoverLogo
                ? 'clamp(0.8rem, 2.1vw, 1rem)'
                : 'clamp(2.6rem, 7vw, 3.85rem)',
              fontWeight: hoverLogo ? 600 : 500,
              fontStyle: hoverLogo ? 'normal' : 'italic',
              color: '#ffffff',
              letterSpacing: hoverLogo ? '0.08em' : '-0.02em',
              lineHeight: 1.05,
              whiteSpace: 'nowrap',
            }}
          >
            {hoverLogo ? 'Empieza Ahora' : 'arthur'}
          </span>
        </button>

        <div
          style={{
            width: 'min(200px, 45vw)',
            height: '1px',
            marginTop: '28px',
            background: 'linear-gradient(90deg, transparent, rgba(194, 164, 109, 0.55), transparent)',
          }}
        />

        <p
          style={{
            marginTop: '24px',
            fontFamily: 'var(--font-body), Inter, system-ui, sans-serif',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.22em',
            color: '#c2a46d',
          }}
        >
          Arthur — 2026
        </p>
      </div>
    </div>
  );
}
