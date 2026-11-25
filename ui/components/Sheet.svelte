<script lang="ts">
  import { ui, S, R, act, hardReset, replaceState, save } from '../game.svelte';
  import { BLD, DATA, RES, ascend, ascensionGain, caps, exportSave, importSave, rebuild, rebuildGain, fmtTime } from '../../sim';
  import { effectText, multSources, n, name, netRate, rate } from '../util';
  import Resources from './Resources.svelte';
  import Needs from './Needs.svelte';
  import Log from './Log.svelte';
  import Icon from './Icon.svelte';
  import type { Notation } from '../../sim';
  import { sfx } from '../audio';

  const sheet = $derived(ui.sheet);
  function close() { ui.sheet = null; }

  const title = $derived.by(() => {
    const sh = ui.sheet;
    if (!sh) return '';
    switch (sh.kind) {
      case 'resource': return name(sh.id);
      case 'building': return BLD[sh.id].name;
      case 'stores': return 'Stores';
      case 'log': return 'Colony log';
      case 'settings': return 'Settings';
      case 'rebuild': return 'Rebuild the colony?';
      case 'ascend': return 'Ascend?';
    }
  });

  const flows = $derived.by(() => {
    const sh = ui.sheet;
    if (!sh || sh.kind !== 'resource') return null;
    const r = R();
    const s = S();
    const list = [...(r.flows[sh.id] ?? [])].sort((a, b) => b.rate - a.rate);
    const keys = [`res:${sh.id}`, 'global'];
    if (sh.id === 'power') keys.push('power');
    if (sh.id === 'heat') keys.push('heat', 'heatDemand');
    return {
      list, net: netRate(r, sh.id), mods: multSources(s, keys), desc: RES[sh.id]?.desc,
      amt: s.res[sh.id], cap: caps(s)[sh.id], s,
      power: sh.id === 'power' ? r.power : null, heat: sh.id === 'heat' ? r.heat : null,
    };
  });

  let exportText = $state('');
  let importText = $state('');
  let msg = $state('');
  let confirmReset = $state(false);

  function doExport() {
    exportText = exportSave(S());
    navigator.clipboard?.writeText(exportText).then(() => (msg = 'Copied to clipboard.'), () => (msg = 'Select and copy the text below.'));
  }
  function doImport() {
    try {
      replaceState(importSave(importText));
      msg = 'Save imported.';
      importText = '';
    } catch (e) {
      msg = `Import failed: ${(e as Error).message}`;
    }
  }
  function download() {
    const blob = new Blob([exportSave(S())], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `aphelion-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && ui.sheet) close(); }
  $effect(() => { if (!ui.sheet) { confirmReset = false; msg = ''; exportText = ''; } });
</script>

<svelte:window onkeydown={onKey} />

{#if sheet}
  <div class="scrim" onclick={close} aria-hidden="true"></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
    <div class="grab" aria-hidden="true"></div>
    <div class="shd">
      <h2>{title}</h2>
      <button class="btn icon ghost" onclick={close} aria-label="Close"><Icon name="close" /></button>
    </div>
    <div class="body">
      {#if sheet.kind === 'resource' && flows}
        {#if flows.desc}<p class="muted">{flows.desc}</p>{/if}
        {#if flows.power}
          <p class="num">Supply {n(flows.s, flows.power.supply)} · demand {n(flows.s, flows.power.demand)} · machines at <strong class:bad={flows.power.eff < 1}>{Math.round(flows.power.eff * 100)}%</strong></p>
        {:else if flows.heat}
          <p class="num">Supply {n(flows.s, flows.heat.supply)} · demand {n(flows.s, flows.heat.demand)} · <strong class:cold={flows.heat.ratio < 1}>{Math.round(flows.heat.ratio * 100)}% warm</strong></p>
          <p class="muted small">Below 100% jobs slow down and nobody new arrives. Below 50% survivors start to freeze. Demand is highest in Deep Winter.</p>
        {:else}
          <p class="num">{n(flows.s, flows.amt)}{#if flows.cap !== Infinity} / {n(flows.s, flows.cap)}{/if} · <strong class:good={flows.net > 0} class:bad={flows.net < 0}>{rate(flows.s, flows.net)}</strong></p>
        {/if}
        <h3>Sources and drains</h3>
        <ul class="flows">
          {#each flows.list as f, i (i)}
            <li><span>{f.label}</span><span class="num" class:good={f.rate > 0} class:bad={f.rate < 0}>{rate(flows.s, f.rate)}</span></li>
          {:else}
            <li class="muted">Nothing produces or uses this yet.</li>
          {/each}
        </ul>
        {#if flows.mods.length}
          <h3>Multipliers</h3>
          <ul class="flows">
            {#each flows.mods as md, i (i)}
              <li><span>{md.label} <span class="faint">({md.key})</span></span><span class="num" class:good={md.add > 0} class:bad={md.add < 0}>{md.add > 0 ? '+' : ''}{Math.round(md.add * 100)}%</span></li>
            {/each}
          </ul>
        {/if}
      {:else if sheet.kind === 'building'}
        {@const b = BLD[sheet.id]}
        <p>{b.desc}</p>
        <ul class="flows">
          {#each effectText(S(), b) as e}<li><span>{e}</span></li>{/each}
        </ul>
        <p class="muted small">Owned: {S().buildings[b.id] ?? 0}{b.max ? ` of ${b.max}` : ''}. Each one costs {Math.round((b.costMult - 1) * 100)}% more than the last.</p>
      {:else if sheet.kind === 'stores'}
        <Needs />
        <Resources />
      {:else if sheet.kind === 'log'}
        <Log limit={120} />
      {:else if sheet.kind === 'settings'}
        <h3>Sound</h3>
        <label class="slider"><span>Music</span>
          <input type="range" min="0" max="1" step="0.05" value={S().settings.music}
            oninput={(e) => act((s) => (s.settings.music = Number((e.currentTarget as HTMLInputElement).value)))} />
          <span class="num pct">{Math.round(S().settings.music * 100)}%</span></label>
        <label class="slider"><span>Effects</span>
          <input type="range" min="0" max="1" step="0.05" value={S().settings.sfx}
            oninput={(e) => act((s) => (s.settings.sfx = Number((e.currentTarget as HTMLInputElement).value)))}
            onchange={() => sfx('build')} />
          <span class="num pct">{Math.round(S().settings.sfx * 100)}%</span></label>
        <p class="muted small">On iPhone and iPad, the ring/silent switch also mutes the game.</p>
        <h3>Graphics</h3>
        <label class="sw"><input type="checkbox" checked={S().settings.motion}
          onchange={(e) => act((s) => (s.settings.motion = (e.currentTarget as HTMLInputElement).checked))} />
          <span>Animated starfield and colony scene</span></label>
        <h3>Number notation</h3>
        <div class="seg" role="radiogroup" aria-label="Number notation">
          {#each [['scientific', '1.23e6'], ['engineering', '12.3e6'], ['words', '1.2 million']] as [id, ex] (id)}
            <button class="btn small" class:sel={S().settings.notation === id} role="radio" aria-checked={S().settings.notation === id}
              onclick={() => act((s) => (s.settings.notation = id as Notation))}>{id}<span class="faint"> {ex}</span></button>
          {/each}
        </div>
        <h3>Save</h3>
        <p class="muted small">The game saves to this device every 15 seconds and whenever you leave. Export to move your colony to another device.</p>
        <div class="row">
          <button class="btn small" onclick={() => { save(); msg = 'Saved.'; }}>Save now</button>
          <button class="btn small" onclick={doExport}>Export text</button>
          <button class="btn small" onclick={download}>Download file</button>
        </div>
        {#if exportText}<textarea readonly rows="3" onfocus={(e) => (e.currentTarget as HTMLTextAreaElement).select()}>{exportText}</textarea>{/if}
        <textarea rows="3" placeholder="Paste a save here to import" bind:value={importText}></textarea>
        <button class="btn small" disabled={!importText.trim()} onclick={doImport}>Import</button>
        {#if msg}<p class="small accent" role="status">{msg}</p>{/if}
        <h3>Danger zone</h3>
        {#if !confirmReset}
          <button class="btn small" onclick={() => (confirmReset = true)}>Erase everything…</button>
        {:else}
          <p class="small bad">This deletes your colony, Legacy and Ascensions from this device. Export first if unsure.</p>
          <div class="row">
            <button class="btn small" onclick={() => (confirmReset = false)}>Keep my colony</button>
            <button class="btn small danger" onclick={() => { hardReset(); close(); }}>Erase</button>
          </div>
        {/if}
        <p class="faint small about">Aphelion · Era I preview. Offline progress: full for 12h, then declining up to 7 days; the rest becomes stored time.</p>
      {:else if sheet.kind === 'rebuild'}
        <p>Everything in this run resets: survivors, buildings, research{(S().prestige.perks.recall ?? 0) > 0 ? ' (except what Recall keeps)' : ''}, stores and doctrine.</p>
        <p>You keep Legacy, perks, Launch Credits, stored time and the log.</p>
        <p class="big">You gain <strong class="accent num">+{rebuildGain(S())} Legacy</strong>.</p>
        <div class="row">
          <button class="btn" onclick={close}>Not yet</button>
          <button class="btn primary" onclick={() => { act(rebuild, 'rebuild'); close(); ui.tab = 'legacy'; }}>Rebuild</button>
        </div>
      {:else if sheet.kind === 'ascend'}
        <p>Era I ends. Legacy and perks reset to zero. You keep a permanent echo of the Legacy you earned.</p>
        <p class="big">You gain <strong class="accent num">{ascensionGain(S())} Launch Credit{ascensionGain(S()) === 1 ? '' : 's'}</strong>.</p>
        <p class="muted small">Era II (Orbit) arrives in a future update. Until then, Launch Credits make every new colony grow faster.</p>
        <div class="row">
          <button class="btn" onclick={close}>Not yet</button>
          <button class="btn primary" onclick={() => { act(ascend, 'ascend'); close(); ui.tab = 'colony'; }}>Ascend</button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .scrim { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.55); z-index: 40; animation: fade 0.15s ease; }
  .sheet {
    position: fixed; z-index: 41; left: 0; right: 0; bottom: 0; max-height: 88dvh; display: flex; flex-direction: column;
    background: var(--solid); border-top: 1px solid var(--line-2); border-radius: 16px 16px 0 0;
    padding: 0 calc(var(--gutter) + var(--safe-right)) calc(16px + var(--safe-bottom)) calc(var(--gutter) + var(--safe-left));
    animation: up 0.2s ease;
  }
  .grab { width: 40px; height: 4px; border-radius: 4px; background: var(--line-2); margin: 8px auto 0; }
  .shd { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; }
  .shd h2 { margin: 0; font-size: 18px; }
  .body { overflow-y: auto; overscroll-behavior: contain; padding-bottom: 8px; }
  @media (min-width: 768px) {
    .sheet {
      left: 50%; right: auto; bottom: auto; top: 50%; transform: translate(-50%, -50%);
      width: min(560px, calc(100vw - 48px)); max-height: min(80dvh, 760px); border: 1px solid var(--line-2); border-radius: 16px;
      padding: 4px 20px 20px; animation: fade 0.15s ease;
    }
    .grab { display: none; }
  }
  @keyframes up { from { transform: translateY(30px); opacity: 0; } to { transform: none; opacity: 1; } }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
  h3 { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin: 18px 0 8px; }
  p { margin: 0 0 10px; font-size: 14px; }
  .small { font-size: 13px; }
  .big { font-size: 17px; }
  .flows { list-style: none; margin: 0; padding: 0; }
  .flows li { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 14px; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
  .row .btn { flex: 1; }
  .seg { display: flex; gap: 6px; flex-wrap: wrap; }
  .seg .btn { text-transform: capitalize; }
  .seg .sel { border-color: var(--accent); color: var(--accent-2); }
  textarea {
    width: 100%; margin: 8px 0; background: var(--bg); border: 1px solid var(--line-2); border-radius: var(--radius-sm);
    padding: 8px; font-family: var(--mono); font-size: 12px; color: var(--text); resize: vertical;
  }
  .slider { display: grid; grid-template-columns: 70px 1fr 44px; align-items: center; gap: 10px; min-height: var(--tap); font-size: 14px; }
  .slider input { width: 100%; accent-color: var(--accent); height: 28px; }
  .pct { text-align: right; font-size: 13px; color: var(--muted); }
  .sw { display: flex; align-items: center; gap: 10px; min-height: var(--tap); font-size: 14px; cursor: pointer; }
  .sw input { width: 20px; height: 20px; accent-color: var(--accent); }
  .danger { border-color: var(--bad); color: var(--bad); }
  .about { margin-top: 20px; }
</style>
