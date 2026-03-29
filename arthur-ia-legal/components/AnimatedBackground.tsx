'use client';

import { useEffect, useRef } from 'react';

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5, intensity: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;
    let currentIntensity = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const handleMouse = (e: MouseEvent) => {
      const mx = e.clientX / window.innerWidth;
      const my = e.clientY / window.innerHeight;
      mouseRef.current.x = mx;
      mouseRef.current.y = my;

      const centerX = 0.5;
      const centerY = 0.45;
      const dx = mx - centerX;
      const dy = my - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      mouseRef.current.intensity = Math.max(0, 1 - dist * 2.2);
    };
    window.addEventListener('mousemove', handleMouse);

    const animate = () => {
      time += 0.008;
      const w = canvas.width;
      const h = canvas.height;

      const targetIntensity = mouseRef.current.intensity;
      currentIntensity += (targetIntensity - currentIntensity) * 0.04;

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);

      const cx = w * 0.5;
      const horizonY = h * 0.72;

      const baseGlow = 0.25 + currentIntensity * 0.75;

      // Horizon line glow
      const lineGrad = ctx.createLinearGradient(0, horizonY - 2, 0, horizonY + 2);
      lineGrad.addColorStop(0, `rgba(40, 200, 120, ${0.05 * baseGlow})`);
      lineGrad.addColorStop(0.5, `rgba(60, 255, 150, ${0.15 * baseGlow})`);
      lineGrad.addColorStop(1, `rgba(40, 200, 120, ${0.05 * baseGlow})`);
      ctx.fillStyle = lineGrad;
      const lineSpread = w * (0.4 + currentIntensity * 0.35);
      ctx.fillRect(cx - lineSpread, horizonY - 1, lineSpread * 2, 2);

      // Main light source — large radial glow
      const mainRadius = Math.min(w, h) * (0.35 + currentIntensity * 0.3);
      const mainGrad = ctx.createRadialGradient(cx, horizonY, 0, cx, horizonY, mainRadius);
      mainGrad.addColorStop(0, `rgba(180, 255, 210, ${0.9 * baseGlow})`);
      mainGrad.addColorStop(0.08, `rgba(100, 240, 160, ${0.6 * baseGlow})`);
      mainGrad.addColorStop(0.25, `rgba(50, 180, 100, ${0.3 * baseGlow})`);
      mainGrad.addColorStop(0.5, `rgba(20, 100, 60, ${0.12 * baseGlow})`);
      mainGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = mainGrad;
      ctx.fillRect(0, 0, w, h);

      // Upward light rays
      const rayCount = 24 + Math.floor(currentIntensity * 16);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < rayCount; i++) {
        const angle = -Math.PI * 0.5 + (i / rayCount - 0.5) * Math.PI * 0.9;
        const wobble = Math.sin(time * 0.7 + i * 2.3) * 0.03;
        const rayAngle = angle + wobble;

        const rayLength = (h * 0.5 + h * 0.3 * currentIntensity) *
          (0.5 + 0.5 * Math.sin(time * 0.4 + i * 1.7));

        const rayWidth = (1.5 + currentIntensity * 2.5) *
          (0.5 + 0.5 * Math.cos(time * 0.3 + i * 0.8));

        const opacity = (0.03 + currentIntensity * 0.06) *
          (0.4 + 0.6 * Math.sin(time * 0.5 + i * 1.1));

        const endX = cx + Math.cos(rayAngle) * rayLength;
        const endY = horizonY + Math.sin(rayAngle) * rayLength;

        const rayGrad = ctx.createLinearGradient(cx, horizonY, endX, endY);
        rayGrad.addColorStop(0, `rgba(120, 255, 180, ${opacity})`);
        rayGrad.addColorStop(0.4, `rgba(60, 200, 120, ${opacity * 0.5})`);
        rayGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.beginPath();
        ctx.moveTo(cx, horizonY);
        ctx.lineTo(endX - rayWidth, endY);
        ctx.lineTo(endX + rayWidth, endY);
        ctx.closePath();
        ctx.fillStyle = rayGrad;
        ctx.fill();
      }
      ctx.restore();

      // Secondary wide atmospheric glow (covers upper area)
      const atmoRadius = w * (0.5 + currentIntensity * 0.3);
      const atmoGrad = ctx.createRadialGradient(cx, horizonY, 0, cx, horizonY, atmoRadius);
      atmoGrad.addColorStop(0, `rgba(80, 220, 140, ${0.08 * baseGlow})`);
      atmoGrad.addColorStop(0.3, `rgba(30, 120, 70, ${0.04 * baseGlow})`);
      atmoGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = atmoGrad;
      ctx.fillRect(0, 0, w, h);

      // Subtle pulsing inner core
      const pulseSize = 20 + Math.sin(time * 1.5) * 5 + currentIntensity * 30;
      const pulseGrad = ctx.createRadialGradient(cx, horizonY, 0, cx, horizonY, pulseSize);
      pulseGrad.addColorStop(0, `rgba(220, 255, 235, ${0.8 * baseGlow})`);
      pulseGrad.addColorStop(0.5, `rgba(150, 255, 200, ${0.3 * baseGlow})`);
      pulseGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = pulseGrad;
      ctx.fillRect(cx - pulseSize, horizonY - pulseSize, pulseSize * 2, pulseSize * 2);

      // Curved horizon shadow (blocks light below horizon)
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, horizonY + h * 0.28, w * 0.7, h * 0.28, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
      ctx.restore();

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
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        display: 'block',
        background: '#000000',
      }}
    />
  );
}
