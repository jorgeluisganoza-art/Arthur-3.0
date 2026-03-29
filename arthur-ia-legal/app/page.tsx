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

      {/* Content */}
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
        {/* Top label */}
        <div
          style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            color: 'rgba(255,255,255,0.45)',
            border: '1px solid rgba(255,255,255,0.15)',
            padding: '6px 16px',
            borderRadius: '2px',
            marginBottom: '48px',
            animation: 'fadeUp 0.6s ease forwards',
          }}
        >
          AI-powered · SUNARP · Perú
        </div>

        {/* Main headline */}
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
            animationDelay: '100ms',
            opacity: 0,
          }}
        >
          arthur
        </h1>

        {/* Decorative rule */}
        <div
          style={{
            width: '60px',
            height: '1px',
            background: 'rgba(255,255,255,0.3)',
            margin: '28px auto',
            animation: 'fadeUp 0.8s ease forwards',
            animationDelay: '200ms',
            opacity: 0,
          }}
        />

        {/* Subtitle */}
        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 'clamp(16px, 2vw, 20px)',
            fontWeight: 300,
            color: 'rgba(255,255,255,0.7)',
            lineHeight: 1.6,
            maxWidth: '480px',
            margin: '0 0 56px 0',
            animation: 'fadeUp 0.8s ease forwards',
            animationDelay: '300ms',
            opacity: 0,
          }}
        >
          Tu asistente legal inteligente para SUNARP
        </p>

        {/* CTA Button */}
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
            animationDelay: '400ms',
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

        {/* Trust line */}
        <div
          style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'rgba(255,255,255,0.3)',
            marginTop: '32px',
            animation: 'fadeUp 0.8s ease forwards',
            animationDelay: '500ms',
            opacity: 0,
          }}
        >
          Seguimiento automático · Alertas en tiempo real · Redacción con IA
        </div>
      </div>

      {/* Footer */}
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
        ARTHUR · 2026
      </div>
    </div>
  );
}
