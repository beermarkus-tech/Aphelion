<script lang="ts">
  import { ui, S, R } from '../game.svelte';
  import { caps, housing } from '../../sim';
  import { n, netRate, rate } from '../util';
  import Icon from './Icon.svelte';

  let { compact = false }: { compact?: boolean } = $props();

  const v = $derived.by(() => {
    const s = S();
    const r = R();
    const foodNet = netRate(r, 'food');
    const cap = housing(s);
    return {
      food: { amt: s.res.food, cap: caps(s).food, net: foodNet, bad: r.starving || (foodNet < 0 && s.res.food < 30) },
      power: { supply: r.power.supply, demand: r.power.demand, bad: r.power.eff < 0.999 && r.power.demand > 0 },
      heat: { supply: r.heat.supply, demand: r.heat.demand, ratio: r.heat.ratio, bad: r.heat.ratio < 1 },
      pop: { n: s.pop, cap, growth: s.growth, full: s.pop >= cap },
      s,
    };
  });
</script>

<div class="needs" class:compact>
  <button class="need tap" class:alert={v.food.bad} onclick={() => (ui.sheet = { kind: 'resource', id: 'food' })} aria-label="Food details">
    <span class="lab"><Icon name="food" size={15} />Food</span>
    <span class="val num">{n(v.s, v.food.amt, 0)}</span>
    <span class="sub num" class:bad={v.food.net < 0} class:good={v.food.net > 0}>{rate(v.s, v.food.net)}</span>
    <span class="bar"><i style="width:{Math.min(100, (v.food.amt / v.food.cap) * 100)}%"></i></span>
  </button>

  <button class="need tap" class:alert={v.power.bad} onclick={() => (ui.sheet = { kind: 'resource', id: 'power' })} aria-label="Power details">
    <span class="lab"><Icon name="power" size={15} />Power</span>
    <span class="val num">{n(v.s, v.power.supply, 1)}</span>
    <span class="sub num" class:bad={v.power.bad}>{n(v.s, v.power.demand, 1)} used</span>
    <span class="bar" class:full={v.power.bad}><i style="width:{v.power.supply > 0 ? Math.min(100, (v.power.demand / v.power.supply) * 100) : 0}%"></i></span>
  </button>

  <button class="need tap" class:alert={v.heat.bad} onclick={() => (ui.sheet = { kind: 'resource', id: 'heat' })} aria-label="Heat details">
    <span class="lab"><Icon name="heat" size={15} />Heat</span>
    <span class="val num">{Math.round(v.heat.ratio * 100)}%</span>
    <span class="sub num" class:cold={v.heat.bad}>{n(v.s, v.heat.supply, 1)}/{n(v.s, v.heat.demand, 1)}</span>
    <span class="bar heat" class:full={v.heat.bad}><i style="width:{Math.min(100, v.heat.ratio * 100)}%"></i></span>
  </button>

  <button class="need tap" class:alert={false} onclick={() => (ui.tab = 'crew')} aria-label="Survivors">
    <span class="lab"><Icon name="pop" size={15} />Survivors</span>
    <span class="val num">{v.pop.n}<span class="faint">/{v.pop.cap}</span></span>
    <span class="sub">{v.pop.full ? 'full' : 'growing'}</span>
    <span class="bar"><i style="width:{v.pop.full ? 100 : v.pop.growth * 100}%"></i></span>
  </button>
</div>

<style>
  .needs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 6px; }
  .need {
    display: grid; grid-template-columns: 1fr auto; grid-template-areas: 'lab sub' 'val val' 'bar bar';
    gap: 2px 6px; padding: 10px; border-radius: var(--radius-sm); background: var(--panel-2); border: 1px solid var(--line);
    min-height: 74px; align-content: start; transition: border-color 0.2s;
  }
  .need.alert { border-color: var(--bad); background: rgba(255, 111, 111, 0.07); }
  .lab { grid-area: lab; white-space: nowrap; overflow: hidden; display: inline-flex; gap: 5px; align-items: center; color: var(--muted); font-size: 12px; }
  .val { grid-area: val; font-size: 17px; font-weight: 600; white-space: nowrap; }
  .sub { grid-area: sub; font-size: 11px; color: var(--muted); text-align: right; align-self: center; white-space: nowrap; }
  .need { grid-template-columns: 1fr; grid-template-areas: 'lab' 'val' 'sub' 'bar'; }
  .need .sub { text-align: left; }
  .bar { grid-area: bar; margin-top: 4px; }
  .bar.heat > i { background: var(--cold); }

  .needs.compact {
    grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0; margin: 0;
    padding: 0 var(--safe-right) 0 var(--safe-left);
  }
  .compact .need {
    border: 0; border-radius: 0; background: none; min-height: 56px; padding: 7px 6px 6px 10px;
    grid-template-columns: 1fr; grid-template-areas: 'lab' 'val' 'bar'; border-right: 1px solid var(--line);
  }
  .compact .need:last-child { border-right: 0; }
  .compact .need.alert { background: rgba(255, 111, 111, 0.1); }
  .compact .sub { display: none; }
  .compact .val { font-size: 15px; }
  .compact .lab { font-size: 11px; }
  @media (max-width: 360px) { .compact .lab :global(svg) { display: none; } }
</style>
