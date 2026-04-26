import { state, config, pan } from './state.js';
import { PALETTE, DEFAULTS } from './constants.js';
import { dbSave, dbDelete } from './db.js';
import { snap } from './utils.js';
// Circular imports — safe because cross-calls only happen in callbacks/promise handlers (runtime, not load time)
import { createWidgetEl, syncEmptyState, visibleWidgets } from './render.js';
import { setEditMode } from './settings.js';
import { makeTitleEditable } from './editor.js';

// ── Undo toast ────────────────────────────────────────────────────────────

const undoToast    = document.getElementById('undo-toast');
const undoToastMsg = document.getElementById('undo-toast-msg');
const undoToastBtn = document.getElementById('undo-toast-btn');
let undoTimer  = null;
let onUndoFn   = null;
let onCommitFn = null;

undoToastBtn.addEventListener('click', () => {
  if (!onUndoFn) return;
  clearTimeout(undoTimer);
  onUndoFn();
  onUndoFn = null; onCommitFn = null;
  undoToast.classList.remove('visible');
});

export function showUndoToast(label, onUndo, onCommit) {
  if (onCommitFn) { onCommitFn(); }
  undoToastMsg.textContent = `"${label}" deleted`;
  undoToast.classList.add('visible');
  clearTimeout(undoTimer);
  onUndoFn   = onUndo;
  onCommitFn = onCommit;
  undoTimer = setTimeout(() => {
    undoToast.classList.remove('visible');
    if (onCommitFn) { onCommitFn(); }
    onUndoFn = null; onCommitFn = null;
  }, 5000);
}

// ── Z-index management ────────────────────────────────────────────────────

export function bringToFront(id) {
  const maxZ = Math.max(0, ...state.widgets.map(w => w.z || 0));
  const w = state.widgets.find(w => w.id === id);
  if (!w) return;
  if ((w.z || 0) === maxZ && maxZ > 0) return;
  w.z = maxZ + 1;
  document.querySelector(`.widget[data-id="${id}"]`).style.zIndex = w.z;
  dbSave(w);
}

// ── CRUD ──────────────────────────────────────────────────────────────────

export function deleteWidget(id) {
  const widget = state.widgets.find(w => w.id === id);
  if (!widget) return;
  const el = document.querySelector(`.widget[data-id="${id}"]`);
  state.widgets = state.widgets.filter(w => w.id !== id);
  el?.remove();
  syncEmptyState();

  showUndoToast(
    widget.title || widget.type,
    () => {
      state.widgets.push(widget);
      document.getElementById('canvas-inner').appendChild(el);
      syncEmptyState();
    },
    () => dbDelete(widget.id)
  );
}

export function addWidget(type) {
  const color  = PALETTE[state.colorCursor % PALETTE.length];
  state.colorCursor++;

  const def    = DEFAULTS[type] || { w: 240, h: 200 };
  const vis    = visibleWidgets();
  const offset = vis.length * 20; // GRID

  const vcx = Math.round(window.innerWidth  / 2);
  const vcy = Math.round((window.innerHeight - parseInt(getComputedStyle(document.documentElement).getPropertyValue('--toolbar-h')) || 52) / 2);
  const cx  = config.viewportModel === 'pan' ? vcx - pan.x : vcx;
  const cy  = config.viewportModel === 'pan' ? vcy - pan.y : 40;

  const content = type === 'stopwatch'
    ? JSON.stringify({ elapsed: 0, running: false, startedAt: null })
    : '';

  const w = {
    id:      crypto.randomUUID(),
    type,
    title:   { note: 'New Note', task: 'New Tasks', link: 'New Links', stopwatch: 'Stopwatch', weather: 'Weather' }[type],
    content,
    x: snap(cx - def.w / 2 + offset),
    y: snap(cy + offset),
    w: def.w,
    h: def.h,
    color,
  };

  if (config.viewportModel === 'pages') w.page = state.currentPage;

  state.widgets.push(w);

  dbSave(w).then(() => {
    const el = createWidgetEl(w);
    syncEmptyState();
    setEditMode(true);
    if (w.type !== 'stopwatch') makeTitleEditable(el, w);
  });
}
