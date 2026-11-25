<script lang="ts">
  import { ui, S, act } from '../game.svelte';
  import { fmtTime } from '../../sim';
  import { n, name } from '../util';
  import { unlock } from '../audio';

  const intro = $derived(!S().settings.seenIntro);
  const away = $derived(ui.away);
  const gains = $derived(
    away ? Object.entries(away.gained).filter(([, v]) => Math.abs(v) >= 0.5).sort((a, b) => b[1] - a[1]).slice(0, 10) : [],
  );
</script>

{#if ui.catchup}
  <div class="overlay" role="status" aria-live="polite">
    <div class="panel">
      <h2>While you were away…</h2>
      <p class="muted">Simulating {fmtTime(ui.catchup.seconds)} of colony life.</p>
      <div class="bar"><i style="width:{ui.catchup.progress * 100}%"></i></div>
    </div>
  </div>
{:else if away}
  <div class="overlay">
    <div class="panel" role="dialog" aria-modal="true" aria-label="While you were away">
      <h2>While you were away</h2>
      <p class="muted">You were gone {fmtTime(away.seconds)}. The colony lived through {fmtTime(away.simulated)} of it.
        {#if away.reserve > 1}The other {fmtTime(away.reserve)} is stored as time you can spend later (clock button, top right).{/if}</p>
      {#if away.pop !== 0}<p>Survivors <strong class:good={away.pop > 0} class:bad={away.pop < 0}>{away.pop > 0 ? '+' : ''}{away.pop}</strong></p>{/if}
      {#if gains.length}
        <ul class="gains">
          {#each gains as [k, v] (k)}<li><span>{name(k)}</span><span class="num" class:good={v > 0} class:bad={v < 0}>{v > 0 ? '+' : ''}{n(S(), v, 1)}</span></li>{/each}
        </ul>
      {/if}
      {#if away.events}<p class="accent">{away.events} event{away.events === 1 ? '' : 's'} waiting for your decision on the Colony tab.</p>{/if}
      <button class="btn primary wide" onclick={() => (ui.away = null)}>Back to the colony</button>
    </div>
  </div>
{:else if intro}
  <div class="overlay">
    <div class="panel intro" role="dialog" aria-modal="true" aria-label="Aphelion">
      <div class="sun" aria-hidden="true"></div>
      <h1>APHELION</h1>
      <p>The escape pod is dead. Three of you made it out. The sun is small and very far away.</p>
      <p class="muted">Scavenge the wreck, give everyone a job, and keep them fed and warm. Winter comes every few minutes. Growth is yours to shape.</p>
      <button class="btn primary wide" onclick={() => { act((s) => (s.settings.seenIntro = true)); unlock(); }}>Begin</button>
    </div>
  </div>
{/if}

<div class="toasts" aria-live="polite">
  {#each ui.toasts as t (t.id)}
    <div class="toast {t.kind}">{t.text}</div>
  {/each}
</div>

{#if ui.saveError}<div class="saveerr" role="alert">{ui.saveError}</div>{/if}

<style>
  .overlay {
    position: fixed; inset: 0; z-index: 60; background: rgba(6, 7, 9, 0.82); backdrop-filter: blur(4px);
    display: grid; place-items: center; padding: calc(16px + var(--safe-top)) 16px calc(16px + var(--safe-bottom));
  }
  .panel { width: min(460px, 100%); background: var(--solid); border: 1px solid var(--line-2); border-radius: 16px; padding: 22px; max-height: 100%; overflow-y: auto; }
  h2 { margin: 0 0 8px; }
  p { font-size: 14px; margin: 0 0 12px; }
  .wide { width: 100%; margin-top: 8px; }
  .bar { height: 6px; }
  .gains { list-style: none; padding: 0; margin: 0 0 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; }
  .gains li { display: flex; justify-content: space-between; font-size: 14px; }
  .intro { text-align: center; }
  .intro h1 { letter-spacing: 0.4em; font-size: 22px; margin: 12px 0; padding-left: 0.4em; }
  .sun {
    width: 64px; height: 64px; margin: 4px auto 0; border-radius: 50%;
    background: radial-gradient(circle at 40% 40%, var(--accent-2), var(--accent) 40%, #6b2a08 72%, transparent 74%);
    box-shadow: 0 0 60px rgba(255, 138, 61, 0.35);
  }
  .toasts {
    position: fixed; z-index: 50; left: 50%; transform: translateX(-50%); width: min(520px, calc(100vw - 24px));
    bottom: calc(72px + var(--safe-bottom)); display: grid; gap: 6px; pointer-events: none;
  }
  @media (min-width: 768px) { .toasts { bottom: calc(20px + var(--safe-bottom)); } }
  .toast {
    background: var(--panel-3); border: 1px solid var(--line-2); border-left: 3px solid var(--accent); border-radius: 8px;
    padding: 10px 12px; font-size: 13px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4); animation: tin 0.25s ease;
  }
  .toast.event { border-left-color: var(--cold); }
  .toast.milestone { border-left-color: var(--good); }
  @keyframes tin { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  .saveerr { position: fixed; top: calc(60px + var(--safe-top)); left: 50%; transform: translateX(-50%); z-index: 70; background: var(--bad); color: #000; padding: 6px 12px; border-radius: 8px; font-size: 13px; }
</style>
