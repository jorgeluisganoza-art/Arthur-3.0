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

    const chars = '01';
    const mobile = window.innerWidth < 768;
    const FONT_SIZE = mobile ? 12 : 14;
    const COLS = Math.floor(window.innerWidth / (FONT_SIZE * 0.7));

    const drops: number[] = new Array(COLS).fill(0);
    for (let i = 0; i < COLS; i++) {
      drops[i] = Math.random() * -100;
    }

    const speeds: number[] = new Array(COLS).fill(0);
    for (let i = 0; i < COLS; i++) {
      speeds[i] = 0.3 + Math.random() * 0.7;
    }

    const animate = () => {
      time += 1;

      ctx.fillStyle = 'rgba(8, 24, 16, 0.12)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${FONT_SIZE}px "DM Mono", monospace`;

      for (let i = 0; i < COLS; i++) {
        const x = i * FONT_SIZE * 0.7;
        const y = drops[i] * FONT_SIZE;

        const char = chars[Math.floor(Math.random() * chars.length)];

        const wave = Math.sin(i * 0.15 + time * 0.02) * 0.3 + 0.7;
        const headAlpha = Math.min(1, wave);
        ctx.fillStyle = `rgba(120, 255, 170, ${headAlpha})`;
        ctx.fillText(char, x, y);

        const trailSteps = 12;
        for (let t = 1; t <= trailSteps; t++) {
          const trailY = y - t * FONT_SIZE;
          if (trailY < 0) break;
          const trailChar = chars[Math.floor(Math.random() * chars.length)];
          const alpha = (1 - t / trailSteps) * 0.35 * wave;
          ctx.fillStyle = `rgba(60, 180, 110, ${alpha})`;
          ctx.fillText(trailChar, x, trailY);
        }

        drops[i] += speeds[i];

        if (drops[i] * FONT_SIZE > canvas.height && Math.random() > 0.975) {
          drops[i] = Math.random() * -20;
          speeds[i] = 0.3 + Math.random() * 0.7;
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
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        background: '#081810',
      }}
    />
  );
}
