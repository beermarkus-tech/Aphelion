<script lang="ts">
  import { S } from '../game.svelte';
  import { DATA } from '../../sim';
  import { seasonInfo } from '../util';

  /** How each building is drawn, its footprint width, and how many copies we bother showing. */
  const LOOK: Record<string, { kind: string; w: number; max: number }> = {
    scrapyard: { kind: 'pile', w: 16, max: 3 },
    shelter: { kind: 'dome', w: 18, max: 5 },
    tent: { kind: 'tent', w: 13, max: 4 },
    barrel: { kind: 'barrel', w: 6, max: 4 },
    crate: { kind: 'crate', w: 10, max: 3 },
    terminal: { kind: 'dish', w: 12, max: 2 },
    sifter: { kind: 'sifter', w: 13, max: 2 },
    greenhouse: { kind: 'green', w: 20, max: 3 },
    burner: { kind: 'stack', w: 11, max: 2 },
    solar: { kind: 'solar', w: 14, max: 5 },
    refinery: { kind: 'tank', w: 12, max: 2 },
    smelter: { kind: 'smelter', w: 16, max: 3 },
    kiln: { kind: 'smelter', w: 16, max: 2 },
    vat: { kind: 'tank', w: 12, max: 2 },
    hydroponics: { kind: 'green', w: 20, max: 2 },
    electrolyzer: { kind: 'tank', w: 12, max: 2 },
    warehouse: { kind: 'shed', w: 24, max: 2 },
    archive: { kind: 'crate', w: 10, max: 2 },
    infirmary: { kind: 'dome', w: 18, max: 2 },
    hab: { kind: 'hab', w: 22, max: 5 },
    workshop: { kind: 'shed', w: 22, max: 2 },
    exchanger: { kind: 'stack', w: 11, max: 2 },
    lab: { kind: 'lab', w: 18, max: 2 },
    fabricator: { kind: 'shed', w: 22, max: 2 },
    geothermal: { kind: 'geo', w: 14, max: 2 },
    depot: { kind: 'shed', w: 24, max: 1 },
    quarters: { kind: 'quarters', w: 30, max: 1 },
    ignition: { kind: 'spire', w: 18, max: 1 },
  };

  const SKY: Record<string, [string, string, string]> = {
    thaw: ['#0a0d1c', '#2a1f3d', '#6b3a2e'],
    bloom: ['#0c1020', '#3b2a3a', '#a2552d'],
    dust: ['#120e10', '#3a2a22', '#7a5434'],
    winter: ['#05070f', '#141d33', '#2f3f5c'],
  };

  const v = $derived.by(() => {
    const s = S();
    const info = seasonInfo(s);
    const items: { id: string; kind: string; w: number }[] = [];
    // interleave building types so the skyline looks mixed rather than sorted
    const queue = DATA.buildings
      .filter((b) => LOOK[b.id] && (s.buildings[b.id] ?? 0) > 0)
      .map((b) => ({ id: b.id, left: Math.min(s.buildings[b.id], LOOK[b.id].max) }));
    let any = true;
    while (any) {
      any = false;
      for (const q of queue) if (q.left > 0) { items.push({ id: q.id, ...LOOK[q.id] }); q.left--; any = true; }
    }
    // place center-out around the crashed pod; overflow goes to a back row
    const front: { kind: string; x: number; i: number }[] = [];
    const back: { kind: string; x: number; i: number }[] = [];
    let r = 338, l = 286, rb = 330, lb = 300;
    items.forEach((it, i) => {
      const gap = 4;
      if (r + it.w < 600 || l - it.w > 40) {
        if ((i % 2 === 0 && r + it.w < 600) || l - it.w <= 40) { front.push({ kind: it.kind, x: r, i }); r += it.w + gap; }
        else { l -= it.w + gap; front.push({ kind: it.kind, x: l, i }); }
      } else if (rb + it.w < 620 || lb - it.w > 20) {
        if ((i % 2 === 0 && rb + it.w < 620) || lb - it.w <= 20) { back.push({ kind: it.kind, x: rb, i }); rb += it.w + gap; }
        else { lb -= it.w + gap; back.push({ kind: it.kind, x: lb, i }); }
      }
    });
    const people = Math.min(s.pop, 16);
    return { front, back, season: info.season.id, progress: info.progress, people, motion: s.settings.motion, ignition: (s.buildings.ignition ?? 0) > 0 };
  });
  const sky = $derived(SKY[v.season] ?? SKY.thaw);
  // the distant sun crawls across the sky once per season
  const sunX = $derived(80 + v.progress * 480);
  const sunY = $derived(52 - Math.sin(v.progress * Math.PI) * 26);
  const stars = Array.from({ length: 40 }, (_, i) => ({ x: (i * 157.3) % 640, y: ((i * 71.7) % 70) + 4, r: i % 7 === 0 ? 1 : 0.55, d: (i % 5) * 0.7 }));
  const flakes = Array.from({ length: 36 }, (_, i) => ({ x: (i * 97.1) % 640, d: (i % 9) * 0.8, dur: 5 + (i % 5) }));
</script>

{#snippet thing(kind: string, x: number, i: number)}
  <g transform="translate({x} 0)">
    {#if kind === 'dome'}
      <path d="M0 132 A9 9 0 0 1 18 132 Z" fill="#3a4250" /><path d="M3 129 A6 6 0 0 1 9 124" stroke="#6b7686" fill="none" stroke-width="0.8" />
      <rect x="8" y="128" width="3" height="4" fill="#ffcf8a" class="win" style="animation-delay:{i * 0.7}s" />
    {:else if kind === 'hab'}
      <rect x="0" y="122" width="22" height="10" rx="5" fill="#465063" /><rect x="4" y="125" width="3" height="3" fill="#ffd9a0" class="win" style="animation-delay:{i * 0.5}s" /><rect x="10" y="125" width="3" height="3" fill="#ffd9a0" /><rect x="16" y="125" width="3" height="3" fill="#ffd9a0" class="win" style="animation-delay:{i * 0.9}s" />
    {:else if kind === 'tent'}
      <path d="M0 132 L6.5 123 L13 132 Z" fill="#4c5a3e" /><path d="M6.5 123 L6.5 132" stroke="#77905f" stroke-width="0.6" />
    {:else if kind === 'green'}
      <path d="M0 132 A10 8 0 0 1 20 132 Z" fill="#2c5a3f" opacity="0.9" /><path d="M0 132 A10 8 0 0 1 20 132 Z" fill="url(#glowGreen)" />
    {:else if kind === 'pile'}
      <path d="M0 132 L4 127 L7 128 L10 124 L16 132 Z" fill="#5a4c3f" /><rect x="9" y="125" width="3" height="2" fill="#8a7a66" transform="rotate(20 10 126)" />
    {:else if kind === 'barrel'}
      <rect x="0" y="126" width="6" height="6" fill="#4a3a30" /><ellipse cx="3" cy="125" rx="2.4" ry="3" fill="#ff8a3d" class="flame" style="animation-delay:{i * 0.3}s" />
    {:else if kind === 'crate'}
      <rect x="0" y="125" width="10" height="7" fill="#5b5346" /><path d="M0 125 L10 132 M10 125 L0 132" stroke="#3b352c" stroke-width="0.6" />
    {:else if kind === 'dish'}
      <rect x="5" y="124" width="2" height="8" fill="#5a6474" /><path d="M1 123 Q6 128 11 121" stroke="#9aa6b8" fill="none" stroke-width="1.4" /><circle cx="6" cy="120" r="0.8" fill="#ff6f6f" class="blink" />
    {:else if kind === 'sifter'}
      <path d="M0 132 L3 124 L10 124 L13 132 Z" fill="#4e4a52" /><rect x="5" y="120" width="3" height="4" fill="#6a6470" />
    {:else if kind === 'solar'}
      <rect x="6" y="126" width="1.2" height="6" fill="#56606e" /><path d="M0 127 L13 122 L14 124 L1 129 Z" fill="#2b4a7a" stroke="#6f9ad6" stroke-width="0.4" />
    {:else if kind === 'tank'}
      <rect x="1" y="122" width="10" height="10" rx="4" fill="#4a5566" /><rect x="3" y="126" width="6" height="1" fill="#7d8aa0" />
    {:else if kind === 'stack'}
      <rect x="2" y="120" width="5" height="12" fill="#4b4f58" /><rect x="0" y="127" width="11" height="5" fill="#3d4149" />
      {#if v.motion}<circle cx="4.5" cy="118" r="2" class="smoke" style="animation-delay:{i * 0.6}s" /><circle cx="4.5" cy="118" r="2" class="smoke" style="animation-delay:{i * 0.6 + 1.5}s" />{/if}
    {:else if kind === 'smelter'}
      <rect x="0" y="124" width="12" height="8" fill="#4d4642" /><rect x="10" y="114" width="4" height="18" fill="#5a524c" /><rect x="3" y="127" width="5" height="3" fill="#ff9a4d" class="flame" />
      {#if v.motion}<circle cx="12" cy="112" r="2.4" class="smoke" style="animation-delay:{i * 0.8}s" /><circle cx="12" cy="112" r="2.4" class="smoke" style="animation-delay:{i * 0.8 + 1.6}s" />{/if}
    {:else if kind === 'shed'}
      <path d="M0 132 L0 124 L12 120 L24 124 L24 132 Z" fill="#454b55" /><rect x="9" y="126" width="6" height="6" fill="#2b2f36" /><rect x="2" y="126" width="3" height="2" fill="#ffd9a0" />
    {:else if kind === 'lab'}
      <rect x="0" y="124" width="14" height="8" fill="#4a5262" /><rect x="15" y="116" width="1.2" height="16" fill="#7b8698" /><circle cx="15.6" cy="115" r="1" fill="#74b6ff" class="blink" /><rect x="3" y="127" width="8" height="2" fill="#9fd0ff" opacity="0.8" />
    {:else if kind === 'geo'}
      <path d="M2 132 L5 116 L9 116 L12 132 Z" fill="#525a66" /><rect x="4" y="114" width="6" height="2" fill="#7a8594" />
      {#if v.motion}<circle cx="7" cy="112" r="2.5" class="steam" /><circle cx="7" cy="112" r="2.5" class="steam" style="animation-delay:1.3s" />{/if}
    {:else if kind === 'quarters'}
      <rect x="0" y="118" width="30" height="14" fill="#4b5466" /><rect x="0" y="116" width="30" height="2" fill="#6a768a" />
      {#each [3, 9, 15, 21] as wx (wx)}<rect x={wx} y="121" width="4" height="3" fill="#ffd9a0" /><rect x={wx} y="126" width="4" height="3" fill="#ffd9a0" class="win" style="animation-delay:{wx * 0.2}s" />{/each}
    {:else if kind === 'spire'}
      <path d="M5 132 L8 96 L10 96 L13 132 Z" fill="#5c6678" /><circle cx="9" cy="94" r="4" fill="url(#glowSun)" class="pulse" />
    {/if}
  </g>
{/snippet}

<div class="scene" class:still={!v.motion} aria-hidden="true">
  <svg viewBox="0 0 640 160" preserveAspectRatio="xMidYMax slice">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color={sky[0]} /><stop offset="0.6" stop-color={sky[1]} /><stop offset="1" stop-color={sky[2]} />
      </linearGradient>
      <radialGradient id="glowSun"><stop offset="0" stop-color="#fff1dc" /><stop offset="0.25" stop-color="#ffb47a" /><stop offset="1" stop-color="#ff8a3d" stop-opacity="0" /></radialGradient>
      <radialGradient id="glowGreen" cx="50%" cy="100%" r="80%"><stop offset="0" stop-color="#8dffb8" stop-opacity="0.55" /><stop offset="1" stop-color="#8dffb8" stop-opacity="0" /></radialGradient>
      <linearGradient id="planet" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6d5a7c" /><stop offset="1" stop-color="#1d1828" /></linearGradient>
      <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1a1f" /><stop offset="1" stop-color="#0d0d10" /></linearGradient>
    </defs>
    <rect width="640" height="160" fill="url(#sky)" />
    {#each stars as st, k (k)}<circle cx={st.x} cy={st.y} r={st.r} fill="#e8ecf4" class="tw" style="animation-delay:{st.d}s" opacity={v.season === 'winter' ? 0.9 : 0.6} />{/each}
    <!-- gas giant with ring -->
    <g opacity="0.85">
      <circle cx="560" cy="40" r="26" fill="url(#planet)" />
      <path d="M528 46 Q560 30 594 36" stroke="#a894b4" stroke-width="1.2" fill="none" opacity="0.7" />
      <ellipse cx="560" cy="41" rx="42" ry="7" fill="none" stroke="#c9b6d4" stroke-width="1.4" opacity="0.55" transform="rotate(-12 560 41)" />
    </g>
    <!-- the far, small sun -->
    <circle cx={sunX} cy={sunY} r="18" fill="url(#glowSun)" opacity="0.8" />
    <circle cx={sunX} cy={sunY} r="3" fill="#fff4e4" />
    <!-- terrain -->
    <path d="M0 112 L40 98 L90 108 L140 92 L190 104 L250 96 L300 106 L360 90 L420 102 L470 94 L530 106 L590 96 L640 104 L640 160 L0 160 Z" fill="#221f28" opacity="0.9" />
    <path d="M0 122 L60 114 L120 120 L200 112 L280 120 L360 114 L440 121 L520 113 L600 119 L640 116 L640 160 L0 160 Z" fill="#19181e" />
    {#each v.back as b (b.i)}<g transform="translate({b.x * 0.15} -1) scale(0.85 0.9)" opacity="0.7">{@render thing(b.kind, b.x, b.i)}</g>{/each}
    <rect x="0" y="131" width="640" height="29" fill="url(#ground)" />
    <!-- the crashed pod, always there -->
    <g transform="translate(300 0)">
      <path d="M0 132 L4 121 Q16 114 30 120 L34 132 Z" fill="#5a5f6a" transform="rotate(-8 17 126)" />
      <rect x="11" y="122" width="6" height="3" fill="#ffb47a" opacity="0.8" transform="rotate(-8 17 126)" />
      <path d="M-6 132 L2 129 L8 132 Z" fill="#3e424b" />
    </g>
    {#each v.front as b (b.i)}{@render thing(b.kind, b.x, b.i)}{/each}
    <!-- survivors -->
    {#each Array(v.people) as _, k (k)}
      <g class="walker" style="--dur:{14 + (k % 5) * 4}s; --delay:-{k * 3.1}s; --from:{250 + ((k * 37) % 140) - 70}px; --to:{250 + ((k * 53) % 200)}px">
        <rect x="0" y="133" width="1.6" height="3.4" fill="#d8dde6" /><circle cx="0.8" cy="132.2" r="0.9" fill="#d8dde6" />
      </g>
    {/each}
    {#if v.ignition}<g opacity="0.07"><rect x="0" y="0" width="640" height="160" fill="#ff8a3d" class="pulse" /></g>{/if}
    {#if v.season === 'winter' && v.motion}
      {#each flakes as f, k (k)}<circle cx={f.x} cy="-4" r="0.9" fill="#e6efff" class="snow" style="animation-delay:-{f.d}s; animation-duration:{f.dur}s" />{/each}
    {:else if v.season === 'dust'}
      <g opacity="0.14"><rect x="0" y="80" width="640" height="80" fill="#a77a4f" class:haze={v.motion} /></g>
    {/if}
  </svg>
</div>

<style>
  .scene {
    margin: 12px 0 4px; border-radius: var(--radius); overflow: hidden; border: 1px solid var(--line);
    height: 128px; background: #0a0d1c;
  }
  @media (min-width: 768px) { .scene { height: 170px; } }
  @media (min-width: 1400px) { .scene { height: 200px; } }
  svg { display: block; width: 100%; height: 100%; }
  .tw { animation: tw 4s ease-in-out infinite alternate; }
  .win { animation: win 6s steps(1) infinite; }
  .blink { animation: blink 1.6s steps(1) infinite; }
  .flame { animation: flame 0.35s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: 50% 100%; }
  .smoke, .steam { fill: #8a8f99; opacity: 0; animation: smoke 3.2s ease-out infinite; transform-box: fill-box; transform-origin: center; }
  .steam { fill: #c9d3e0; }
  .pulse { animation: pulse 2.4s ease-in-out infinite alternate; }
  .walker { animation: walk var(--dur) linear var(--delay) infinite alternate; }
  .snow { animation: snow 6s linear infinite; }
  .haze { animation: pulse 5s ease-in-out infinite alternate; }
  .still :global(*) { animation: none !important; }
  @keyframes tw { from { opacity: 0.25; } to { opacity: 0.9; } }
  @keyframes win { 0%, 70% { opacity: 1; } 71%, 100% { opacity: 0.35; } }
  @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0.15; } }
  @keyframes flame { from { transform: scaleY(0.75); opacity: 0.8; } to { transform: scaleY(1.15); opacity: 1; } }
  @keyframes smoke { 0% { opacity: 0.5; transform: translate(0, 0) scale(0.6); } 100% { opacity: 0; transform: translate(6px, -16px) scale(2.2); } }
  @keyframes pulse { from { opacity: 0.6; } to { opacity: 1; } }
  @keyframes walk { from { transform: translateX(var(--from)); } to { transform: translateX(var(--to)); } }
  @keyframes snow { from { transform: translate(0, 0); } to { transform: translate(-30px, 170px); } }
</style>
