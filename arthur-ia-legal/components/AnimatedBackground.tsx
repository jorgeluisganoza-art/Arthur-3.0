'use client';

import { useEffect, useRef } from 'react';

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      time += 0.015;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const w = canvas.width;
      const h = canvas.height;
      const mobile = w < 768;
      const COLS = mobile ? 55 : 90;
      const ROWS = mobile ? 40 : 55;
      const spacingX = w / COLS;
      const spacingY = h / ROWS;

      for (let col = 0; col < COLS; col++) {
        for (let row = 0; row < ROWS; row++) {
          const baseX = col * spacingX;
          const baseY = row * spacingY;

          const wave1 = Math.sin(col * 0.12 + time * 1.2) * Math.cos(row * 0.08 + time * 0.7);
          const wave2 = Math.sin(row * 0.15 - time * 0.9 + col * 0.05) * 0.6;
          const wave3 = Math.cos(col * 0.07 + row * 0.1 + time * 0.5) * 0.4;
          const combined = wave1 + wave2 + wave3;

          const dx = Math.sin(col * 0.2 + time * 1.5 + row * 0.05) * spacingX * 0.35;
          const dy = Math.cos(row * 0.15 + time * 0.8 + col * 0.1) * spacingY * 0.3;

          const x = baseX + dx;
          const y = baseY + dy;

          const radius = Math.max(0.3, 2 + combined * 1.5);
          const opacity = Math.min(0.6, Math.max(0.05, 0.15 + combined * 0.18));

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${opacity})`;
          ctx.fill();
        }
      }

      const COLS2 = Math.floor(COLS / 3);
      const ROWS2 = Math.floor(ROWS / 3);
      for (let col = 0; col < COLS2; col++) {
        for (let row = 0; row < ROWS2; row++) {
          const baseX = (col / COLS2) * w;
          const baseY = (row / ROWS2) * h;
          const drift = Math.sin(col * 0.3 + time * 0.6) * 20 + Math.cos(row * 0.2 + time * 0.4) * 15;
          const x = baseX + drift;
          const y = baseY + Math.sin(time * 0.5 + col * 0.4) * 12;
          const wave = Math.sin(col * 0.5 + time * 0.7) * Math.cos(row * 0.4 + time * 0.5);
          const radius = Math.max(0, 8 + wave * 5);
          const opacity = Math.min(0.07, 0.02 + (wave + 1) * 0.02);

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${opacity})`;
          ctx.fill();
        }
      }

      animId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
          background: '#0d2b1a',
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1,
          background:
            'linear-gradient(135deg, rgba(15,45,30,0.88) 0%, rgba(20,55,35,0.82) 50%, rgba(10,35,22,0.90) 100%)',
          pointerEvents: 'none',
        }}
      />
    </>
  );
}
