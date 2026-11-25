<script lang="ts">
  import { ui, S, act } from '../game.svelte';
  import { fmtTime } from '../../sim';
  import { seasonInfo } from '../util';
  import Icon from './Icon.svelte';
  import { reloadToLatest } from '../update';

  const info = $derived(seasonInfo(S()));
  const chrono = $derived(S().chrono);
  const overdrive = $derived(S().overdrive);
  const seasonClass = $derived(info.season.id);
</script>

<header>
  <div class="brand">
    <div class="mark" aria-hidden="true"></div>
    <div>
      <div class="title">APHELION</div>
      <div class="era">Era I · Cinder</div>
    </div>
  </div>

  <div class="season {seasonClass}" title="Seasons change production and heat demand">
    <span class="ring" style="--p:{info.progress}"></span>
    <span class="sname">{info.season.name}</span>
    <span class="yr num">Y{info.year} · {fmtTime(info.left)}</span>
  </div>

  <div class="actions">
    {#if chrono >= 1}
      <button class="btn small chrono" class:on={overdrive} onclick={() => act((s) => (s.overdrive = !s.overdrive))}
        aria-pressed={overdrive} title="Spend stored time to run the colony at 3× speed">
        <Icon name="clock" size={16} /> <span class="num">{fmtTime(chrono)}</span>{overdrive ? ' 3×' : ''}
      </button>
    {/if}
    <button class="btn icon ghost reload" class:spin={ui.reloading} onclick={reloadToLatest}
      aria-label={ui.updateAvailable ? 'Update available: reload to the latest version' : 'Reload the app'}
      title={ui.updateAvailable ? 'Update available — tap to load it' : 'Reload the latest version'}>
      <Icon name="reload" />
      {#if ui.updateAvailable}<span class="upd" aria-hidden="true"></span>{/if}
    </button>
    <button class="btn icon ghost phone-only" onclick={() => (ui.sheet = { kind: 'stores' })} aria-label="Stores"><Icon name="stores" /></button>
    <button class="btn icon ghost no-wide" onclick={() => (ui.sheet = { kind: 'log' })} aria-label="Colony log"><Icon name="log" /></button>
    <button class="btn icon ghost" onclick={() => (ui.sheet = { kind: 'settings' })} aria-label="Settings"><Icon name="settings" /></button>
  </div>
</header>

<style>
  header {
    display: flex; align-items: center; gap: 10px;
    padding: calc(6px + var(--safe-top)) calc(8px + var(--safe-right)) 6px calc(var(--gutter) + var(--safe-left));
    background: var(--panel); border-bottom: 1px solid var(--line);
    min-height: 56px;
  }
  .brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .mark {
    width: 26px; height: 26px; border-radius: 50%; flex: none;
    background: radial-gradient(circle at 35% 35%, var(--accent-2), var(--accent) 45%, #6b2a08 75%, transparent 76%);
    box-shadow: 0 0 18px rgba(255, 138, 61, 0.35);
  }
  .title { font-weight: 800; letter-spacing: 0.28em; font-size: 14px; }
  .era { font-size: 11px; color: var(--muted); letter-spacing: 0.06em; }
  .season {
    margin-left: auto; display: flex; align-items: center; gap: 8px; font-size: 13px; white-space: nowrap;
  }
  .ring {
    width: 18px; height: 18px; border-radius: 50%; flex: none;
    background: conic-gradient(var(--sc, var(--accent)) calc(var(--p) * 360deg), var(--line-2) 0);
    mask: radial-gradient(circle, transparent 5px, #000 5.5px);
    -webkit-mask: radial-gradient(circle, transparent 5px, #000 5.5px);
  }
  .season.winter { --sc: var(--cold); }
  .season.bloom { --sc: var(--warn); }
  .season.dust { --sc: #c9a27a; }
  .sname { font-weight: 600; }
  .yr { color: var(--muted); font-size: 12px; }
  .actions { display: flex; align-items: center; gap: 2px; }
  .reload { position: relative; }
  .upd {
    position: absolute; top: 4px; right: 4px; width: 9px; height: 9px; border-radius: 50%;
    background: var(--good); box-shadow: 0 0 0 2px var(--panel), 0 0 8px var(--good);
    animation: updpulse 1.8s ease-in-out infinite;
  }
  @keyframes updpulse { 50% { transform: scale(1.25); } }
  .spin :global(svg) { animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .chrono { color: var(--cold); border-color: rgba(116, 182, 255, 0.35); }
  .chrono.on { background: rgba(116, 182, 255, 0.15); }
  .brand > div { min-width: 0; }
  @media (max-width: 520px) {
    .era, .yr { display: none; }
    .title { font-size: 13px; letter-spacing: 0.2em; }
  }
  @media (max-width: 440px) {
    .brand > div { display: none; }
    .season { margin-left: 0; flex: 1; min-width: 0; }
    .sname { overflow: hidden; text-overflow: ellipsis; }
  }
  @media (min-width: 768px) { .phone-only { display: none; } header { padding-left: calc(20px + var(--safe-left)); } }
  @media (min-width: 1180px) { .no-wide { display: none; } }
</style>
