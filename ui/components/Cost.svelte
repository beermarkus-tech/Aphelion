<script lang="ts">
  import { S } from '../game.svelte';
  import { fmtTime } from '../../sim';
  import { n, name, type CostLine } from '../util';
  let { lines }: { lines: CostLine[] } = $props();
  const s = $derived(S());
</script>

<ul class="cost">
  {#each lines as l (l.res)}
    <li class:ok={l.ok} class:over={l.overCap}>
      <span class="r">{name(l.res)}</span>
      <span class="num v">{n(s, Math.min(l.have, l.need), l.need < 10 ? 1 : 0)}<span class="faint">/{n(s, l.need, l.need < 10 ? 1 : 0)}</span></span>
      {#if l.overCap}<span class="tag">over cap</span>
      {:else if !l.ok && l.eta !== null}<span class="tag eta num">{fmtTime(l.eta)}</span>{/if}
    </li>
  {/each}
</ul>

<style>
  .cost { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 6px; }
  li {
    display: inline-flex; align-items: center; gap: 6px; font-size: 12px; padding: 3px 8px; border-radius: 6px;
    background: var(--panel-3); color: var(--muted); border: 1px solid transparent;
  }
  li.ok { color: var(--text); }
  li.ok .v { color: var(--good); }
  li.over { border-color: rgba(243, 201, 105, 0.5); }
  .tag { font-size: 10px; color: var(--faint); white-space: nowrap; }
  li.over .tag { color: var(--warn); }
</style>
