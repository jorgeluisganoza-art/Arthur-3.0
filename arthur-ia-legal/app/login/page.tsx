'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AnimatedBackground from '@/components/AnimatedBackground';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('arthur_auth')) {
      router.replace('/dashboard');
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (data.success) {
        localStorage.setItem('arthur_auth', JSON.stringify({ email, ts: Date.now() }));
        router.push('/dashboard');
      } else {
        setError(data.error || 'Credenciales incorrectas');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }

  const green = '#1a3d2b';

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 0,
    fontFamily: 'Inter, sans-serif',
    fontSize: '14px',
    color: '#ffffff',
    outline: 'none',
    transition: 'border-color 0.2s',
    marginBottom: '16px',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: 'DM Mono, monospace',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: '8px',
    display: 'block',
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
      <AnimatedBackground />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '0 24px',
        }}
      >
        <div
          style={{
            width: '420px',
            maxWidth: '90vw',
            background: 'rgba(15, 45, 30, 0.75)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '48px 40px',
            borderRadius: 0,
            animation: 'fadeUp 0.6s ease forwards',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}
        >
          <button
            onClick={() => router.push('/')}
            style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '10px',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.4)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              marginBottom: '32px',
              display: 'block',
              transition: 'color 0.15s',
            }}
            onMouseOver={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
            onMouseOut={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
          >
            &larr; Volver
          </button>

          <div
            style={{
              fontFamily: 'DM Serif Display, serif',
              fontStyle: 'italic',
              fontSize: '36px',
              color: '#ffffff',
              lineHeight: 1,
              marginBottom: '12px',
            }}
          >
            arthur
          </div>
          <div
            style={{
              width: '40px',
              height: '1px',
              background: 'rgba(255,255,255,0.2)',
              marginBottom: '32px',
            }}
          />

          <div
            style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: 'rgba(255,255,255,0.45)',
              marginBottom: '32px',
            }}
          >
            Acceso al panel
          </div>

          <form onSubmit={handleSubmit}>
            <label style={labelStyle}>Correo electr&oacute;nico</label>
            <input
              type="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
            />

            <label style={labelStyle}>C&oacute;digo de acceso</label>
            <input
              type="password"
              placeholder="••••••••"
              value={code}
              onChange={e => setCode(e.target.value)}
              required
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
            />

            {error && (
              <div
                style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '11px',
                  color: 'rgba(255,100,100,0.9)',
                  marginBottom: '12px',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '16px',
                background: loading ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 0,
                color: loading ? 'rgba(255,255,255,0.5)' : '#ffffff',
                fontFamily: 'DM Mono, monospace',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                marginTop: '8px',
                boxSizing: 'border-box',
              }}
              onMouseOver={e => {
                if (!loading) e.currentTarget.style.background = 'rgba(255,255,255,0.22)';
              }}
              onMouseOut={e => {
                e.currentTarget.style.background = loading ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.15)';
              }}
            >
              {loading ? 'Verificando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
