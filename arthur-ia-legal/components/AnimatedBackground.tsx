'use client';

import { useEffect, useRef } from 'react';

const P = new Uint8Array(512);
const permutation = [
  151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,
  140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,
  120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,
  33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,
  71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,
  133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,
  63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,
  135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,
  226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,
  59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,
  152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,
  39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,
  97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,
  145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,
  204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,
  67,29,24,72,243,141,128,195,78,66,215,61,156,180
];
for (let i = 0; i < 256; i++) P[i] = P[i + 256] = permutation[i];

function fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(t: number, a: number, b: number) { return a + t * (b - a); }
function grad(hash: number, x: number, y: number) {
  const h = hash & 3;
  const u = h < 2 ? x : y;
  const v = h < 2 ? y : x;
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}
function noise(x: number, y: number) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  x -= Math.floor(x); y -= Math.floor(y);
  const u = fade(x), v = fade(y);
  const a = P[X] + Y, b = P[X + 1] + Y;
  return lerp(v,
    lerp(u, grad(P[a], x, y),     grad(P[b], x - 1, y)),
    lerp(u, grad(P[a + 1], x, y - 1), grad(P[b + 1], x - 1, y - 1))
  );
}

function fbm(x: number, y: number, octaves = 6) {
  let value = 0, amplitude = 0.5, frequency = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise(x * frequency, y * frequency);
    max += amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  return value / max;
}

function marble(x: number, y: number, time: number) {
  const qx = fbm(x + 0.0 + time * 0.08, y + 0.0);
  const qy = fbm(x + 5.2 + time * 0.08, y + 1.3);

  const rx = fbm(x + 4.0 * qx + 1.7 + time * 0.04, y + 4.0 * qy + 9.2);
  const ry = fbm(x + 4.0 * qx + 8.3 + time * 0.04, y + 4.0 * qy + 2.8);

  return fbm(x + 4.0 * rx, y + 4.0 * ry);
}

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

    const mobile = window.innerWidth < 768;
    const SPACING = mobile ? 28 : 22;
    const MAX_RADIUS = 7.5;
    const MIN_RADIUS = 0.4;

    const animate = () => {
      time += 0.003;

      ctx.fillStyle = '#0a2318';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cols = Math.ceil(canvas.width / SPACING) + 1;
      const rows = Math.ceil(canvas.height / SPACING) + 1;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * SPACING;
          const y = row * SPACING;

          const nx = x * 0.003;
          const ny = y * 0.003;

          const raw = marble(nx, ny, time);
          const value = Math.max(0, Math.min(1, (raw + 1) / 2));

          const t = Math.pow(value, 1.4);
          const radius = MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);

          const opacity = 0.08 + value * 0.72;

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(232, 220, 200, ${opacity.toFixed(3)})`;
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
      }}
    />
  );
}
