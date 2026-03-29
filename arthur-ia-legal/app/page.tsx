'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// Simplex-like noise for organic water movement
function createNoise() {
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  function fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a: number, b: number, t: number) { return a + t * (b - a); }
  function grad(hash: number, x: number, y: number) {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }

  return function noise2d(x: number, y: number) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const aa = perm[perm[X] + Y];
    const ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y];
    const bb = perm[perm[X + 1] + Y + 1];
    return lerp(
      lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
      lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
      v
    );
  };
}

export default function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Check if already authenticated
  useEffect(() => {
    if (localStorage.getItem('arthur_auth')) {
      router.replace('/dashboard');
    }
  }, [router]);

  // Canvas water animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const noise = createNoise();
    let animId: number;
    let time = 0;

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      const imgData = ctx.createImageData(w, h);
      const data = imgData.data;
      const step = 3;

      for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
          const nx = x / 300;
          const ny = y / 300;

          const v1 = noise(nx + time * 0.15, ny + time * 0.1);
          const v2 = noise(nx * 1.5 + time * 0.08 + 5, ny * 1.5 - time * 0.12 + 5);
          const v3 = noise(nx * 0.7 - time * 0.05 + 10, ny * 0.7 + time * 0.07 + 10);
          const v = (v1 + v2 * 0.5 + v3 * 0.3) / 1.8;
          const n = (v + 1) / 2;

          // Green palette: deep forest to emerald
          const r = Math.floor(10 + n * 30);
          const g = Math.floor(35 + n * 55);
          const b = Math.floor(20 + n * 40);

          for (let dy = 0; dy < step && y + dy < h; dy++) {
            for (let dx = 0; dx < step && x + dx < w; dx++) {
              const idx = ((y + dy) * w + (x + dx)) * 4;
              data[idx] = r;
              data[idx + 1] = g;
              data[idx + 2] = b;
              data[idx + 3] = 255;
            }
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
      time += 0.012;
      animId = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

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
        setError(data.error || 'Código incorrecto');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
      {/* Animated canvas background */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* Subtle grain overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at 50% 40%, transparent 0%, rgba(0,0,0,0.3) 100%)',
        pointerEvents: 'none',
      }} />

      {/* Content */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '40px 24px',
      }}>
        {/* Logo + Slogan */}
        <div style={{
          textAlign: 'center',
          marginBottom: '48px',
          animation: 'fadeUp 0.8s ease forwards',
        }}>
          <h1 style={{
            fontFamily: 'DM Serif Display, serif',
            fontStyle: 'italic',
            fontSize: 'clamp(56px, 8vw, 88px)',
            color: 'white',
            fontWeight: 400,
            lineHeight: 1,
            letterSpacing: '2px',
            margin: 0,
            textShadow: '0 2px 40px rgba(0,0,0,0.3)',
          }}>
            arthur
          </h1>
          <div style={{
            width: '60px',
            height: '2px',
            background: 'rgba(255,255,255,0.3)',
            margin: '20px auto',
          }} />
          <p style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 'clamp(14px, 2vw, 18px)',
            color: 'rgba(255,255,255,0.7)',
            fontWeight: 300,
            letterSpacing: '0.5px',
            margin: 0,
          }}>
            Tu asistente legal inteligente
          </p>
        </div>

        {/* Auth form */}
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            width: '100%',
            maxWidth: '360px',
            animation: 'fadeUp 0.8s ease forwards',
            animationDelay: '200ms',
            opacity: 0,
          }}
        >
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              padding: '14px 18px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(10px)',
              color: 'white',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
          />
          <input
            type="text"
            placeholder="Código de acceso"
            value={code}
            onChange={e => setCode(e.target.value)}
            required
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              padding: '14px 18px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(10px)',
              color: 'white',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
          />

          {error && (
            <div style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '11px',
              color: '#fca5a5',
              textAlign: 'center',
              letterSpacing: '0.03em',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              padding: '14px 24px',
              background: loading ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              backdropFilter: 'blur(10px)',
              marginTop: '4px',
            }}
            onMouseOver={e => {
              if (!loading) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)';
              }
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
            }}
          >
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>

        {/* Footer */}
        <div style={{
          position: 'absolute',
          bottom: '24px',
          fontFamily: 'DM Mono, monospace',
          fontSize: '9px',
          color: 'rgba(255,255,255,0.3)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}>
          Arthur Legal IA · 2026
        </div>
      </div>
    </div>
  );
}
