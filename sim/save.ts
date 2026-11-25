import { createState, SAVE_VERSION } from './state';
import { DATA } from './data';
import { checkGoals } from './goals';
import { invalidate } from './mods';
import type { GameState } from './types';

export function serialize(s: GameState): string {
  return JSON.stringify({ ...s, rev: 0 });
}

/** Parse and migrate a save. Unknown/missing fields fall back to a fresh state's defaults. */
export function deserialize(json: string): GameState {
  const raw = JSON.parse(json) as Partial<GameState>;
  if (!raw || typeof raw !== 'object' || typeof raw.version !== 'number') throw new Error('Not an Aphelion save');
  if (raw.version > SAVE_VERSION) throw new Error('Save is from a newer version');
  const base = createState();
  const s = deepMerge(base, raw) as GameState;
  s.version = SAVE_VERSION;
  if (!raw.goals) migrateGoals(s);
  invalidate(s);
  return s;
}

function deepMerge(base: unknown, over: unknown): unknown {
  if (Array.isArray(over)) return over;
  if (over && typeof over === 'object' && base && typeof base === 'object' && !Array.isArray(base)) {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
      out[k] = deepMerge((base as Record<string, unknown>)[k], v);
    }
    return out;
  }
  return over === undefined ? base : over;
}

/** Portable text form for export/import (base64 of the JSON, unicode safe). */
export function exportSave(s: GameState): string {
  const bytes = new TextEncoder().encode(serialize(s));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function importSave(text: string): GameState {
  const t = text.trim();
  if (t.startsWith('{')) return deserialize(t);
  const bin = atob(t);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return deserialize(new TextDecoder().decode(bytes));
}

/** Saves from before the goal chain: an established colony gets the goals it has clearly passed. */
function migrateGoals(s: GameState): void {
  const established = Object.keys(s.research).length > 0 || s.prestige.rebuilds > 0 || (s.buildings.terminal ?? 0) > 0;
  if (!established) return;
  const firstChapter = DATA.goals[0]?.chapter;
  for (const g of DATA.goals) if (g.chapter === firstChapter) s.goals[g.id] = true;
  invalidate(s);
  checkGoals(s);
}
