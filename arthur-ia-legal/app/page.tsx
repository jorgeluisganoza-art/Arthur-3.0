'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AnimatedBackground from '@/components/AnimatedBackground';

export default function LandingPage() {
  const router = useRouter();

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
        <h1
          style={{
            fontFamily: 'DM Serif Display, serif',
            fontStyle: 'italic',
            fontSize: 'clamp(72px, 10vw, 120px)',
            color: '#ffffff',
            fontWeight: 400,
            letterSpacing: '-0.02em',
            lineHeight: 1,
            margin: 0,
            animation: 'fadeUp 0.8s ease forwards',
          }}
        >
          arthur
        </h1>

        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 'clamp(16px, 2vw, 20px)',
            fontWeight: 300,
            color: 'rgba(255,255,255,0.6)',
            lineHeight: 1.6,
            margin: '24px 0 56px 0',
            animation: 'fadeUp 0.8s ease forwards',
            animationDelay: '150ms',
            opacity: 0,
          }}
        >
          Asistente Legal Avanzado
        </p>

        <button
          onClick={() => router.push('/login')}
          style={{
            background: '#ffffff',
            color: '#1a3d2b',
            fontFamily: 'DM Mono, monospace',
            fontSize: '13px',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            padding: '18px 40px',
            border: 'none',
            borderRadius: 0,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            animation: 'fadeUp 0.8s ease forwards',
            animationDelay: '300ms',
            opacity: 0,
          }}
          onMouseOver={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.9)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseOut={e => {
            e.currentTarget.style.background = '#ffffff';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          Empieza ahora →
        </button>
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
