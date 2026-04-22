import { GRID, ICON_OVERRIDES } from './constants.js';

export function snap(n) { return Math.round(n / GRID) * GRID; }

export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function hostname(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

export function faviconSrc(url) {
  try {
    const host = new URL(url).hostname;
    if (ICON_OVERRIDES[host]) return ICON_OVERRIDES[host];
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
  } catch {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url)}&sz=128`;
  }
}
