import type { Notation } from './types';

const WORDS = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion', 'septillion', 'octillion', 'nonillion', 'decillion'];

/** Format a number for display. Below 100k numbers are shown plainly in every notation. */
export function fmt(n: number, notation: Notation = 'scientific', digits = 2): string {
  if (!isFinite(n)) return n > 0 ? '∞' : '-∞';
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a < 1e5) {
    if (a === 0) return '0';
    if (a < 10) return sign + trim(a.toFixed(digits));
    if (a < 100) return sign + trim(a.toFixed(1));
    return sign + Math.floor(a).toLocaleString('en-US');
  }
  const exp = Math.floor(Math.log10(a));
  if (notation === 'scientific') {
    const mant = a / Math.pow(10, exp);
    return `${sign}${mant.toFixed(digits)}e${exp}`;
  }
  const e3 = Math.floor(exp / 3) * 3;
  const mant = a / Math.pow(10, e3);
  if (notation === 'words' && e3 / 3 < WORDS.length) {
    return `${sign}${mant.toFixed(digits)} ${WORDS[e3 / 3]}`;
  }
  return `${sign}${mant.toFixed(digits)}e${e3}`;
}

function trim(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

export function fmtRate(n: number, notation: Notation = 'scientific'): string {
  if (Math.abs(n) < 0.005) return '0/s';
  return `${n > 0 ? '+' : ''}${fmt(n, notation)}/s`;
}

export function fmtTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '—';
  if (sec < 60) return `${Math.ceil(sec)}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ${Math.floor(sec % 60)}s`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}
