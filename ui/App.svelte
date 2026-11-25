<script lang="ts">
  import { ui, S, type Tab } from './game.svelte';
  import { canRebuild } from '../sim';
  import Header from './components/Header.svelte';
  import Needs from './components/Needs.svelte';
  import Resources from './components/Resources.svelte';
  import Colony from './components/Colony.svelte';
  import Crew from './components/Crew.svelte';
  import Lab from './components/Lab.svelte';
  import Works from './components/Works.svelte';
  import Legacy from './components/Legacy.svelte';
  import Log from './components/Log.svelte';
  import Sheet from './components/Sheet.svelte';
  import Overlays from './components/Overlays.svelte';
  import Icon from './components/Icon.svelte';
  import Starfield from './components/Starfield.svelte';

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'colony', label: 'Colony', icon: 'colony' },
    { id: 'crew', label: 'Crew', icon: 'crew' },
    { id: 'lab', label: 'Lab', icon: 'lab' },
    { id: 'works', label: 'Works', icon: 'works' },
    { id: 'legacy', label: 'Legacy', icon: 'legacy' },
  ];

  function visible(id: Tab): boolean {
    const s = S();
    switch (id) {
      case 'colony': case 'crew': return true;
      case 'lab': return (s.buildings.terminal ?? 0) > 0 || Object.keys(s.research).length > 0;
      case 'works': return !!s.research.smelting || Object.keys(s.research).length > 4;
      case 'legacy': return s.prestige.rebuilds > 0 || s.prestige.ascensions > 0 || s.peakPop >= 6 || canRebuild(s);
    }
  }

  const shown = $derived(tabs.filter((t) => visible(t.id)));
  const badge = $derived.by(() => {
    const s = S();
    return { colony: s.events.length, legacy: canRebuild(s) && s.prestige.rebuilds === 0 ? 1 : 0 } as Record<string, number>;
  });

  let main: HTMLElement;
  function go(id: Tab) {
    if (ui.tab === id) main?.scrollTo({ top: 0, behavior: 'smooth' });
    ui.tab = id;
  }
</script>

<Starfield />
<div class="app">
  <Header />

  <aside class="side" aria-label="Colony status">
    <Needs />
    <Resources />
  </aside>

  <div class="strip"><Needs compact /></div>

  <div class="center">
    <nav class="toptabs" aria-label="Sections">
      {#each shown as t (t.id)}
        <button class="toptab" class:on={ui.tab === t.id} onclick={() => go(t.id)} aria-current={ui.tab === t.id ? 'page' : undefined}>
          <Icon name={t.icon} size={18} />{t.label}
          {#if badge[t.id]}<span class="dot" aria-label="needs attention"></span>{/if}
        </button>
      {/each}
    </nav>
    <main bind:this={main}>
      {#if ui.tab === 'colony'}<Colony />
      {:else if ui.tab === 'crew'}<Crew />
      {:else if ui.tab === 'lab'}<Lab />
      {:else if ui.tab === 'works'}<Works />
      {:else if ui.tab === 'legacy'}<Legacy />
      {/if}
    </main>
  </div>

  <aside class="logcol" aria-label="Colony log"><Log /></aside>

  <nav class="bottom" aria-label="Sections">
    {#each shown as t (t.id)}
      <button class="btab" class:on={ui.tab === t.id} onclick={() => go(t.id)} aria-current={ui.tab === t.id ? 'page' : undefined}>
        <span class="ico"><Icon name={t.icon} size={22} />{#if badge[t.id]}<span class="dot"></span>{/if}</span>
        <span>{t.label}</span>
      </button>
    {/each}
  </nav>
</div>

<Sheet />
<Overlays />

<style>
  .app {
    position: relative; z-index: 1;
    height: 100dvh;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto minmax(0, 1fr) auto;
    grid-template-areas: 'header' 'strip' 'center' 'bottom';
  }
  .app > :global(header) { grid-area: header; }
  .strip { grid-area: strip; border-bottom: 1px solid var(--line); background: var(--panel); }
  .center { grid-area: center; display: flex; flex-direction: column; min-height: 0; }
  main {
    flex: 1; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
    padding: 4px calc(var(--gutter) + var(--safe-right)) 24px calc(var(--gutter) + var(--safe-left));
  }
  .side, .logcol, .toptabs { display: none; }

  .bottom {
    grid-area: bottom;
    display: flex;
    background: var(--panel);
    border-top: 1px solid var(--line);
    padding: 0 var(--safe-right) var(--safe-bottom) var(--safe-left);
  }
  .btab {
    flex: 1; background: none; border: 0; min-height: 58px; padding: 6px 0 4px;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    color: var(--muted); font-size: 11px; font-weight: 600; cursor: pointer; letter-spacing: 0.02em;
  }
  .btab.on { color: var(--accent); }
  .ico { position: relative; display: inline-flex; }
  .dot { position: absolute; top: -2px; right: -6px; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }

  /* ---------- tablet: persistent status sidebar, tabs on top ---------- */
  @media (min-width: 768px) {
    .app {
      grid-template-columns: 290px minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr);
      grid-template-areas: 'header header' 'side center';
    }
    .strip, .bottom { display: none; }
    .side {
      grid-area: side; display: block; overflow-y: auto; overscroll-behavior: contain;
      border-right: 1px solid var(--line); background: var(--panel);
      padding: 12px 14px calc(16px + var(--safe-bottom)) calc(14px + var(--safe-left));
    }
    .toptabs {
      display: flex; gap: 0; padding: 10px 12px 0; border-bottom: 1px solid var(--line);
      overflow-x: auto; scrollbar-width: none;
    }
    .toptab {
      position: relative; display: inline-flex; align-items: center; gap: 8px;
      min-height: 46px; padding: 0 12px; background: none; white-space: nowrap; flex: none; border: 0; border-bottom: 2px solid transparent;
      color: var(--muted); font-weight: 600; cursor: pointer;
    }
    .toptab.on { color: var(--text); border-bottom-color: var(--accent); }
    .toptab .dot { position: static; margin-left: 2px; }
    main { padding: 4px 24px calc(28px + var(--safe-bottom)); }
  }

  /* ---------- wide tablet landscape / desktop: log column ---------- */
  @media (min-width: 1180px) {
    .app {
      grid-template-columns: 300px minmax(0, 1fr) 320px;
      grid-template-areas: 'header header header' 'side center log';
    }
    .logcol {
      grid-area: log; display: block; overflow-y: auto; border-left: 1px solid var(--line);
      background: var(--panel); padding: 12px 16px calc(16px + var(--safe-bottom)) 16px;
    }
  }
</style>
