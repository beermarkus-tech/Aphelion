<script lang="ts">
  import { S, R, act } from '../game.svelte';
  import { DATA, craft, maxCrafts, m, recipeUnlocked, setActive, setAutocraft } from '../../sim';
  import { costLines, hold, n } from '../util';
  import Cost from './Cost.svelte';
  import Icon from './Icon.svelte';

  const v = $derived.by(() => {
    const s = S();
    const r = R();
    const recipes = DATA.recipes.filter((x) => recipeUnlocked(s, x.id)).map((x) => ({
      ...x,
      lines: costLines(s, r, x.in),
      max: maxCrafts(s, x.id),
      rule: s.autocraft[x.id] ?? { on: false, target: 10 },
      have: s.res[Object.keys(x.out)[0]],
    }));
    const machines = DATA.buildings.filter((b) => b.toggle && (s.buildings[b.id] ?? 0) > 0).map((b) => ({
      id: b.id, name: b.name, count: s.buildings[b.id], active: Math.min(s.buildings[b.id], s.active[b.id] ?? s.buildings[b.id]),
      eff: r.eff[b.id], power: b.power ?? 0,
    }));
    return { s, r, recipes, machines, craftBonus: m(s, 'craft'), fabs: s.buildings.fabricator ?? 0, autoRate: r.autocraft };
  });
</script>

{#if v.recipes.length}
  <h2 class="section-title">Crafting <span class="chip num">bonus ×{n(v.s, v.craftBonus)}</span></h2>
  <div class="grid-cards">
    {#each v.recipes as x (x.id)}
      <article class="card recipe">
        <div class="hd">
          <span class="nm">{x.name}</span>
          <span class="num have">{n(v.s, x.have, 1)} held</span>
        </div>
        <Cost lines={x.lines} />
        <div class="row">
          <button class="btn" disabled={x.max < 1} use:hold={() => act((s) => craft(s, x.id, 1)) > 0}>Craft 1</button>
          <button class="btn" disabled={x.max < 10} onclick={() => act((s) => craft(s, x.id, 10))}>×10</button>
          <button class="btn" disabled={x.max < 1} onclick={() => act((s) => craft(s, x.id, Math.max(1, Math.floor(x.max / 2))))}>Half</button>
        </div>
        {#if v.fabs > 0}
          <div class="auto">
            <label class="sw">
              <input type="checkbox" checked={x.rule.on} onchange={(e) => act((s) => setAutocraft(s, x.id, (e.currentTarget as HTMLInputElement).checked))} />
              <span>Auto-craft up to</span>
            </label>
            <div class="stepper">
              <button class="btn small icon" onclick={() => act((s) => setAutocraft(s, x.id, x.rule.on, Math.max(0, x.rule.target - 5)))} aria-label="Lower target"><Icon name="minus" size={16} /></button>
              <span class="num tgt">{x.rule.target}</span>
              <button class="btn small icon" onclick={() => act((s) => setAutocraft(s, x.id, x.rule.on, x.rule.target + 5))} aria-label="Raise target"><Icon name="plus" size={16} /></button>
            </div>
          </div>
        {/if}
      </article>
    {/each}
  </div>
  {#if v.fabs > 0}
    <p class="muted note">Fabricators share {n(v.s, v.autoRate)} crafts/s between active rules that are below target.</p>
  {:else}
    <p class="muted note">Research Fabrication to keep component stocks topped up automatically.</p>
  {/if}
{:else}
  <p class="muted pad">Recipes appear here once research unlocks them. Circuitry is the first.</p>
{/if}

{#if v.machines.length}
  <h2 class="section-title">Machines</h2>
  <p class="muted note">Switch machines off when power is short or inputs run low. Unpowered machines slow everything down together.</p>
  <div class="machines card">
    {#each v.machines as mc (mc.id)}
      <div class="mrow">
        <div class="mi">
          <div class="nm">{mc.name}</div>
          <div class="sub num">
            {mc.power < 0 ? `${n(v.s, -mc.power * mc.active, 1)} power` : ''}
            {#if mc.eff !== undefined && mc.active > 0}<span class:warn={mc.eff < 0.98}> · {Math.round(mc.eff * 100)}% efficient</span>{/if}
          </div>
        </div>
        <div class="ctl">
          <button class="btn small" onclick={() => act((s) => setActive(s, mc.id, 0))} disabled={mc.active === 0}>Off</button>
          <button class="btn small icon" use:hold={() => { act((s) => setActive(s, mc.id, (s.active[mc.id] ?? mc.count) - 1)); }} disabled={mc.active === 0} aria-label="One fewer"><Icon name="minus" size={16} /></button>
          <span class="num cnt">{mc.active}/{mc.count}</span>
          <button class="btn small icon" use:hold={() => { act((s) => setActive(s, mc.id, (s.active[mc.id] ?? mc.count) + 1)); }} disabled={mc.active >= mc.count} aria-label="One more"><Icon name="plus" size={16} /></button>
          <button class="btn small" onclick={() => act((s) => setActive(s, mc.id, mc.count))} disabled={mc.active >= mc.count}>All</button>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .recipe { display: flex; flex-direction: column; gap: 10px; }
  .hd { display: flex; justify-content: space-between; align-items: baseline; }
  .nm { font-weight: 650; }
  .have { font-size: 13px; color: var(--accent-2); }
  .row { display: flex; gap: 6px; }
  .row .btn { flex: 1; padding: 0 8px; }
  .auto { display: flex; align-items: center; justify-content: space-between; gap: 8px; border-top: 1px solid var(--line); padding-top: 10px; }
  .sw { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; min-height: var(--tap); cursor: pointer; }
  .sw input { width: 20px; height: 20px; accent-color: var(--accent); }
  .stepper { display: inline-flex; align-items: center; gap: 4px; }
  .stepper .btn { width: 36px; }
  .tgt { min-width: 36px; text-align: center; }
  .note { font-size: 13px; margin: 10px 2px; }
  .pad { margin: 16px 2px; }
  .machines { padding: 4px 12px; }
  .mrow { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
  .mrow:last-child { border-bottom: 0; }
  .sub { font-size: 12px; color: var(--muted); }
  .ctl { display: flex; align-items: center; gap: 4px; margin-left: auto; }
  .ctl .icon { width: 36px; }
  .cnt { min-width: 44px; text-align: center; font-size: 13px; }
</style>
