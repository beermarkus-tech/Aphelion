<script lang="ts">
  import { S, act } from '../game.svelte';
  import { DATA, JOB, assign, housing, idle, jobUnlocked, m, season, setDefaultJob } from '../../sim';
  import { hold, n, name } from '../util';
  import Icon from './Icon.svelte';

  const v = $derived.by(() => {
    const s = S();
    const se = season(s);
    const jobs = DATA.jobs.filter((j) => jobUnlocked(s, j.id)).map((j) => {
      const k = m(s, `job:${j.id}`) * m(s, 'jobs') * m(s, 'global') * (j.seasonal === 'farm' ? se.farm : 1);
      const out = Object.entries(j.produces ?? {}).map(([r, x]) => `+${n(s, x * k * m(s, `res:${r}`))} ${name(r)}/s`);
      return { ...j, count: s.jobs[j.id] ?? 0, out };
    });
    return { s, jobs, idle: idle(s), pop: s.pop, cap: housing(s), rosters: !!s.research.rosters, def: s.defaultJob };
  });
</script>

<div class="summary card">
  <div><span class="big num">{v.idle}</span> <span class="muted">idle of {v.pop} survivors</span></div>
  <div class="muted small">Housing {v.pop}/{v.cap}</div>
</div>

<div class="jobs">
  {#each v.jobs as j (j.id)}
    <div class="job card">
      <div class="info">
        <div class="nm">{j.name}</div>
        <div class="desc">{j.desc}</div>
        {#if j.out.length}<div class="out num">{j.out.join(' · ')} each</div>{/if}
      </div>
      <div class="ctl">
        <button class="btn icon" disabled={j.count === 0} use:hold={() => act((s) => assign(s, j.id, -1)) !== 0} aria-label="Remove a {j.name}"><Icon name="minus" /></button>
        <span class="cnt num" aria-live="polite">{j.count}</span>
        <button class="btn icon" disabled={v.idle === 0} use:hold={() => act((s) => assign(s, j.id, 1)) !== 0} aria-label="Add a {j.name}"><Icon name="plus" /></button>
      </div>
    </div>
  {/each}
</div>

{#if v.rosters}
  <h2 class="section-title">Duty roster</h2>
  <div class="card roster">
    <label for="defjob">Newcomers report to</label>
    <select id="defjob" value={v.def ?? ''} onchange={(e) => act((s) => setDefaultJob(s, (e.currentTarget as HTMLSelectElement).value || null))}>
      <option value="">Stay idle</option>
      {#each v.jobs as j (j.id)}<option value={j.id}>{j.name}</option>{/each}
    </select>
  </div>
{/if}

<style>
  .summary { display: flex; justify-content: space-between; align-items: baseline; margin: 12px 0; }
  .big { font-size: 22px; font-weight: 700; }
  .small { font-size: 13px; }
  .jobs { display: grid; gap: 8px; }
  @media (min-width: 900px) { .jobs { grid-template-columns: 1fr 1fr; } }
  .job { display: flex; align-items: center; gap: 12px; justify-content: space-between; }
  .info { min-width: 0; }
  .nm { font-weight: 650; }
  .desc { font-size: 13px; color: var(--muted); }
  .out { font-size: 12px; color: var(--good); margin-top: 2px; }
  .ctl { display: flex; align-items: center; gap: 6px; flex: none; }
  .cnt { min-width: 30px; text-align: center; font-size: 18px; font-weight: 600; }
  .roster { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  select {
    min-height: var(--tap); background: var(--panel-3); border: 1px solid var(--line-2); border-radius: var(--radius-sm); padding: 0 12px;
  }
</style>
