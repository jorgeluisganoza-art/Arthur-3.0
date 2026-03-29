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
    let mouseX = 0.5;
    let mouseY = 0.5;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const handleMouse = (e: MouseEvent) => {
      mouseX = e.clientX / window.innerWidth;
      mouseY = e.clientY / window.innerHeight;
    };
    window.addEventListener('mousemove', handleMouse);

    const animate = () => {
      time += 0.003;
      const w = canvas.width;
      const h = canvas.height;

      ctx.fillStyle = '#0a1f14';
      ctx.fillRect(0, 0, w, h);

      // Flowing grid lines (horizontal)
      ctx.lineWidth = 0.5;
      const hLines = 40;
      for (let i = 0; i < hLines; i++) {
        const baseY = (i / hLines) * h;
        ctx.beginPath();
        const proximity = 1 - Math.abs((i / hLines) - mouseY) * 1.5;
        const brightness = Math.max(0.03, Math.min(0.15, proximity * 0.15));
        ctx.strokeStyle = `rgba(120, 220, 160, ${brightness})`;

        for (let x = 0; x <= w; x += 6) {
          const nx = x / w;
          const wave = Math.sin(nx * 6 + time * 2 + i * 0.3) * 12 +
                       Math.sin(nx * 3 - time * 1.5 + i * 0.15) * 8 +
                       Math.cos(nx * 10 + time * 3) * 3;
          const y = baseY + wave;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Vertical flowing lines
      const vLines = 50;
      for (let i = 0; i < vLines; i++) {
        const baseX = (i / vLines) * w;
        ctx.beginPath();
        const proximity = 1 - Math.abs((i / vLines) - mouseX) * 1.5;
        const brightness = Math.max(0.02, Math.min(0.08, proximity * 0.08));
        ctx.strokeStyle = `rgba(100, 200, 150, ${brightness})`;

        for (let y = 0; y <= h; y += 8) {
          const ny = y / h;
          const wave = Math.sin(ny * 5 + time * 1.8 + i * 0.25) * 10 +
                       Math.cos(ny * 8 - time * 2.2 + i * 0.1) * 5;
          const x = baseX + wave;
          if (y === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Floating particles
      for (let i = 0; i < 60; i++) {
        const speed = 0.2 + (i % 7) * 0.12;
        const px = ((Math.sin(i * 7.3 + time * speed) + 1) / 2) * w;
        const py = ((Math.cos(i * 4.7 + time * speed * 0.7) + 1) / 2) * h;
        const pulse = Math.sin(time * 3 + i * 2.1) * 0.5 + 0.5;
        const size = 1 + pulse * 2;
        const alpha = 0.1 + pulse * 0.25;

        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(140, 230, 180, ${alpha})`;
        ctx.fill();
      }

      // Scanning line effect
      const scanY = ((Math.sin(time * 0.8) + 1) / 2) * h;
      const scanGrad = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 40);
      scanGrad.addColorStop(0, 'rgba(100, 220, 160, 0)');
      scanGrad.addColorStop(0.5, 'rgba(100, 220, 160, 0.04)');
      scanGrad.addColorStop(1, 'rgba(100, 220, 160, 0)');
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, scanY - 40, w, 80);

      // Vignette
      const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.9);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      animId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouse);
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
      }}
    />
  );
}
