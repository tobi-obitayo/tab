import { initDB, dbLoadAll, dbSave, dbLoadShortcuts, dbSaveShortcut, dbLoadLayout, dbSaveLayout } from './db.js';
import { state, config, applyLayout } from './state.js';
import { DEFAULT_SHORTCUTS } from './constants.js';
import { snap } from './utils.js';
import { renderAll } from './render.js';
import { renderShortcuts } from './shortcuts.js';
import { setupViewportModel, setViewportModel, clampWidgetsToCanvas } from './viewport.js';
import { initEditMode, initToolbarToggles, initChromeToggles, initTheme, initGrid, initClockFormat, initWeatherUnit, setEditModeModel } from './settings.js';
import { initAppsPanel, initSettingsPanel, initProfilePanel } from './panels.js';
import { initClock } from './clock.js';
import { attachChromeDrag } from './drag.js';
import { addWidget } from './widgets.js';

// ── One-time migration: pixel coords → viewport fractions ─────────────────
async function migrateToFractions(widgets, layout) {
  if (localStorage.getItem('fracCoords')) return;
  const CW = window.innerWidth;
  const CH = window.innerHeight - 52;
  widgets.forEach(w => {
    w.x /= CW; w.y /= CH;
    w.w /= CW; w.h /= CH;
  });
  await Promise.all(widgets.map(dbSave));
  if (layout) {
    for (const key of ['clock', 'search', 'shortcuts']) {
      if (layout[key]) { layout[key].x /= CW; layout[key].y /= CH; }
    }
    await dbSaveLayout(layout);
  }
  localStorage.setItem('fracCoords', '1');
}

marked.use({
  breaks: true,
  renderer: {
    html() { return ''; }, // drop raw HTML blocks — prevents <script> and inline HTML injection
  },
});

async function init() {
  await initDB();

  state.widgets     = await dbLoadAll();
  state.colorCursor = state.widgets.length;

  let shortcuts = await dbLoadShortcuts();
  if (shortcuts.length === 0) {
    await Promise.all(DEFAULT_SHORTCUTS.map(dbSaveShortcut));
    shortcuts = [...DEFAULT_SHORTCUTS];
  }
  state.shortcuts = shortcuts;
  renderShortcuts();

  let layout = await dbLoadLayout();
  const layoutDegenerate = layout && layout.clock && layout.clock.x === 0 && layout.clock.y === 0
                        && layout.search && layout.search.x === 0 && layout.search.y === 0;
  if (!layout || layoutDegenerate) {
    await document.fonts.ready;
    await new Promise(r => requestAnimationFrame(r));
    const vw          = window.innerWidth;
    const vh          = window.innerHeight - 52;
    const clockBlock  = document.getElementById('chrome-clock');
    const searchBlock = document.getElementById('chrome-search');
    const scBlock     = document.getElementById('chrome-shortcuts');
    const clockW  = clockBlock.offsetWidth  || Math.round(vw * 0.38);
    const clockH  = clockBlock.offsetHeight || 100;
    const searchW = searchBlock.offsetWidth  || Math.min(580, Math.round(vw * 0.9));
    const searchH = searchBlock.offsetHeight || 50;
    const scW     = scBlock.offsetWidth      || Math.min(600, Math.round(vw * 0.95));
    const scH     = scBlock.offsetHeight     || 80;
    const totalH  = clockH + searchH + scH + 60;
    const startY  = Math.max(60, Math.round((vh - totalH) / 3));
    layout = {
      id:        'layout',
      clock:     { x: snap((vw - clockW)  / 2), y: snap(startY) },
      search:    { x: snap((vw - searchW) / 2), y: snap(startY + clockH  + 20) },
      shortcuts: { x: snap((vw - scW)     / 2), y: snap(startY + clockH  + searchH + 40) },
      pages:       [0],
      currentPage: 0,
    };
    await dbSaveLayout(layout);
  }

  await migrateToFractions(state.widgets, layout);

  applyLayout(layout);

  if (config.viewportModel === 'pages') {
    state.pages       = layout.pages       ?? [0];
    state.currentPage = layout.currentPage ?? 0;
  }

  ['chrome-clock', 'chrome-search', 'chrome-shortcuts'].forEach(id => {
    attachChromeDrag(document.getElementById(id));
  });

  setupViewportModel();
  initEditMode();
  initToolbarToggles();
  initChromeToggles();
  initTheme();
  initGrid();
  initClockFormat();
  initWeatherUnit();
  initAppsPanel();
  initSettingsPanel();
  initProfilePanel();
  initClock();

  // Viewport + edit mode model button wiring
  document.querySelectorAll('.vm-btn').forEach(btn => {
    btn.addEventListener('click', () => setViewportModel(btn.dataset.mode));
  });
  document.querySelectorAll('.em-btn').forEach(btn => {
    btn.addEventListener('click', () => setEditModeModel(btn.dataset.model));
  });

  // Add widget dropdown
  const btnAdd       = document.getElementById('btn-add');
  const typeDropdown = document.getElementById('type-dropdown');
  btnAdd.addEventListener('click', e => {
    e.stopPropagation();
    typeDropdown.classList.toggle('open');
  });
  typeDropdown.querySelectorAll('.type-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      typeDropdown.classList.remove('open');
      addWidget(opt.dataset.type);
    });
  });
  document.addEventListener('click', () => typeDropdown.classList.remove('open'));
  document.addEventListener('click', () =>
    document.querySelectorAll('.color-popup.open').forEach(p => p.classList.remove('open'))
  );
  document.addEventListener('click', () =>
    document.querySelectorAll('.widget.actions-open').forEach(w => w.classList.remove('actions-open'))
  );

  renderAll();
  clampWidgetsToCanvas();
}

init().catch(err => console.error('[newtab] init failed:', err));
