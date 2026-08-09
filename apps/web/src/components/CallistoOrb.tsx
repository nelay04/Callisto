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
  /** Direction this particle flies during the scatter flourish, in radians. */
  scatterAngle: number;
  /** How far along that direction, as a fraction of the viewport diagonal. */
  scatterReach: number;
}

/** Scatter timeline, in milliseconds from the moment it is triggered. */
const SCATTER = { out: 700, hold: 1100, back: 900 } as const;
const SCATTER_TOTAL = SCATTER.out + SCATTER.hold + SCATTER.back;

// The canvas sits inside the orb's square normally, and is promoted to a
// full-viewport overlay for the duration of the flourish.
const CANVAS_INLINE = 'absolute inset-0 w-full h-full';
const CANVAS_OVERLAY = 'fixed inset-0 z-50 pointer-events-none';

interface CallistoOrbProps {
  /** Current audio level 0–1. Drives particle displacement and glow. */
  audioLevel?: number;
  /** Whether a live session is active (affects glow intensity). */
  isActive?: boolean;
  /**
   * Increment to fling the particles across the viewport and reassemble them.
   * A counter rather than a boolean, so repeat triggers replay the animation.
   */
  scatterToken?: number;
  onClick?: () => void;
}

export default function CallistoOrb({
  audioLevel = 0,
  isActive = false,
  scatterToken = 0,
  onClick,
}: CallistoOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const timeRef = useRef(0);
  const audioRef = useRef(0);
  const rafRef = useRef(0);
  const scatterStartRef = useRef<number | null>(null);

  // While scattering, the canvas is promoted to a full-viewport overlay so the
  // particles are not clipped by the small square the orb normally occupies.
  // The orb itself keeps its exact screen position, so the promotion is
  // invisible — only the drawable area changes.
  //
  // Driven through the DOM rather than React state: the canvas is an external
  // system, and re-rendering to move it would tear down the animation loop
  // mid-flourish.
  const overlayRef = useRef(false);
  const geometryRef = useRef({ cx: 0, cy: 0, r: 0 });
  const resizeRef = useRef<() => void>(() => {});

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
        scatterAngle: Math.random() * Math.PI * 2,
        scatterReach: 0.15 + Math.random() * 0.85,
      });
    }

    particlesRef.current = particles;
  }, []);

  // ── Sync audio level prop into ref so the render loop sees it ────────────
  useEffect(() => {
    audioRef.current = audioLevel;
  }, [audioLevel]);

  // ── Scatter flourish ─────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (scatterToken <= 0 || !canvas) return;

    scatterStartRef.current = performance.now();
    overlayRef.current = true;
    canvas.className = CANVAS_OVERLAY;
    resizeRef.current();

    // Drop back out of overlay once the particles are home. Kept slightly
    // longer than the animation so the final frame is never clipped.
    const id = setTimeout(() => {
      scatterStartRef.current = null;
      overlayRef.current = false;
      canvas.className = CANVAS_INLINE;
      resizeRef.current();
    }, SCATTER_TOTAL + 120);

    return () => clearTimeout(id);
  }, [scatterToken]);

  // ── Render loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const resize = () => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      const rect = wrapper.getBoundingClientRect();

      // Full-viewport at native DPR would quadruple the fill cost on a retina
      // display, for ~2.7s of fast-moving particles where nobody can see the
      // extra resolution. Capping it keeps the main thread responsive — a
      // stalled tab starves the microphone callback and looks like a dropped
      // connection.
      const dpr = overlayRef.current ? 1 : window.devicePixelRatio || 1;

      // In overlay mode the canvas spans the viewport, so the orb's centre is
      // the wrapper's centre in viewport coordinates rather than the middle of
      // the canvas. The radius comes from the wrapper either way, which is what
      // keeps the orb the same size across the switch.
      const w = overlayRef.current ? window.innerWidth : rect.width;
      const h = overlayRef.current ? window.innerHeight : rect.height;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      geometryRef.current = {
        cx: overlayRef.current ? rect.left + rect.width / 2 : rect.width / 2,
        cy: overlayRef.current ? rect.top + rect.height / 2 : rect.height / 2,
        r: Math.min(rect.width, rect.height) * 0.38,
      };
    };

    resizeRef.current = resize;

    window.addEventListener('resize', resize);
    // Also on scroll: in overlay mode the orb's centre is a viewport coordinate.
    window.addEventListener('scroll', resize, { passive: true });
    resize();

    const render = () => {
      timeRef.current += 0.002;
      const t = timeRef.current;
      const audio = audioRef.current;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      const { cx, cy, r: baseR } = geometryRef.current;
      const R = baseR * (1 + audio * 0.05);

      // 0 while idle, 1 at full spread. Ease out on the way apart and ease in
      // on the way home, so the particles leave fast and settle rather than
      // snapping back into the sphere.
      let scatter = 0;
      if (scatterStartRef.current !== null) {
        const e = performance.now() - scatterStartRef.current;
        if (e < SCATTER.out) {
          const k = e / SCATTER.out;
          scatter = 1 - Math.pow(1 - k, 3);
        } else if (e < SCATTER.out + SCATTER.hold) {
          scatter = 1;
        } else if (e < SCATTER_TOTAL) {
          const k = (e - SCATTER.out - SCATTER.hold) / SCATTER.back;
          scatter = 1 - (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
        }
      }

      const reach = Math.hypot(w, h) * 0.55;

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

        // Back-face culling is skipped mid-scatter: hidden particles are part
        // of the cloud once the sphere has come apart, and popping them in at
        // the end would read as a glitch.
        if (z2 > -0.2 || scatter > 0.02) {
          const persp = 1 + z2 * 0.3;
          let sx = cx + x1 * R * persp;
          let sy = cy + y2 * R * persp;
          const sz = p.size * persp * (1 + audio * 0.2);

          if (scatter > 0) {
            // Each particle drifts slowly while dispersed, so the held phase is
            // a floating cloud rather than a frozen still.
            const drift = t * 6 * p.speed + p.randomOffset;
            const d = reach * p.scatterReach * scatter;
            sx += Math.cos(p.scatterAngle + Math.sin(drift) * 0.15) * d;
            sy += Math.sin(p.scatterAngle + Math.cos(drift) * 0.15) * d;
          }

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
      window.removeEventListener('scroll', resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="relative w-full aspect-square cursor-pointer"
      onClick={onClick}
      role="button"
      aria-label={isActive ? 'Click to stop Callisto' : 'Click to start Callisto'}
    >
      <canvas
        ref={canvasRef}
        className={CANVAS_INLINE}
        style={{
          filter: `drop-shadow(0 0 ${isActive ? 50 : 30}px rgba(0,0,0,0.85))`,
          transition: 'filter 0.6s ease',
        }}
      />
    </div>
  );
}
