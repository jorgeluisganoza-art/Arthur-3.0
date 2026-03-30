'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const accent = '#c2a46d';
const ink = '#141414';
const muted = '#525252';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('arthur_auth')) {
      router.replace('/select');
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
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (data.success) {
        localStorage.setItem('arthur_auth', JSON.stringify({ email, ts: Date.now() }));
        router.push('/select');
      } else {
        setError(data.error || 'Credenciales incorrectas');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 16px',
    background: '#fafafa',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    borderRadius: 0,
    fontFamily: 'var(--font-body), Inter, sans-serif',
    fontSize: '14px',
    color: ink,
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    marginBottom: '16px',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: 'DM Mono, monospace',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: muted,
    marginBottom: '8px',
    display: 'block',
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        overflow: 'auto',
        background: '#000000',
      }}
    >
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '48px 24px',
        }}
      >
        <div
          style={{
            width: '440px',
            maxWidth: '100%',
            background: '#ffffff',
            border: `1px solid rgba(194, 164, 109, 0.35)`,
            padding: 0,
            borderRadius: 0,
            animation: 'fadeUp 0.6s ease forwards',
            boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
          }}
        >
          <div
            style={{
              padding: '28px 40px 20px',
              borderBottom: `3px solid ${accent}`,
              background: 'linear-gradient(180deg, rgba(194, 164, 109, 0.08) 0%, #ffffff 100%)',
            }}
          >
            <button
              onClick={() => router.push('/')}
              style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: '10px',
                textTransform: 'uppercase',
                color: muted,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                marginBottom: '24px',
                display: 'block',
                transition: 'color 0.15s',
              }}
              onMouseOver={e => {
                e.currentTarget.style.color = ink;
              }}
              onMouseOut={e => {
                e.currentTarget.style.color = muted;
              }}
            >
              &larr; Volver
            </button>

            <div
              style={{
                fontFamily: 'var(--font-display), Georgia, serif',
                fontStyle: 'italic',
                fontSize: '36px',
                color: ink,
                lineHeight: 1,
                marginBottom: '12px',
              }}
            >
              arthur
            </div>
            <div
              style={{
                width: '40px',
                height: '2px',
                background: accent,
                marginBottom: '0',
              }}
            />
          </div>

          <div style={{ padding: '32px 40px 40px' }}>
            <div
              style={{
                fontFamily: 'DM Mono, monospace',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: accent,
                marginBottom: '28px',
                fontWeight: 600,
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
                onFocus={e => {
                  e.currentTarget.style.borderColor = accent;
                  e.currentTarget.style.boxShadow = `0 0 0 1px ${accent}`;
                  e.currentTarget.style.background = '#ffffff';
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.background = '#fafafa';
                }}
              />

              <label style={labelStyle}>C&oacute;digo de acceso</label>
              <input
                type="password"
                placeholder="••••••••"
                value={code}
                onChange={e => setCode(e.target.value)}
                required
                style={inputStyle}
                onFocus={e => {
                  e.currentTarget.style.borderColor = accent;
                  e.currentTarget.style.boxShadow = `0 0 0 1px ${accent}`;
                  e.currentTarget.style.background = '#ffffff';
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.background = '#fafafa';
                }}
              />

              {error && (
                <div
                  style={{
                    fontFamily: 'DM Mono, monospace',
                    fontSize: '11px',
                    color: '#b91c1c',
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
                  background: loading ? 'rgba(194,164,109,0.35)' : accent,
                  border: `1px solid ${loading ? 'rgba(194,164,109,0.5)' : accent}`,
                  borderRadius: 0,
                  color: loading ? 'rgba(20,20,20,0.5)' : ink,
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.15em',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  marginTop: '8px',
                  boxSizing: 'border-box',
                }}
                onMouseOver={e => {
                  if (!loading) {
                    e.currentTarget.style.background = '#d4b87e';
                    e.currentTarget.style.borderColor = '#d4b87e';
                  }
                }}
                onMouseOut={e => {
                  if (!loading) {
                    e.currentTarget.style.background = accent;
                    e.currentTarget.style.borderColor = accent;
                  }
                }}
              >
                {loading ? 'Verificando...' : 'Entrar'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
