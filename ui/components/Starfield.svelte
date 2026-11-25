<script lang="ts">
  import { onMount } from 'svelte';
  import { S } from '../game.svelte';

  let canvas: HTMLCanvasElement;

  interface Star { x: number; y: number; z: number; r: number; tw: number; ph: number; hue: number }

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let w = 0, h = 0, dpr = 1;
    let stars: Star[] = [];
    let shoot: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
    let raf = 0;
    let last = 0;
    let t = 0;

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round((w * h) / 2600);
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h, z: Math.random(),
        r: Math.random() < 0.06 ? 1.4 : 0.4 + Math.random() * 0.7,
        tw: 0.5 + Math.random() * 2, ph: Math.random() * 6.28,
        hue: Math.random() < 0.15 ? 25 : Math.random() < 0.3 ? 210 : 0,
      }));
      draw(0);
    }

    function draw(dt: number) {
      t += dt;
      ctx.clearRect(0, 0, w, h);
      // nebulae
      const g1 = ctx.createRadialGradient(w * 0.82, h * 0.18, 0, w * 0.82, h * 0.18, Math.max(w, h) * 0.55);
      g1.addColorStop(0, 'rgba(255,120,50,0.10)');
      g1.addColorStop(1, 'rgba(255,120,50,0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, w, h);
      const g2 = ctx.createRadialGradient(w * 0.1, h * 0.85, 0, w * 0.1, h * 0.85, Math.max(w, h) * 0.5);
      g2.addColorStop(0, 'rgba(90,110,255,0.08)');
      g2.addColorStop(1, 'rgba(90,110,255,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);
      for (const s of stars) {
        s.x -= dt * (2 + s.z * 6);
        if (s.x < -2) { s.x = w + 2; s.y = Math.random() * h; }
        const a = 0.35 + 0.65 * s.z * (0.6 + 0.4 * Math.sin(t * s.tw + s.ph));
        ctx.fillStyle = s.hue ? `hsla(${s.hue},90%,80%,${a})` : `rgba(230,235,245,${a})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, 6.283);
        ctx.fill();
      }
      if (!shoot && dt > 0 && Math.random() < dt * 0.04) {
        shoot = { x: Math.random() * w, y: Math.random() * h * 0.5, vx: -260 - Math.random() * 200, vy: 90 + Math.random() * 60, life: 1 };
      }
      if (shoot) {
        const s = shoot;
        const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 0.15, s.y - s.vy * 0.15);
        grad.addColorStop(0, `rgba(255,220,190,${0.8 * s.life})`);
        grad.addColorStop(1, 'rgba(255,220,190,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * 0.15, s.y - s.vy * 0.15);
        ctx.stroke();
        s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt * 1.2;
        if (s.life <= 0) shoot = null;
      }
    }

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      if (document.hidden || !S().settings.motion || reduce.matches) { last = now; return; }
      if (now - last < 33) return; // ~30 fps is plenty for a backdrop
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      draw(dt);
    }

    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  });
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
  canvas { position: fixed; inset: 0; width: 100vw; height: 100dvh; z-index: 0; pointer-events: none; }
</style>
