<script lang="ts">
  import { S, R, act } from '../game.svelte';
  import { DATA, scavenge, caps } from '../../sim';
  import { buildingVisible, hint, n } from '../util';
  import BuildingCard from './BuildingCard.svelte';
  import EventCard from './EventCard.svelte';
  import Icon from './Icon.svelte';
  import { hold } from '../util';

  const CATS = [
    { id: 'project', label: 'Projects' },
    { id: 'habitat', label: 'Habitat' },
    { id: 'production', label: 'Food & raw materials' },
    { id: 'power', label: 'Power & heat' },
    { id: 'industry', label: 'Industry' },
    { id: 'storage', label: 'Storage' },
    { id: 'science', label: 'Science' },
  ];

  const groups = $derived.by(() => {
    const s = S();
    return CATS.map((c) => ({ ...c, ids: DATA.buildings.filter((b) => b.category === c.id && buildingVisible(s, b)).map((b) => b.id) })).filter((g) => g.ids.length);
  });
  const tip = $derived(hint(S(), R()));
  const events = $derived(S().events.map((e, i) => i));
  const scrap = $derived(S().res.scrap);
  const scrapCap = $derived(caps(S()).scrap);
  const showScavenge = $derived((S().buildings.scrapyard ?? 0) < 8 || S().prestige.rebuilds === 0 && S().time < 1800);
  let taps = $state(0);
</script>

{#if tip}
  <div class="hint" role="status"><Icon name="spark" size={16} /><span>{tip}</span></div>
{/if}

{#each events as i (i)}
  <EventCard index={i} />
{/each}

{#if showScavenge}
  <div class="scav card">
    <div>
      <div class="sv-title">Scavenge the wreck</div>
      <div class="muted num sv-sub">Scrap {n(S(), scrap, 0)} / {n(S(), scrapCap, 0)}</div>
    </div>
    <button class="btn primary big" use:hold={() => { act(scavenge); taps++; }} aria-label="Scavenge for scrap">
      <Icon name="hand" size={20} /> Scavenge
      {#key taps}{#if taps > 0}<span class="plus" aria-hidden="true">+1</span>{/if}{/key}
    </button>
  </div>
{/if}

{#each groups as g (g.id)}
  <h2 class="section-title">{g.label}</h2>
  <div class="grid-cards">
    {#each g.ids as id (id)}
      <BuildingCard {id} />
    {/each}
  </div>
{/each}

<style>
  .hint {
    display: flex; gap: 10px; align-items: flex-start; margin: 12px 0; padding: 10px 12px; border-radius: var(--radius);
    background: var(--accent-soft); border: 1px solid rgba(255, 138, 61, 0.25); color: var(--accent-2); font-size: 14px;
  }
  .hint :global(svg) { flex: none; margin-top: 2px; }
  :global(.event) { margin: 12px 0; }
  .scav { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 12px 0; }
  .sv-title { font-weight: 650; }
  .sv-sub { font-size: 13px; }
  .big { min-height: 52px; padding: 0 22px; font-size: 16px; position: relative; }
  .plus {
    position: absolute; right: 10px; top: -4px; font-size: 13px; color: var(--accent-2); pointer-events: none;
    animation: rise 0.6s ease-out forwards;
  }
  @keyframes rise { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-22px); } }
</style>
