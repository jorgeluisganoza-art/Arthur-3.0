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
            transition: 'all 0.4s ease',
            animation: 'fadeUp 0.8s ease forwards',
          }}
        >
          <h1
            style={{
              fontFamily: 'DM Serif Display, serif',
              fontStyle: 'italic',
              fontSize: hovered ? 'clamp(28px, 4vw, 48px)' : 'clamp(72px, 10vw, 120px)',
              color: '#ffffff',
              fontWeight: 400,
              letterSpacing: '-0.02em',
              lineHeight: 1,
              margin: 0,
              transition: 'all 0.4s ease',
              opacity: hovered ? 0 : 1,
              position: hovered ? 'absolute' : 'relative',
              pointerEvents: 'none',
            }}
          >
            arthur
          </h1>
          <div
            style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: 'clamp(14px, 2vw, 18px)',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: '#ffffff',
              transition: 'all 0.4s ease',
              opacity: hovered ? 1 : 0,
              padding: '20px 48px',
              border: '1px solid rgba(255,255,255,0.3)',
            }}
          >
            Empieza ahora →
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
          color: 'rgba(255,255,255,0.2)',
        }}
      >
        Arthur — 2026
      </div>
    </div>
  );
}
