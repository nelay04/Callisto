'use client';

import React, { useEffect, useRef } from 'react';

interface Particle {
  baseX: number;
  baseY: number;
  baseZ: number;
  color: string;
  size: number;
  randomOffset: number;
  speed: number;
}

interface CallistoOrbProps {
  /** Current audio level 0–1. Drives particle displacement and glow. */
  audioLevel?: number;
  /** Whether a live session is active (affects glow intensity). */
  isActive?: boolean;
  onClick?: () => void;
}

export default function CallistoOrb({
  audioLevel = 0,
  isActive = false,
  onClick,
}: CallistoOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const timeRef = useRef(0);
  const audioRef = useRef(0);
  const rafRef = useRef(0);

  // ── Build particle sphere once ───────────────────────────────────────────
  useEffect(() => {
    const NUM = 12000;
    const phi = Math.PI * (3 - Math.sqrt(5));
    const particles: Particle[] = [];

    for (let i = 0; i < NUM; i++) {
      const y = 1 - (i / (NUM - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = phi * i;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;

      // Two-light directional shading
      const l1 = { x: -0.8, y: -0.8, z: 0.5 }; // golden-pink (top-left)
      const l2 = { x: 0.8, y: 0.8, z: 0.5 };   // cyan-green (bottom-right)
      const d1 = Math.max(0, x * l1.x + y * l1.y + z * l1.z);
      const d2 = Math.max(0, x * l2.x + y * l2.y + z * l2.z);

      let cr = 60 + d1 * 180 + d2 * 10;
      let cg = 50 + d1 * 120 + d2 * 120;
      let cb = 45 + d1 * 110 + d2 * 140;

      const noise = (Math.random() - 0.5) * 60;
      cr += noise; cg += noise; cb += noise;

      let size = Math.random() * 1.0 + 0.2;
      let alpha = 0.4 + Math.random() * 0.5;

      // Ice-crater bright spots
      if (Math.random() > 0.95) {
        cr += 120; cg += 120; cb += 120;
        size += 0.6;
        alpha = 0.9;
      }

      const clamp = (v: number) => Math.floor(Math.min(255, Math.max(0, v)));
      particles.push({
        baseX: x, baseY: y, baseZ: z,
        color: `rgba(${clamp(cr)},${clamp(cg)},${clamp(cb)},${alpha})`,
        size,
        randomOffset: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random(),
      });
    }

    particlesRef.current = particles;
  }, []);

  // ── Sync audio level prop into ref so the render loop sees it ────────────
  useEffect(() => {
    audioRef.current = audioLevel;
  }, [audioLevel]);

  // ── Render loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = parent.clientWidth * dpr;
      canvas.height = parent.clientHeight * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${parent.clientWidth}px`;
      canvas.style.height = `${parent.clientHeight}px`;
    };

    window.addEventListener('resize', resize);
    resize();

    const render = () => {
      timeRef.current += 0.002;
      const t = timeRef.current;
      const audio = audioRef.current;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const baseR = Math.min(w, h) * 0.38;
      const R = baseR * (1 + audio * 0.05);

      const rotY = t * 0.2;
      const rotX = Math.sin(t * 0.1) * 0.1;
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);

      for (const p of particlesRef.current) {
        const disp = audio * 0.08 * Math.sin(t * 20 * p.speed + p.randomOffset);
        const m = 1 + disp;

        const x0 = p.baseX * m, y0 = p.baseY * m, z0 = p.baseZ * m;

        // Rotate Y then X
        const x1 = x0 * cosY - z0 * sinY;
        const z1 = z0 * cosY + x0 * sinY;
        const y2 = y0 * cosX - z1 * sinX;
        const z2 = z1 * cosX + y0 * sinX;

        if (z2 > -0.2) {
          const persp = 1 + z2 * 0.3;
          const sx = cx + x1 * R * persp;
          const sy = cy + y2 * R * persp;
          const sz = p.size * persp * (1 + audio * 0.2);

          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(sx, sy, sz, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      className="relative w-full aspect-square cursor-pointer"
      onClick={onClick}
      role="button"
      aria-label={isActive ? 'Click to stop Callisto' : 'Click to start Callisto'}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{
          filter: `drop-shadow(0 0 ${isActive ? 50 : 30}px rgba(0,0,0,0.85))`,
          transition: 'filter 0.6s ease',
        }}
      />
    </div>
  );
}
