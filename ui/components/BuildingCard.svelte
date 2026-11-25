<script lang="ts">
  import { ui, S, R, act } from '../game.svelte';
  import { BLD, build, buildingCost, setActive } from '../../sim';
  import { costEta, costLines, effectText, hold } from '../util';
  import Cost from './Cost.svelte';
  import Icon from './Icon.svelte';

  let { id }: { id: string } = $props();
  const b = $derived(BLD[id]);
  const v = $derived.by(() => {
    const s = S();
    const r = R();
    const count = s.buildings[id] ?? 0;
    const lines = costLines(s, r, buildingCost(s, id));
    const maxed = b.max !== undefined && count >= b.max;
    const active = b.toggle ? Math.min(count, s.active[id] ?? count) : count;
    const eff = r.eff[id];
    return { count, lines, maxed, ok: lines.every((l) => l.ok), eta: costEta(lines), active, eff, effects: effectText(s, b) };
  });
  let bump = $state(0);
  function buy() {
    const ok = act((s) => build(s, id));
    if (ok) bump++;
    return ok;
  }
</script>

<article class="card bcard" class:project={b.category === 'project'} class:ready={v.ok && !v.maxed}>
  <div class="top">
    <button class="tap title" onclick={() => (ui.sheet = { kind: 'building', id })}>
      <span class="nm">{b.name}</span>
      {#key bump}<span class="count num" class:pop={bump > 0}>{v.count}</span>{/key}
      <Icon name="info" size={14} />
    </button>
    {#if !v.maxed}
      <button class="btn primary buybtn" disabled={!v.ok} use:hold={buy} aria-label="Build {b.name}">Build</button>
    {:else}
      <span class="done">Complete</span>
    {/if}
  </div>
  <p class="effects">
    {#each v.effects as e, i}<span>{e}</span>{#if i < v.effects.length - 1}<span class="sep">·</span>{/if}{/each}
    {#if v.eff !== undefined && v.count > 0 && v.eff < 0.98}<span class="eff warn num">running at {Math.round(v.eff * 100)}%</span>{/if}
  </p>
  {#if !v.maxed}<Cost lines={v.lines} />{/if}
  {#if b.toggle && v.count > 0}
    <div class="toggle" aria-label="Running">
      <span class="muted small">Running</span>
      <button class="btn small icon ghost" disabled={v.active <= 0} onclick={() => act((s) => setActive(s, id, v.active - 1))} aria-label="Run one fewer"><Icon name="minus" size={16} /></button>
      <span class="num on" class:warn={v.active < v.count}>{v.active}/{v.count}</span>
      <button class="btn small icon ghost" disabled={v.active >= v.count} onclick={() => act((s) => setActive(s, id, v.active + 1))} aria-label="Run one more"><Icon name="plus" size={16} /></button>
    </div>
  {/if}
</article>

<style>
  .bcard { display: flex; flex-direction: column; gap: 6px; transition: border-color 0.2s; }
  .bcard.ready { border-color: rgba(255, 138, 61, 0.35); }
  .bcard.project { background: linear-gradient(160deg, rgba(255, 138, 61, 0.08), var(--panel) 60%); }
  .top { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 36px; }
  .title { display: inline-flex; align-items: center; gap: 8px; color: var(--text); min-height: 36px; flex: 1; min-width: 0; }
  .title :global(svg) { flex: none; }
  .title :global(svg) { color: var(--faint); }
  .nm { font-weight: 650; min-width: 0; }
  .count {
    flex: none; min-width: 24px; padding: 1px 7px; border-radius: 999px; background: var(--accent-soft); color: var(--accent-2);
    font-size: 12px; text-align: center;
  }
  .toggle { display: flex; align-items: center; gap: 2px; border-top: 1px solid var(--line); padding-top: 4px; }
  .small { font-size: 12px; margin-right: auto; }
  .buybtn { flex: none; min-width: 76px; padding: 0 14px; }
  .toggle .btn { width: 36px; }
  .on { font-size: 12px; color: var(--muted); min-width: 56px; text-align: center; }
  .on.warn { color: var(--warn); }
  .effects { margin: 0; font-size: 13px; color: var(--muted); display: flex; flex-wrap: wrap; gap: 2px 6px; }
  .sep { color: var(--faint); }
  .eff { font-size: 12px; }
  .done { font-size: 13px; color: var(--good); font-weight: 600; }
</style>
