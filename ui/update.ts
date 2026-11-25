/**
 * Update detection and "reload to latest". The deployed site publishes version.json with its build id;
 * we poll it and compare with the id baked into this bundle.
 */
import { ui, save } from './game.svelte';

export const BUILD_ID = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';
export const BUILD_TIME = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : '';

let lastCheck = 0;

export async function checkForUpdate(force = false): Promise<boolean> {
  if (!import.meta.env.PROD) return false;
  const now = Date.now();
  if (!force && now - lastCheck < 60_000) return ui.updateAvailable;
  lastCheck = now;
  try {
    const res = await fetch(`./version.json?t=${now}`, { cache: 'no-store' });
    if (!res.ok) return ui.updateAvailable;
    const v = (await res.json()) as { id?: string };
    ui.updateAvailable = !!v.id && v.id !== BUILD_ID;
  } catch {
    // offline: keep whatever we knew
  }
  return ui.updateAvailable;
}

export function startUpdateChecks(): void {
  checkForUpdate(true);
  setInterval(() => checkForUpdate(), 5 * 60_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
  window.addEventListener('online', () => checkForUpdate(true));
}

/** Save, drop cached files, refresh the service worker and load the newest version. */
export async function reloadToLatest(): Promise<void> {
  ui.reloading = true;
  save();
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.update().catch(() => {});
      reg.waiting?.postMessage('skipWaiting');
    }
  } catch {
    // fall through to a plain reload
  }
  const url = new URL(location.href);
  url.searchParams.set('v', Date.now().toString(36));
  location.replace(url.toString());
}
