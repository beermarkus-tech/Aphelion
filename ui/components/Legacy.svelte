<script lang="ts">
  import { ui, S, act } from '../game.svelte';
  import { DATA, WORLD, ascensionGain, buyPerk, canAscend, canRebuild, fmtTime, m, nextRebuildScore, perkCost, rebuildGain } from '../../sim';
  import { n } from '../util';

  const ERAS = [
    { n: 'I', name: 'Cinder', scale: 'A single colony', mech: 'Population, jobs, buildings, crafting' },
    { n: 'II', name: 'Orbit', scale: 'The home system', mech: 'Generators that build generators' },
    { n: 'III', name: 'Drift', scale: 'Nearby stars', mech: 'Fleets, routes, colonies' },
    { n: 'IV', name: 'Lattice', scale: 'The galaxy', mech: 'Megastructures' },
    { n: 'V', name: 'Aphelion', scale: 'The universe', mech: 'Rewriting physical constants' },
  ];

  const v = $derived.by(() => {
    const s = S();
    const p = s.prestige;
    return {
      s, p,
      gain: rebuildGain(s),
      next: nextRebuildScore(s),
      can: canRebuild(s),
      popOk: s.peakPop >= WORLD.rebuild.minPop,
      asc: canAscend(s),
      ascGain: ascensionGain(s),
      global: m(s, 'global'),
      perks: DATA.legacy.map((x) => ({ ...x, lvl: p.perks[x.id] ?? 0, cost: perkCost(s, x.id) })),
    };
  });
</script>

<section class="card rebuild">
  <div class="hd">
    <div>
      <h2>Rebuild</h2>
      <p class="muted">Start this colony over and keep Legacy. Legacy buys permanent perks, and every unspent point adds +{Math.round(WORLD.rebuild.legacyBonus * 100)}% to all production.</p>
    </div>
    <div class="legacy">
      <div class="num lv">{v.p.legacy}</div>
      <div class="muted tiny">Legacy</div>
    </div>
  </div>
  <div class="proj">
    <div><span class="muted">Colony score</span> <span class="num">{n(v.s, v.s.run.score, 0)}</span></div>
    <div><span class="muted">Rebuild now for</span> <strong class="num accent">+{v.gain} Legacy</strong></div>
    <div class="muted tiny num">Next point at score {n(v.s, v.next, 0)}</div>
    {#if !v.popOk}<div class="warn tiny">Needs a colony of at least {WORLD.rebuild.minPop} survivors first.</div>{/if}
  </div>
  <button class="btn primary wide" disabled={!v.can} onclick={() => (ui.sheet = { kind: 'rebuild' })}>Rebuild for +{v.gain} Legacy…</button>
</section>

<h2 class="section-title">Legacy perks</h2>
<div class="grid-cards">
  {#each v.perks as pk (pk.id)}
    <article class="card perk">
      <div class="phd"><span class="nm">{pk.name}</span><span class="num lvl">{pk.lvl}/{pk.max}</span></div>
      <p class="muted desc">{pk.desc}</p>
      <button class="btn small" disabled={pk.lvl >= pk.max || v.p.legacy < pk.cost} onclick={() => act((s) => buyPerk(s, pk.id), 'research')}>
        {pk.lvl >= pk.max ? 'Maxed' : `Buy · ${pk.cost} Legacy`}
      </button>
    </article>
  {/each}
</div>

<h2 class="section-title">Ascension</h2>
<section class="card ascend" class:ready={v.asc}>
  {#if v.asc}
    <p>The Ignition Chamber is burning. The colony can leave the ground for good.</p>
    <p class="muted">Ascending ends Era I: Legacy and perks reset, you gain <strong class="accent">{v.ascGain} Launch Credit{v.ascGain === 1 ? '' : 's'}</strong> (+{Math.round(WORLD.ascension.creditBonus * 100)}% production each), and a permanent echo of the Legacy you earned.</p>
    <button class="btn primary wide" onclick={() => (ui.sheet = { kind: 'ascend' })}>Ascend…</button>
  {:else}
    <p class="muted">Build the Ignition Chamber (research Controlled Ignition, which needs Reactor Cores) to unlock Ascension and the next scale.</p>
  {/if}
  {#if v.p.credits > 0}<p class="num tiny">Launch Credits: {v.p.credits} · Ascensions: {v.p.ascensions}</p>{/if}
</section>

<h2 class="section-title">The five eras</h2>
<ol class="eras">
  {#each ERAS as e, i (e.n)}
    <li class:now={i === 0} class:locked={i > 0}>
      <span class="en num">{e.n}</span>
      <div>
        <div class="et">{i === 0 || v.p.ascensions > 0 || i === 1 ? e.name : '???'}</div>
        <div class="muted tiny">{i <= 1 || v.p.ascensions > 0 ? `${e.scale} · ${e.mech}` : 'Beyond the signal'}</div>
      </div>
      {#if i === 0}<span class="chip">Now</span>{:else if i === 1 && v.p.ascensions > 0}<span class="chip">Coming next update</span>{/if}
    </li>
  {/each}
</ol>

<h2 class="section-title">Records</h2>
<dl class="stats card">
  <div><dt>Production multiplier</dt><dd class="num">×{n(v.s, v.global)}</dd></div>
  <div><dt>Rebuilds</dt><dd class="num">{v.p.rebuilds}</dd></div>
  <div><dt>Legacy earned</dt><dd class="num">{v.p.legacyEarned}</dd></div>
  <div><dt>Best colony score</dt><dd class="num">{n(v.s, Math.max(v.p.bestScore, v.s.run.score), 0)}</dd></div>
  <div><dt>This run</dt><dd class="num">{fmtTime(v.s.time)}</dd></div>
  <div><dt>Total time</dt><dd class="num">{fmtTime(v.s.totalTime)}</dd></div>
  <div><dt>Peak survivors</dt><dd class="num">{v.s.peakPop}</dd></div>
  <div><dt>Items crafted</dt><dd class="num">{v.s.stats.crafted}</dd></div>
</dl>

<style>
  .card h2 { margin: 0 0 4px; font-size: 17px; }
  .rebuild { margin-top: 12px; display: flex; flex-direction: column; gap: 12px; border-color: rgba(255, 138, 61, 0.35); }
  .hd { display: flex; justify-content: space-between; gap: 12px; }
  .hd p { margin: 0; font-size: 13px; }
  .legacy { text-align: center; flex: none; padding: 6px 12px; border-radius: var(--radius-sm); background: var(--accent-soft); }
  .lv { font-size: 24px; font-weight: 700; color: var(--accent-2); }
  .tiny { font-size: 12px; }
  .proj { display: grid; gap: 4px; font-size: 14px; }
  .wide { width: 100%; }
  .perk { display: flex; flex-direction: column; gap: 6px; }
  .phd { display: flex; justify-content: space-between; }
  .nm { font-weight: 650; }
  .lvl { font-size: 12px; color: var(--muted); }
  .desc { margin: 0; font-size: 13px; flex: 1; }
  .ascend p { margin: 0 0 10px; font-size: 14px; }
  .ascend.ready { border-color: var(--accent); }
  .eras { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
  .eras li { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: var(--radius-sm); background: var(--panel); border: 1px solid var(--line); }
  .eras li.now { border-color: rgba(255, 138, 61, 0.45); }
  .eras li.locked { opacity: 0.55; }
  .eras li .chip { margin-left: auto; }
  .en { width: 28px; color: var(--accent-2); font-weight: 700; }
  .et { font-weight: 650; }
  .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; margin: 0; }
  .stats div { display: flex; flex-direction: column; }
  dt { font-size: 12px; color: var(--muted); }
  dd { margin: 0; font-size: 15px; }
</style>
