'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AnimatedBackground from '@/components/AnimatedBackground';

export default function LandingPage() {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('arthur_auth')) {
      router.replace('/dashboard');
    }
  }, [router]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
      <AnimatedBackground />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          textAlign: 'center',
          padding: '0 24px',
        }}
      >
        <div
          onClick={() => router.push('/login')}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            cursor: 'pointer',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '130px',
            animation: 'fadeUp 0.8s ease forwards',
          }}
        >
          <h1
            style={{
              fontFamily: 'DM Serif Display, serif',
              fontStyle: 'italic',
              fontSize: 'clamp(72px, 10vw, 120px)',
              color: '#4ae08c',
              fontWeight: 400,
              letterSpacing: '-0.02em',
              lineHeight: 1,
              margin: 0,
              transition: 'opacity 0.35s ease, transform 0.35s ease, text-shadow 0.35s ease',
              opacity: hovered ? 0 : 1,
              transform: hovered ? 'scale(0.95)' : 'scale(1)',
              textShadow: '0 0 40px rgba(74, 224, 140, 0.3)',
            }}
          >
            arthur
          </h1>

          <div
            style={{
              position: 'absolute',
              fontFamily: 'DM Mono, monospace',
              fontSize: 'clamp(13px, 1.5vw, 16px)',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: '#4ae08c',
              transition: 'opacity 0.35s ease, transform 0.35s ease',
              opacity: hovered ? 1 : 0,
              transform: hovered ? 'scale(1)' : 'scale(1.05)',
              padding: '22px 52px',
              border: '1px solid rgba(74, 224, 140, 0.35)',
              whiteSpace: 'nowrap',
            }}
          >
            Empieza ahora &rarr;
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: '28px',
          left: 0,
          right: 0,
          textAlign: 'center',
          zIndex: 2,
          fontFamily: 'DM Mono, monospace',
          fontSize: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          color: 'rgba(74, 224, 140, 0.25)',
        }}
      >
        Arthur &mdash; 2026
      </div>
    </div>
  );
}
