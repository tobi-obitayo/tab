import { state, config } from './state.js';
import { updateClock } from './clock.js';

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
  localStorage.setItem('editModeModel', model);
  btnEdit.style.display = model === 'b' ? 'none' : '';
  if (model !== 'b') setEditMode(false);
  syncEmButtons();
}

export function initEditMode() {
  btnEdit.style.display = config.editModeModel === 'b' ? 'none' : '';
  syncEmButtons();
  btnEdit.addEventListener('click',   () => setEditMode(!state.editMode));
  btnLayout.addEventListener('click', () => setLayoutMode(!state.layoutMode));
}

// ── Toolbar visibility toggles ────────────────────────────────────────────

const TOOLBAR_TOGGLES = [
  { id: 'tog-gmail',  key: 'toolbar-gmail',  elId: 'gc-gmail'  },
  { id: 'tog-images', key: 'toolbar-images', elId: 'gc-images' },
  { id: 'tog-apps',   key: 'toolbar-apps',   elId: 'btn-apps'  },
  { id: 'tog-avatar', key: 'toolbar-avatar', elId: 'avatar'    },
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

// ── Theme ─────────────────────────────────────────────────────────────────

export function initTheme() {
  function applyTheme(dark) {
    document.body.classList.toggle('dark', dark);
    const tog = document.getElementById('tog-dark');
    if (tog) tog.checked = dark;
  }

  const stored = localStorage.getItem('theme');
  applyTheme(stored !== null ? stored === 'dark' : true);

  document.addEventListener('change', e => {
    if (e.target.id !== 'tog-dark') return;
    const dark = e.target.checked;
    applyTheme(dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  });
}

// ── Grid ──────────────────────────────────────────────────────────────────

export function initGrid() {
  function applyGrid(on) {
    document.body.classList.toggle('no-grid', !on);
    const tog = document.getElementById('tog-grid');
    if (tog) tog.checked = on;
  }

  applyGrid(localStorage.getItem('grid') !== '0');

  document.addEventListener('change', e => {
    if (e.target.id !== 'tog-grid') return;
    localStorage.setItem('grid', e.target.checked ? '1' : '0');
    applyGrid(e.target.checked);
  });
}

// ── Clock format ──────────────────────────────────────────────────────────

export function initClockFormat() {
  const tog = document.getElementById('tog-clock24');
  if (!tog) return;
  tog.checked = localStorage.getItem('clockFormat') === '24';
  tog.addEventListener('change', () => {
    localStorage.setItem('clockFormat', tog.checked ? '24' : '12');
    updateClock();
  });
}
