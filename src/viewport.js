import { state, config, pan, layoutState } from './state.js';
import { dbSave, dbSaveLayout, dbDelete } from './db.js';
import { renderAll } from './render.js';
import { showUndoToast } from './widgets.js';
import { snap } from './utils.js';

const canvas      = document.getElementById('canvas');
const canvasInner = document.getElementById('canvas-inner');

// ── Clamp widgets to visible area on resize ───────────────────────────────

export function clampWidgetsToCanvas() {
  if (config.viewportModel !== 'clamp') return;
  const W = canvasInner.offsetWidth;
  const H = canvasInner.offsetHeight;
  state.widgets.forEach(w => {
    const el = document.querySelector(`.widget[data-id="${w.id}"]`);
    if (!el) return;
    const newX = snap(Math.max(0, Math.min(w.x, W - el.offsetWidth)));
    const newY = snap(Math.max(0, Math.min(w.y, H - el.offsetHeight)));
    if (newX !== w.x || newY !== w.y) {
      w.x = newX;
      w.y = newY;
      el.style.left = w.x + 'px';
      el.style.top  = w.y + 'px';
      dbSave(w);
    }
  });
}

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(clampWidgetsToCanvas, 200);
});

export function syncVmButtons() {
  document.querySelectorAll('.vm-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === config.viewportModel);
  });
}

export function panOffset() {
  return {
    x: Math.round(1500 - canvas.offsetWidth  / 2),
    y: Math.round(1500 - canvas.offsetHeight / 2),
  };
}

export function setupViewportModel() {
  if (config.viewportModel === 'pan') {
    canvasInner.classList.add('pan-surface');
    const off = panOffset();
    pan.x = -off.x;
    pan.y = -off.y;
    canvasInner.style.transform = `translate(${pan.x}px,${pan.y}px)`;
    // Offset chrome elements so they appear at the same visual position as clamp mode
    ['clock', 'search', 'shortcuts'].forEach(key => {
      const el = document.getElementById(`chrome-${key}`);
      if (!el || !layoutState || !layoutState[key]) return;
      el.style.left = (layoutState[key].x + off.x) + 'px';
      el.style.top  = (layoutState[key].y + off.y) + 'px';
    });
  }
  if (config.viewportModel === 'pages') {
    document.getElementById('page-switcher').style.display = 'flex';
    renderPageSwitcher();
  }
  syncVmButtons();
}

export function teardownViewportModel() {
  if (config.viewportModel === 'pan') {
    canvasInner.classList.remove('pan-surface');
    canvasInner.style.transform = '';
    pan.x = 0; pan.y = 0;
    pan.active = false; pan.spaceDown = false;
    document.body.classList.remove('space-held', 'panning');
    document.getElementById('pan-indicator').style.display = 'none';
    // Restore chrome elements to their saved clamp-mode positions
    ['clock', 'search', 'shortcuts'].forEach(key => {
      const el = document.getElementById(`chrome-${key}`);
      if (!el || !layoutState || !layoutState[key]) return;
      el.style.left = layoutState[key].x + 'px';
      el.style.top  = layoutState[key].y + 'px';
    });
  }
  if (config.viewportModel === 'pages') {
    document.getElementById('page-switcher').style.display = 'none';
  }
}

export function setViewportModel(mode) {
  if (mode === config.viewportModel) return;
  teardownViewportModel();
  config.viewportModel = mode;
  localStorage.setItem('viewportModel', mode);
  setupViewportModel();
  renderAll();
  clampWidgetsToCanvas();
}

// ── Pages ─────────────────────────────────────────────────────────────────

export function renderPageSwitcher() {
  const sw = document.getElementById('page-switcher');
  sw.innerHTML = '';
  state.pages.forEach(p => {
    const dot = document.createElement('button');
    dot.className = 'page-dot' + (p === state.currentPage ? ' active' : '');
    dot.title = `Page ${p + 1}`;
    dot.addEventListener('click', () => switchPage(p));
    sw.appendChild(dot);
  });

  if (state.pages.length > 1) {
    const delBtn = document.createElement('button');
    delBtn.className = 'page-del';
    delBtn.title = 'Delete current page';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', () => {
      showConfirm(
        `Delete Page ${state.currentPage + 1}? All widgets on this page will be removed.`,
        () => deletePage(state.currentPage)
      );
    });
    sw.appendChild(delBtn);
  }

  const addBtn = document.createElement('button');
  addBtn.className = 'page-add';
  addBtn.textContent = '+';
  addBtn.title = 'Add page';
  addBtn.addEventListener('click', addPage);
  sw.appendChild(addBtn);
}

function switchPage(pageIndex) {
  state.currentPage = pageIndex;
  layoutState.currentPage = pageIndex;
  dbSaveLayout(layoutState);
  renderAll();
  renderPageSwitcher();
}

function addPage() {
  const newIndex = Math.max(...state.pages) + 1;
  state.pages.push(newIndex);
  layoutState.pages       = state.pages;
  layoutState.currentPage = newIndex;
  dbSaveLayout(layoutState);
  state.currentPage = newIndex;
  renderAll();
  renderPageSwitcher();
}

function deletePage(pageIndex) {
  const affected = state.widgets.filter(w => (w.page ?? 0) === pageIndex);
  const saved = affected.map(w => ({
    widget: w,
    el: document.querySelector(`.widget[data-id="${w.id}"]`),
  }));

  state.widgets = state.widgets.filter(w => (w.page ?? 0) !== pageIndex);
  saved.forEach(({ el }) => el?.remove());

  const prevIdx = state.pages.indexOf(pageIndex);
  state.pages = state.pages.filter(p => p !== pageIndex);
  const newPage = state.pages[Math.max(0, prevIdx - 1)] ?? state.pages[0] ?? 0;
  state.currentPage = newPage;
  layoutState.pages = state.pages;
  layoutState.currentPage = newPage;
  dbSaveLayout(layoutState);
  renderAll();
  renderPageSwitcher();

  showUndoToast(
    `Page ${pageIndex + 1}`,
    () => {
      state.pages.push(pageIndex);
      state.pages.sort((a, b) => a - b);
      affected.forEach(w => state.widgets.push(w));
      saved.forEach(({ el }) => el && canvasInner.appendChild(el));
      state.currentPage = pageIndex;
      layoutState.pages = state.pages;
      layoutState.currentPage = pageIndex;
      dbSaveLayout(layoutState);
      renderAll();
      renderPageSwitcher();
    },
    () => {
      affected.forEach(w => dbDelete(w.id));
      layoutState.pages = state.pages;
      layoutState.currentPage = state.currentPage;
      dbSaveLayout(layoutState);
    }
  );
}

// ── Confirm modal ─────────────────────────────────────────────────────────

function showConfirm(msg, onOk) {
  const overlay  = document.getElementById('confirm-modal');
  document.getElementById('confirm-msg').textContent = msg;
  overlay.classList.add('open');

  const okBtn     = document.getElementById('confirm-ok');
  const cancelBtn = document.getElementById('confirm-cancel');

  const close   = () => overlay.classList.remove('open');
  const cleanup = () => {
    okBtn.removeEventListener('click', handleOk);
    cancelBtn.removeEventListener('click', handleCancel);
    overlay.removeEventListener('click', handleOverlay);
  };
  const handleOk      = () => { cleanup(); close(); onOk(); };
  const handleCancel  = () => { cleanup(); close(); };
  const handleOverlay = e => { if (e.target === overlay) { cleanup(); close(); } };

  okBtn.addEventListener('click', handleOk);
  cancelBtn.addEventListener('click', handleCancel);
  overlay.addEventListener('click', handleOverlay);
}
