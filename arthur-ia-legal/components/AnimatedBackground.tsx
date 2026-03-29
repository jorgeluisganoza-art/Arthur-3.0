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
      time += 0.0008;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const mobile = window.innerWidth < 768;
      const COLS = mobile ? 50 : 80;
      const ROWS = mobile ? 35 : 50;

      for (let col = 0; col < COLS; col++) {
        for (let row = 0; row < ROWS; row++) {
          const x = (col / COLS) * canvas.width;
          const y = (row / ROWS) * canvas.height;

          const wave =
            Math.sin(col * 0.3 + row * 0.2 + time * 4) *
            Math.cos(col * 0.1 - row * 0.3 + time * 2.5);

          const radius = Math.max(0.5, 2.5 + wave * 1.8);
          const opacity = Math.min(0.65, 0.15 + (wave + 1.8) * 0.18);

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
          ctx.fill();
        }
      }

      const COLS2 = Math.floor(COLS / 2);
      const ROWS2 = Math.floor(ROWS / 2);
      for (let col = 0; col < COLS2; col++) {
        for (let row = 0; row < ROWS2; row++) {
          const x = (col / COLS2) * canvas.width;
          const y = (row / ROWS2) * canvas.height;
          const wave = Math.sin(col * 0.5 + time * 1.5) * Math.cos(row * 0.4 + time);
          const radius = Math.max(0, 6 + wave * 4);
          const opacity = Math.min(0.08, 0.03 + (wave + 1) * 0.025);

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
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
            'linear-gradient(135deg, rgba(15,45,30,0.92) 0%, rgba(20,55,35,0.88) 50%, rgba(10,35,22,0.94) 100%)',
          pointerEvents: 'none',
        }}
      />
    </>
  );
}
