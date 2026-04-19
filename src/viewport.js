import { state, config, pan, layoutState } from './state.js';
import { dbSaveLayout } from './db.js';
import { renderAll } from './render.js';

const canvasInner = document.getElementById('canvas-inner');

export function syncVmButtons() {
  document.querySelectorAll('.vm-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === config.viewportModel);
  });
}

export function setupViewportModel() {
  if (config.viewportModel === 'pan') {
    canvasInner.classList.add('pan-surface');
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
