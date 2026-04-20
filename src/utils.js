import { GRID } from './constants.js';

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
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
  } catch {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url)}&sz=128`;
  }
}
