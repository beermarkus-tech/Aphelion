<script lang="ts">
  import { S, R, act } from '../game.svelte';
  import { DATA, DOC, RSC, BLD, JOB, RCP, chooseDoctrine, research, researchAvailable, researchCost } from '../../sim';
  import { costLines, n } from '../util';
  import Cost from './Cost.svelte';

  /** What a research unlocks, derived from data so new content needs no UI change. */
  function unlocks(id: string): string[] {
    const out: string[] = [];
    for (const b of DATA.buildings) if (b.requires?.research?.includes(id)) out.push(b.name);
    for (const j of DATA.jobs) if (j.requires?.research?.includes(id)) out.push(`${j.name}s`);
    for (const r of DATA.recipes) if (r.requires?.research?.includes(id)) out.push(`${r.name} recipe`);
    return out;
  }

  const v = $derived.by(() => {
    const s = S();
    const r = R();
    const avail = DATA.research
      .filter((x) => researchAvailable(s, x.id))
      .map((x) => {
        const lines = costLines(s, r, researchCost(s, x.id));
        return { ...x, lines, ok: lines.every((l) => l.ok), unlocks: unlocks(x.id) };
      })
      .sort((a, b) => a.tier - b.tier || (a.lines[0]?.need ?? 0) - (b.lines[0]?.need ?? 0));
    const done = DATA.research.filter((x) => s.research[x.id]);
    const locked = DATA.research.filter((x) => !s.research[x.id] && !researchAvailable(s, x.id)).length;
    return { s, avail, done, locked, charter: !!s.research.charter, doctrine: s.doctrine };
  });
  let showDone = $state(false);
  void BLD; void JOB; void RCP; void RSC;
</script>

{#if v.charter && !v.doctrine}
  <section class="card doctrine">
    <h2>Colony Charter</h2>
    <p class="muted">Choose what this colony is for. The choice lasts until the next Rebuild and shapes everything after.</p>
    <div class="docs">
      {#each DATA.doctrines as d (d.id)}
        <button class="doc tap" onclick={() => act((s) => chooseDoctrine(s, d.id))}>
          <span class="dn">{d.name}</span>
          <span class="dd">{d.desc}</span>
          <span class="fx num">{d.effects.map((e) => `${e.add > 0 ? '+' : ''}${Math.round(e.add * 100)}% ${e.key.replace('res:', '').replace('job:', '')}`).join(' · ')}</span>
        </button>
      {/each}
    </div>
  </section>
{:else if v.doctrine}
  <div class="card current"><span class="muted">Doctrine</span> <strong>{DOC[v.doctrine].name}</strong></div>
{/if}

<h2 class="section-title">Available research</h2>
{#if v.avail.length === 0}
  <p class="muted">Nothing to research right now. {v.locked ? 'New topics open as you research their prerequisites.' : 'Every topic in this era is done.'}</p>
{/if}
<div class="grid-cards">
  {#each v.avail as x (x.id)}
    <article class="card rs" class:ready={x.ok}>
      <div class="hd"><span class="nm">{x.name}</span><span class="tier">T{x.tier}</span></div>
      <p class="desc">{x.desc}</p>
      {#if x.unlocks.length}<p class="unl">Unlocks: {x.unlocks.join(', ')}</p>{/if}
      <div class="buy">
        <Cost lines={x.lines} />
        <button class="btn primary" disabled={!x.ok} onclick={() => act((s) => research(s, x.id))}>Research</button>
      </div>
    </article>
  {/each}
</div>

{#if v.done.length}
  <button class="btn ghost small donebtn" onclick={() => (showDone = !showDone)} aria-expanded={showDone}>
    {showDone ? 'Hide' : 'Show'} completed ({v.done.length}){#if v.locked} · {v.locked} still hidden{/if}
  </button>
  {#if showDone}
    <ul class="done">
      {#each v.done as x (x.id)}<li><strong>{x.name}</strong> <span class="muted">— {x.desc}</span></li>{/each}
    </ul>
  {/if}
{/if}

<style>
  .doctrine { margin: 12px 0; border-color: rgba(255, 138, 61, 0.45); animation: glow 1.6s ease-out infinite alternate; }
  .doctrine h2 { margin: 0 0 4px; font-size: 17px; }
  .doctrine p { margin: 0 0 12px; font-size: 14px; }
  .docs { display: grid; gap: 8px; }
  @media (min-width: 700px) { .docs { grid-template-columns: repeat(3, 1fr); } }
  .doc {
    display: flex; flex-direction: column; gap: 6px; padding: 12px; border-radius: var(--radius-sm);
    border: 1px solid var(--line-2); background: var(--panel-2); color: var(--text); min-height: var(--tap);
  }
  .doc:hover, .doc:focus-visible { border-color: var(--accent); }
  .dn { font-weight: 700; color: var(--accent-2); }
  .dd { font-size: 13px; color: var(--muted); }
  .fx { font-size: 11px; color: var(--good); }
  .current { margin: 12px 0; display: flex; gap: 8px; align-items: baseline; }
  .rs { display: flex; flex-direction: column; gap: 6px; }
  .rs.ready { border-color: rgba(255, 138, 61, 0.35); }
  .hd { display: flex; justify-content: space-between; align-items: center; }
  .nm { font-weight: 650; }
  .tier { font-size: 11px; color: var(--faint); font-family: var(--mono); }
  .desc { margin: 0; font-size: 13px; color: var(--muted); }
  .unl { margin: 0; font-size: 12px; color: var(--accent-2); }
  .buy { display: flex; justify-content: space-between; align-items: flex-end; gap: 10px; margin-top: 2px; flex-wrap: wrap; }
  .buy :global(.cost) { flex: 1 1 160px; }
  .buy .btn { flex: none; }
  .donebtn { margin-top: 18px; }
  .done { margin: 8px 0 0; padding-left: 18px; font-size: 13px; display: grid; gap: 4px; }
</style>
