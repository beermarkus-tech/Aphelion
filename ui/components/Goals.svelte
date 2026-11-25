<script lang="ts">
  import { S } from '../game.svelte';
  import { DATA, currentGoal, goalParts, fmtTime, rebuildGain, canRebuild } from '../../sim';
  import { n } from '../util';
  import Icon from './Icon.svelte';

  const v = $derived.by(() => {
    const s = S();
    const g = currentGoal(s);
    const done = DATA.goals.filter((x) => s.goals[x.id]).length;
    if (!g) return { s, g: null, done, total: DATA.goals.length, parts: [], chapterDone: 0, chapterTotal: 0 };
    const chapter = DATA.goals.filter((x) => x.chapter === g.chapter);
    return {
      s, g, done, total: DATA.goals.length,
      parts: goalParts(s, g.check),
      chapterDone: chapter.filter((x) => s.goals[x.id]).length,
      chapterTotal: chapter.length,
    };
  });
  let open = $state(false);
</script>

<section class="goals card" aria-label="Current goal">
  <div class="aim">
    <span class="kicker">Aim</span>
    <span>Light the Ignition Chamber and take the colony to orbit.</span>
  </div>
  {#if v.g}
    <div class="ch">
      <span class="chapter">Chapter {v.g.chapter}</span>
      <span class="faint num">{v.chapterDone}/{v.chapterTotal}</span>
    </div>
    <div class="goal">
      <span class="target" aria-hidden="true"><Icon name="spark" size={16} /></span>
      <div class="gb">
        <div class="title">{v.g.title}</div>
        <div class="text">{v.g.text}</div>
        {#if v.g.id === 'rebuild'}
          <p class="rb">{canRebuild(v.s) ? `Rebuilding now would give +${rebuildGain(v.s)} Legacy. Waiting for 3 or more is worth it.` : 'Keep growing: Rebuild unlocks once your colony has earned at least 1 Legacy.'}</p>
        {:else if v.parts.length}
          <ul class="parts">
            {#each v.parts as p (p.label)}
              <li class:ok={p.have >= p.need}>
                <span class="pl">{p.label}</span>
                <span class="num pv">{p.label === 'Time' ? `${fmtTime(p.need - p.have)} left` : `${n(v.s, p.have, 0)}/${n(v.s, p.need, 0)}`}</span>
                <span class="bar"><i style="width:{Math.min(100, (p.have / p.need) * 100)}%"></i></span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  {:else}
    <div class="title">Every goal in Era I is complete.</div>
  {/if}
  <button class="tap more" onclick={() => (open = !open)} aria-expanded={open}>
    {open ? 'Hide' : 'All goals'} · <span class="num">{v.done}/{v.total}</span>
  </button>
  {#if open}
    <ol class="all">
      {#each DATA.goals as g (g.id)}
        <li class:done={v.s.goals[g.id]} class:now={v.g?.id === g.id}>
          <span class="mark">{v.s.goals[g.id] ? '✓' : v.g?.id === g.id ? '›' : '·'}</span>
          <span>{v.s.goals[g.id] || v.g?.id === g.id ? g.title : '???'}</span>
        </li>
      {/each}
    </ol>
  {/if}
</section>

<style>
  .goals { margin: 12px 0; display: flex; flex-direction: column; gap: 10px; border-color: rgba(255, 138, 61, 0.3); }
  .aim { display: flex; gap: 8px; font-size: 13px; color: var(--muted); align-items: baseline; }
  .kicker, .chapter { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 700; color: var(--accent-2); flex: none; }
  .ch { display: flex; justify-content: space-between; align-items: baseline; border-top: 1px solid var(--line); padding-top: 10px; }
  .ch .faint { font-size: 12px; }
  .goal { display: flex; gap: 10px; }
  .target {
    flex: none; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center;
    background: var(--accent-soft); color: var(--accent-2); border: 1px solid rgba(255, 138, 61, 0.4);
  }
  .gb { flex: 1; min-width: 0; }
  .title { font-weight: 700; font-size: 16px; }
  .text { font-size: 14px; color: var(--muted); margin-top: 2px; }
  .parts { list-style: none; padding: 0; margin: 8px 0 0; display: grid; gap: 6px; }
  .parts li { display: grid; grid-template-columns: 1fr auto; gap: 3px 10px; font-size: 13px; }
  .parts .bar { grid-column: 1 / -1; }
  .parts li.ok .pv { color: var(--good); }
  .parts li.ok .bar > i { background: var(--good); }
  .rb { margin: 6px 0 0; font-size: 13px; color: var(--accent-2); }
  .more { color: var(--muted); font-size: 12px; min-height: 32px; align-self: flex-start; }
  .all { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; font-size: 13px; }
  .all li { display: flex; gap: 8px; color: var(--faint); }
  .all li.done { color: var(--muted); }
  .all li.now { color: var(--text); font-weight: 600; }
  .mark { width: 12px; color: var(--good); }
</style>
