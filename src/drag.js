import { state, config, pan, layoutState } from './state.js';
import { dbSave, dbSaveLayout } from './db.js';
import { snap, panOffset } from './utils.js';
import { MIN_W, MIN_H, PAN_SIZE, PAN_CENTER } from './constants.js';

const canvas      = document.getElementById('canvas');
const canvasInner = document.getElementById('canvas-inner');

let dragging = null;
let dragOffX = 0;
let dragOffY = 0;

let resizing     = null;
let resizeStartX = 0;
let resizeStartY = 0;
let resizeStartW = 0;
let resizeStartH = 0;

export function startDrag(el, e) {
  dragging = el;
  const cr = canvasInner.getBoundingClientRect();
  dragOffX = e.clientX - cr.left - el.offsetLeft;
  dragOffY = e.clientY - cr.top  - el.offsetTop;
  el.classList.add('dragging');
}

export function attachDrag(el) {
  el.querySelector('.widget-header').addEventListener('mousedown', e => {
    if (e.target.closest('.widget-actions')) return;
    if (state.layoutMode) return;
    if (config.editModeModel !== 'b' && !state.editMode) return;
    if (pan.active) return;
    e.preventDefault();
    startDrag(el, e);
  });
}

export function attachResize(el) {
  el.querySelector('.resize-handle').addEventListener('mousedown', e => {
    if (state.layoutMode) return;
    if (config.editModeModel !== 'b' && !state.editMode) return;
    e.preventDefault();
    e.stopPropagation();
    resizing     = el;
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    resizeStartW = el.offsetWidth;
    resizeStartH = el.offsetHeight;
  });
}

export function attachChromeDrag(blockEl) {
  blockEl.addEventListener('mousedown', e => {
    if (!state.layoutMode) return;
    if (pan.active) return;
    if (e.target.closest('input, button, a, select, textarea')) return;
    e.preventDefault();
    startDrag(blockEl, e);
  });
}

document.addEventListener('mousemove', e => {
  if (pan.active) {
    pan.x = Math.min(0, Math.max(canvas.offsetWidth  - PAN_SIZE, pan.originX + (e.clientX - pan.startX)));
    pan.y = Math.min(0, Math.max(canvas.offsetHeight - PAN_SIZE, pan.originY + (e.clientY - pan.startY)));
    canvasInner.style.transform = `translate(${pan.x}px,${pan.y}px)`;
    const panIndicator = document.getElementById('pan-indicator');
    // Indicator shows 0,0 at the centered origin (canvas PAN_CENTER,PAN_CENTER)
    const indX = (canvas.offsetWidth  / 2 - PAN_CENTER - pan.x) | 0;
    const indY = (canvas.offsetHeight / 2 - PAN_CENTER - pan.y) | 0;
    panIndicator.textContent = `${indX}, ${indY}`;
    panIndicator.style.display = 'block';
    return;
  }

  if (resizing) {
    resizing.style.width  = Math.max(MIN_W, resizeStartW + (e.clientX - resizeStartX)) + 'px';
    resizing.style.height = Math.max(MIN_H, resizeStartH + (e.clientY - resizeStartY)) + 'px';
    return;
  }

  if (!dragging) return;
  const cr = canvasInner.getBoundingClientRect();
  dragging.style.left = Math.max(0, e.clientX - cr.left - dragOffX) + 'px';
  dragging.style.top  = Math.max(0, e.clientY - cr.top  - dragOffY) + 'px';
});

document.addEventListener('mouseup', () => {
  if (pan.active) {
    pan.active = false;
    document.body.classList.remove('panning');
    if (!pan.spaceDown) document.getElementById('pan-indicator').style.display = 'none';
    return;
  }

  if (resizing) {
    const CW = canvasInner.offsetWidth;
    const CH = canvasInner.offsetHeight;
    const snappedW = Math.max(MIN_W, snap(resizing.offsetWidth));
    const snappedH = Math.max(MIN_H, snap(resizing.offsetHeight));
    resizing.style.width  = snappedW + 'px';
    resizing.style.height = snappedH + 'px';
    const w = state.widgets.find(w => w.id === resizing.dataset.id);
    if (w) { w.w = snappedW / CW; w.h = snappedH / CH; dbSave(w); }
    resizing = null;
    return;
  }

  if (!dragging) return;

  let snappedX = snap(parseFloat(dragging.style.left));
  let snappedY = snap(parseFloat(dragging.style.top));

  if (config.viewportModel === 'clamp') {
    const elW = dragging.offsetWidth;
    const elH = dragging.offsetHeight;
    snappedX = Math.max(0, Math.min(snappedX, snap(canvasInner.offsetWidth  - elW)));
    snappedY = Math.max(0, Math.min(snappedY, snap(canvasInner.offsetHeight - elH)));
  }

  dragging.style.left = snappedX + 'px';
  dragging.style.top  = snappedY + 'px';
  dragging.classList.remove('dragging');

  // In pan mode, canvas positions include the centering offset; strip it before saving
  const CW = canvasInner.offsetWidth;
  const CH = canvasInner.offsetHeight;
  const { x: saveOffX, y: saveOffY } = config.viewportModel === 'pan' ? panOffset(canvas.offsetWidth, canvas.offsetHeight) : { x: 0, y: 0 };

  const chromeKey = dragging.dataset.chromeKey;
  if (chromeKey) {
    layoutState[chromeKey] = { x: (snappedX - saveOffX) / CW, y: (snappedY - saveOffY) / CH };
    dbSaveLayout(layoutState);
  } else {
    const w = state.widgets.find(w => w.id === dragging.dataset.id);
    if (w) { w.x = (snappedX - saveOffX) / CW; w.y = (snappedY - saveOffY) / CH; dbSave(w); }
  }
  dragging = null;
});

document.addEventListener('keydown', e => {
  if (config.viewportModel !== 'pan') return;
  if (e.code !== 'Space') return;
  if (e.target.matches('input, textarea, [contenteditable]')) return;
  e.preventDefault();
  pan.spaceDown = true;
  document.body.classList.add('space-held');
});

document.addEventListener('keyup', e => {
  if (e.code !== 'Space') return;
  pan.spaceDown = false;
  pan.active    = false;
  document.body.classList.remove('space-held', 'panning');
  if (config.viewportModel === 'pan') document.getElementById('pan-indicator').style.display = 'none';
});

canvas.addEventListener('mousedown', e => {
  if (config.viewportModel !== 'pan' || !pan.spaceDown) return;
  if (dragging || resizing) return;
  e.preventDefault();
  pan.active  = true;
  pan.startX  = e.clientX;
  pan.startY  = e.clientY;
  pan.originX = pan.x;
  pan.originY = pan.y;
  document.body.classList.add('panning');
});
