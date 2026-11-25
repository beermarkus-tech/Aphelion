<script lang="ts">
  import { S, act } from '../game.svelte';
  import { EVT, resolveEvent, fmtTime, WORLD } from '../../sim';
  let { index }: { index: number } = $props();
  const ev = $derived(S().events[index]);
  const def = $derived(ev ? EVT[ev.id] : null);
  const left = $derived(ev ? WORLD.eventExpiry - (S().totalTime - ev.at) : 0);
</script>

{#if def}
  <article class="card event" aria-live="polite">
    <div class="hd"><span class="kicker">Event</span><span class="faint num">answer within {fmtTime(left)}</span></div>
    <h3>{def.title}</h3>
    <p>{def.text}</p>
    <div class="choices">
      {#each def.choices as c, i}
        <button class="btn" onclick={() => act((s) => resolveEvent(s, index, i))}>{c.label}</button>
      {/each}
    </div>
  </article>
{/if}

<style>
  .event { border-color: rgba(116, 182, 255, 0.4); background: linear-gradient(160deg, rgba(116, 182, 255, 0.08), var(--panel) 70%); }
  .hd { display: flex; justify-content: space-between; font-size: 11px; }
  .kicker { color: var(--cold); letter-spacing: 0.14em; text-transform: uppercase; font-weight: 700; }
  h3 { margin: 4px 0; font-size: 16px; }
  p { margin: 0 0 12px; color: var(--muted); font-size: 14px; }
  .choices { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .choices .btn { font-weight: 600; padding: 8px 10px; height: auto; line-height: 1.2; }
  @media (max-width: 360px) { .choices { grid-template-columns: 1fr; } }
</style>
