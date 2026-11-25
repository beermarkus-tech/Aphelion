<script lang="ts">
  import { ui, S, R } from '../game.svelte';
  import { DATA, caps } from '../../sim';
  import { n, netRate, rate } from '../util';

  const groups = [
    { tier: 'raw', label: 'Raw' },
    { tier: 'refined', label: 'Refined' },
    { tier: 'component', label: 'Components' },
    { tier: 'science', label: 'Science' },
  ];

  const rows = $derived.by(() => {
    const s = S();
    const r = R();
    const cp = caps(s);
    return groups
      .map((g) => ({
        ...g,
        items: DATA.resources
          .filter((x) => x.tier === g.tier && (s.seen[x.id] ?? 0) > 0)
          .map((x) => ({ id: x.id, name: x.name, amt: s.res[x.id], cap: cp[x.id], net: netRate(r, x.id) })),
      }))
      .filter((g) => g.items.length);
  });
  const s = $derived(S());
</script>

<div class="res">
  {#each rows as g (g.tier)}
    <div class="gl">{g.label}</div>
    {#each g.items as it (it.id)}
      <button class="row tap" onclick={() => (ui.sheet = { kind: 'resource', id: it.id })}>
        <span class="nm">{it.name}</span>
        <span class="amt num" class:capped={it.cap !== Infinity && it.amt >= it.cap - 0.01}>
          {n(s, it.amt, it.amt < 10 ? 1 : 0)}{#if it.cap !== Infinity}<span class="faint">/{n(s, it.cap, 0)}</span>{/if}
        </span>
        <span class="rt num" class:good={it.net > 0.005} class:bad={it.net < -0.005}>{rate(s, it.net)}</span>
        {#if it.cap !== Infinity}
          <span class="bar" class:full={it.amt >= it.cap - 0.01}><i style="width:{Math.min(100, (it.amt / it.cap) * 100)}%"></i></span>
        {/if}
      </button>
    {/each}
  {:else}
    <p class="muted empty">Nothing stored yet. Scavenge the wreck to get started.</p>
  {/each}
</div>

<style>
  .gl { font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--faint); margin: 14px 2px 4px; font-weight: 700; }
  .row {
    width: 100%; display: grid; grid-template-columns: 1fr auto; grid-template-areas: 'nm amt' 'bar rt';
    gap: 2px 10px; padding: 8px 6px; border-radius: 6px; min-height: var(--tap); align-items: center;
  }
  .row:hover { background: var(--panel-2); }
  .nm { grid-area: nm; font-size: 14px; }
  .amt { grid-area: amt; text-align: right; font-size: 14px; }
  .amt.capped { color: var(--warn); }
  .rt { grid-area: rt; text-align: right; font-size: 11px; color: var(--muted); min-width: 64px; }
  .bar { grid-area: bar; align-self: center; }
  .empty { font-size: 13px; padding: 8px 2px; }
</style>
