<script lang="ts">
  import { S } from '../game.svelte';
  import { fmtTime } from '../../sim';
  let { limit = 60 }: { limit?: number } = $props();
  const entries = $derived(S().log.slice(0, limit));
  const now = $derived(S().totalTime);
</script>

<h2 class="section-title first">Colony log</h2>
<ol class="log">
  {#each entries as e (e)}
    <li class={e.kind}>
      <span class="t num">{fmtTime(Math.max(0, now - e.t))} ago</span>
      <span class="x">{e.text}</span>
    </li>
  {:else}
    <li class="muted">Nothing yet.</li>
  {/each}
</ol>

<style>
  .first { margin-top: 4px; }
  .log { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  li { display: grid; gap: 2px; font-size: 13px; line-height: 1.45; padding-left: 10px; border-left: 2px solid var(--line-2); }
  li.story { border-left-color: var(--accent); }
  li.story .x { color: var(--text); font-style: italic; }
  li.event { border-left-color: var(--cold); }
  li.milestone { border-left-color: var(--good); }
  li.info .x { color: var(--muted); }
  .t { font-size: 10px; color: var(--faint); }
</style>
