import { state, config, layoutState } from './state.js';
import { dbSaveLayout } from './db.js';
import { updateClock } from './clock.js';
import { STORAGE_KEYS } from './constants.js';

const btnEdit   = document.getElementById('btn-edit');
const btnLayout = document.getElementById('btn-layout');

export function setEditMode(on) {
  if (on && state.layoutMode) {
    state.layoutMode = false;
    document.body.classList.remove('layout-mode');
    btnLayout.classList.remove('active');
  }
  state.editMode = on;
  document.body.classList.toggle('edit-mode', on);
  btnEdit.classList.toggle('active', on);
  btnEdit.textContent = on ? 'lock' : 'edit';
}

export function setLayoutMode(on) {
  if (on && state.editMode) {
    state.editMode = false;
    document.body.classList.remove('edit-mode');
    btnEdit.classList.remove('active');
    btnEdit.textContent = 'edit';
  }
  state.layoutMode = on;
  document.body.classList.toggle('layout-mode', on);
  btnLayout.classList.toggle('active', on);
}

export function syncEmButtons() {
  document.querySelectorAll('.em-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.model === config.editModeModel);
  });
}

export function setEditModeModel(model) {
  if (model === config.editModeModel) return;
  config.editModeModel = model;
  localStorage.setItem(STORAGE_KEYS.EDIT_MODE_MODEL, model);
  btnEdit.style.display = model === 'b' ? 'none' : '';
  document.body.classList.toggle('edit-mode-b', model === 'b');
  if (model !== 'b') setEditMode(false);
  syncEmButtons();
}

export function initEditMode() {
  btnEdit.style.display = config.editModeModel === 'b' ? 'none' : '';
  document.body.classList.toggle('edit-mode-b', config.editModeModel === 'b');
  syncEmButtons();
  btnEdit.addEventListener('click',   () => setEditMode(!state.editMode));
  btnLayout.addEventListener('click', () => setLayoutMode(!state.layoutMode));
}

// ── Toolbar visibility toggles ────────────────────────────────────────────

const TOOLBAR_TOGGLES = [
  { id: 'tog-gmail',  key: STORAGE_KEYS.TOOLBAR_GMAIL,   elId: 'gc-gmail'  },
  { id: 'tog-images', key: STORAGE_KEYS.TOOLBAR_IMAGES,  elId: 'gc-images' },
  { id: 'tog-apps',   key: STORAGE_KEYS.TOOLBAR_APPS,    elId: 'btn-apps'  },
  { id: 'tog-avatar', key: STORAGE_KEYS.TOOLBAR_AVATAR,  elId: 'avatar'    },
];

function applyToolbarToggles() {
  TOOLBAR_TOGGLES.forEach(({ key, elId }) => {
    const visible = localStorage.getItem(key) !== '0';
    const el = document.getElementById(elId);
    if (el) el.style.display = visible ? '' : 'none';
  });
}

export function initToolbarToggles() {
  applyToolbarToggles();
  TOOLBAR_TOGGLES.forEach(({ id, key }) => {
    const checkbox = document.getElementById(id);
    if (!checkbox) return;
    checkbox.checked = localStorage.getItem(key) !== '0';
    checkbox.addEventListener('change', () => {
      localStorage.setItem(key, checkbox.checked ? '1' : '0');
      applyToolbarToggles();
    });
  });
}

// ── Chrome widget visibility toggles ─────────────────────────────────────

const CHROME_TOGGLES = [
  { id: 'tog-clock',     key: STORAGE_KEYS.CHROME_CLOCK,      elId: 'chrome-clock'     },
  { id: 'tog-search',    key: STORAGE_KEYS.CHROME_SEARCH,     elId: 'chrome-search'    },
  { id: 'tog-shortcuts', key: STORAGE_KEYS.CHROME_SHORTCUTS,  elId: 'chrome-shortcuts' },
];

function applyChromeToggles() {
  CHROME_TOGGLES.forEach(({ key, elId }) => {
    const el = document.getElementById(elId);
    if (el) el.style.display = localStorage.getItem(key) === '0' ? 'none' : '';
  });
}

export function initChromeToggles() {
  applyChromeToggles();
  CHROME_TOGGLES.forEach(({ id, key }) => {
    const checkbox = document.getElementById(id);
    if (!checkbox) return;
    checkbox.checked = localStorage.getItem(key) !== '0';
    checkbox.addEventListener('change', () => {
      localStorage.setItem(key, checkbox.checked ? '1' : '0');
      applyChromeToggles();
    });
  });
}

// ── Theme ─────────────────────────────────────────────────────────────────

export function initTheme() {
  function applyTheme(dark) {
    document.body.classList.toggle('dark', dark);
    const tog = document.getElementById('tog-dark');
    if (tog) tog.checked = dark;
    document.getElementById('tab-preload')?.remove();
  }

  const stored = localStorage.getItem(STORAGE_KEYS.THEME);
  applyTheme(stored !== null ? stored === 'dark' : true);

  document.addEventListener('change', e => {
    if (e.target.id !== 'tog-dark') return;
    const dark = e.target.checked;
    applyTheme(dark);
    localStorage.setItem(STORAGE_KEYS.THEME, dark ? 'dark' : 'light');
  });
}

// ── Grid ──────────────────────────────────────────────────────────────────

export function initGrid() {
  function applyGrid(on) {
    document.body.classList.toggle('no-grid', !on);
    const tog = document.getElementById('tog-grid');
    if (tog) tog.checked = on;
  }

  applyGrid(localStorage.getItem(STORAGE_KEYS.GRID) !== '0');

  document.addEventListener('change', e => {
    if (e.target.id !== 'tog-grid') return;
    localStorage.setItem(STORAGE_KEYS.GRID, e.target.checked ? '1' : '0');
    applyGrid(e.target.checked);
  });
}

// ── Clock format ──────────────────────────────────────────────────────────

export function initClockFormat() {
  const tog = document.getElementById('tog-clock24');
  if (!tog) return;
  tog.checked = localStorage.getItem(STORAGE_KEYS.CLOCK_FORMAT) === '24';
  tog.addEventListener('change', () => {
    const clockBlock = document.getElementById('chrome-clock');
    const oldCenter = clockBlock ? clockBlock.offsetLeft + clockBlock.offsetWidth / 2 : null;
    localStorage.setItem(STORAGE_KEYS.CLOCK_FORMAT, tog.checked ? '24' : '12');
    updateClock();
    if (oldCenter !== null && clockBlock) {
      requestAnimationFrame(() => {
        const newLeft = Math.round(oldCenter - clockBlock.offsetWidth / 2);
        clockBlock.style.left = newLeft + 'px';
        if (layoutState.clock) {
          layoutState.clock.x = newLeft;
          dbSaveLayout(layoutState);
        }
      });
    }
  });
}

export function initWeatherUnit() {
  const tog = document.getElementById('tog-weather-f');
  if (!tog) return;
  tog.checked = localStorage.getItem(STORAGE_KEYS.WEATHER_UNIT) === 'F';
  tog.addEventListener('change', () => {
    const unit = tog.checked ? 'F' : 'C';
    localStorage.setItem(STORAGE_KEYS.WEATHER_UNIT, unit);
    document.querySelectorAll('.widget[data-type="weather"]').forEach(el => {
      const display = el.querySelector('.weather-data');
      if (!display || display.dataset.tempC === undefined) return;
      const tempC = parseFloat(display.dataset.tempC);
      const val = unit === 'F' ? ((tempC * 9 / 5) + 32).toFixed(1) : tempC;
      display.textContent = `${val}°${unit}`;
    });
  });
}
