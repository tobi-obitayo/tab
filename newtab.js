// =============================================================================
// CONSTANTS
// =============================================================================

let VIEWPORT_MODEL  = localStorage.getItem('viewportModel')  || 'clamp'; // 'clamp' | 'pan' | 'pages'
let EDIT_MODE_MODEL = localStorage.getItem('editModeModel') || 'c';     // 'a' | 'b' | 'c'

const GRID  = 20;
const MIN_W = 160;
const MIN_H = 100;

const PALETTE = ['var(--c0)','var(--c1)','var(--c2)','var(--c3)','var(--c4)','var(--c5)'];

const DEFAULTS = {
  note: { w: 280, h: 220 },
  task: { w: 240, h: 200 },
  link: { w: 260, h: 180 },
};

// 6 default shortcuts (IDs 0–5)
const DEFAULT_SHORTCUTS = [
  { id: 0, label: 'Google',   url: 'https://www.google.com'      },
  { id: 1, label: 'Gmail',    url: 'https://mail.google.com'     },
  { id: 2, label: 'YouTube',  url: 'https://www.youtube.com'     },
  { id: 3, label: 'GitHub',   url: 'https://github.com'          },
  { id: 4, label: 'Maps',     url: 'https://maps.google.com'     },
  { id: 5, label: 'ChatGPT',  url: 'https://chat.openai.com'     },
];

// =============================================================================
// DATABASE — IndexedDB  (version 3)
// =============================================================================
// v1 → widgets  (dashboard.html)
// v2 → + shortcuts
// v3 → + layout  (layout store exists but is unused in this version)

let db;

function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('tab-dash', 3);

    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('widgets'))
        d.createObjectStore('widgets',   { keyPath: 'id' });
      if (!d.objectStoreNames.contains('shortcuts'))
        d.createObjectStore('shortcuts', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('layout'))
        d.createObjectStore('layout',    { keyPath: 'id' });
    };

    req.onsuccess = e => { db = e.target.result; resolve(db); };
    req.onerror   = e => reject(e);
  });
}

// ── Widgets ───────────────────────────────────────────────────────────────
function dbSave(widget) {
  return new Promise((res, rej) => {
    const tx = db.transaction('widgets', 'readwrite');
    tx.objectStore('widgets').put(widget).onsuccess = res;
    tx.onerror = rej;
  });
}

function dbDelete(id) {
  return new Promise((res, rej) => {
    const tx = db.transaction('widgets', 'readwrite');
    tx.objectStore('widgets').delete(id).onsuccess = res;
    tx.onerror = rej;
  });
}

function dbLoadAll() {
  return new Promise((res, rej) => {
    const tx  = db.transaction('widgets', 'readonly');
    const req = tx.objectStore('widgets').getAll();
    req.onsuccess = () => res(req.result);
    req.onerror   = rej;
  });
}

// ── Shortcuts ─────────────────────────────────────────────────────────────
function dbSaveShortcut(sc) {
  return new Promise((res, rej) => {
    const tx = db.transaction('shortcuts', 'readwrite');
    tx.objectStore('shortcuts').put(sc).onsuccess = res;
    tx.onerror = rej;
  });
}

function dbDeleteShortcut(id) {
  return new Promise((res, rej) => {
    const tx = db.transaction('shortcuts', 'readwrite');
    tx.objectStore('shortcuts').delete(id).onsuccess = res;
    tx.onerror = rej;
  });
}

function dbLoadShortcuts() {
  return new Promise((res, rej) => {
    const tx  = db.transaction('shortcuts', 'readonly');
    const req = tx.objectStore('shortcuts').getAll();
    req.onsuccess = () => res(req.result);
    req.onerror   = rej;
  });
}

// ── Layout ────────────────────────────────────────────────────────────────
function dbSaveLayout(layout) {
  return new Promise((res, rej) => {
    const tx = db.transaction('layout', 'readwrite');
    tx.objectStore('layout').put(layout).onsuccess = res;
    tx.onerror = rej;
  });
}

function dbLoadLayout() {
  return new Promise((res, rej) => {
    const tx  = db.transaction('layout', 'readonly');
    const req = tx.objectStore('layout').get('layout');
    req.onsuccess = () => res(req.result ?? null);
    req.onerror   = rej;
  });
}

// =============================================================================
// STATE
// =============================================================================

const state = {
  widgets:     [],
  shortcuts:   [],
  editMode:    false,
  layoutMode:  false,
  colorCursor: 0,
  currentPage: 0,
  pages:       [0],
};

let layoutState = null;

// Pan mode state
let panX = 0, panY = 0;
let panning    = false;
let panStartX  = 0, panStartY  = 0;
let panOriginX = 0, panOriginY = 0;
let spaceDown  = false;

function applyLayout(layout) {
  layoutState = layout;
  const map = {
    clock:     document.getElementById('chrome-clock'),
    search:    document.getElementById('chrome-search'),
    shortcuts: document.getElementById('chrome-shortcuts'),
  };
  for (const [key, el] of Object.entries(map)) {
    const pos = layout[key];
    if (pos) { el.style.left = pos.x + 'px'; el.style.top = pos.y + 'px'; }
  }
}

// =============================================================================
// UTILITIES
// =============================================================================

function snap(n) { return Math.round(n / GRID) * GRID; }

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hostname(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

function faviconSrc(url) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
  } catch {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url)}&sz=64`;
  }
}

// =============================================================================
// CLOCK
// =============================================================================

const clockEl = document.getElementById('clock');

function updateClock() {
  clockEl.textContent = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

updateClock();
setInterval(updateClock, 1000);

// =============================================================================
// SHORTCUTS
// =============================================================================

const shortcutsEl = document.getElementById('shortcuts');

function renderShortcuts() {
  shortcutsEl.innerHTML = '';
  // Sort: numeric IDs (defaults) first, then by id ascending (insertion order for Date.now() IDs)
  const sorted = [...state.shortcuts].sort((a, b) => a.id - b.id);
  sorted.forEach(sc => shortcutsEl.appendChild(buildShortcutEl(sc)));
  shortcutsEl.appendChild(buildAddTile());
}

// Build a single shortcut tile element
function buildShortcutEl(sc) {
  const div = document.createElement('div');
  div.className  = 'shortcut';
  div.dataset.id = sc.id;

  div.innerHTML = `
    <a class="shortcut-link" href="${esc(sc.url)}" rel="noopener">
      <div class="shortcut-icon">
        <img class="shortcut-favicon"
          src="${faviconSrc(sc.url)}"
          onerror="this.style.display='none'">
      </div>
      <span class="shortcut-label">${esc(sc.label)}</span>
    </a>
  `;

  // Right-click → context menu
  div.addEventListener('contextmenu', e => {
    e.preventDefault();
    showCtxMenu(sc, e.clientX, e.clientY);
  });

  return div;
}

// Rebuild one tile in place (called after edit save)
function patchShortcutEl(sc) {
  const old = shortcutsEl.querySelector(`.shortcut[data-id="${sc.id}"]`);
  if (old) old.replaceWith(buildShortcutEl(sc));
}

// Build the persistent "Add shortcut" tile
function buildAddTile() {
  const div = document.createElement('div');
  div.className = 'shortcut-add';
  div.id = 'shortcut-add-tile';
  div.innerHTML = `
    <div class="shortcut-add-icon">+</div>
    <span class="shortcut-add-label">Add shortcut</span>
  `;
  div.addEventListener('click', e => {
    e.stopPropagation();
    openAddPopover(div);
  });
  return div;
}

// ── Inline edit ─────────────────────────────────────────────────────────
function editShortcut(sc) {
  const el = shortcutsEl.querySelector(`.shortcut[data-id="${sc.id}"]`);
  if (!el || el.classList.contains('editing')) return;

  el.classList.add('editing');
  el.innerHTML = `
    <div class="shortcut-icon">
      <img class="shortcut-favicon" src="${faviconSrc(sc.url)}" onerror="this.style.display='none'">
    </div>
    <input class="sc-input" id="sc-name-${sc.id}" value="${esc(sc.label)}" placeholder="Name">
    <input class="sc-input" id="sc-url-${sc.id}"  value="${esc(sc.url)}"   placeholder="URL">
  `;

  const nameIn = el.querySelector(`#sc-name-${sc.id}`);
  const urlIn  = el.querySelector(`#sc-url-${sc.id}`);

  nameIn.focus();
  nameIn.select();

  urlIn.addEventListener('input', () => {
    const img = el.querySelector('.shortcut-favicon');
    img.style.display = '';
    img.src = faviconSrc(urlIn.value);
  });

  let cancelled = false;

  const tryCommit = () => {
    setTimeout(() => {
      if (cancelled || el.contains(document.activeElement)) return;
      sc.label = nameIn.value.trim() || sc.label;
      sc.url   = urlIn.value.trim()  || sc.url;
      dbSaveShortcut(sc).then(() => patchShortcutEl(sc));
    }, 120);
  };

  nameIn.addEventListener('blur', tryCommit);
  urlIn.addEventListener('blur', tryCommit);

  [nameIn, urlIn].forEach(inp => {
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); inp.blur(); }
      if (e.key === 'Escape') { cancelled = true; patchShortcutEl(sc); }
    });
  });
}

// ── Remove ──────────────────────────────────────────────────────────────
function removeShortcut(id) {
  state.shortcuts = state.shortcuts.filter(sc => sc.id !== id);
  dbDeleteShortcut(id).then(() => renderShortcuts());
}

// =============================================================================
// CONTEXT MENU
// =============================================================================

const ctxMenu    = document.getElementById('ctx-menu');
let   ctxTarget  = null;  // the shortcut object currently targeted

function showCtxMenu(sc, x, y) {
  ctxTarget = sc;

  // Keep menu inside the viewport
  const menuW = 140, menuH = 76;
  const left  = Math.min(x, window.innerWidth  - menuW - 8);
  const top   = Math.min(y, window.innerHeight - menuH - 8);

  ctxMenu.style.left = left + 'px';
  ctxMenu.style.top  = top  + 'px';
  ctxMenu.classList.add('open');
}

document.getElementById('ctx-edit').addEventListener('click', () => {
  if (ctxTarget) editShortcut(ctxTarget);
  ctxMenu.classList.remove('open');
});

document.getElementById('ctx-remove').addEventListener('click', () => {
  if (ctxTarget) removeShortcut(ctxTarget.id);
  ctxMenu.classList.remove('open');
  ctxTarget = null;
});

// Any click outside closes it
document.addEventListener('click', () => {
  ctxMenu.classList.remove('open');
  ctxTarget = null;
});

// Prevent the menu itself from closing when clicking inside it
ctxMenu.addEventListener('click', e => e.stopPropagation());

// =============================================================================
// ADD SHORTCUT POPOVER
// =============================================================================

const addPopover = document.getElementById('add-popover');
const popName    = document.getElementById('pop-name');
const popUrl     = document.getElementById('pop-url');

function openAddPopover(anchorEl) {
  const rect = anchorEl.getBoundingClientRect();

  // Position below the tile, shifted left if it would overflow
  let left = rect.left;
  const popW = 230;
  if (left + popW > window.innerWidth - 12) left = window.innerWidth - popW - 12;

  addPopover.style.left = left + 'px';
  addPopover.style.top  = (rect.bottom + 8) + 'px';
  addPopover.classList.add('open');

  popName.value = '';
  popUrl.value  = '';
  popName.focus();
}

function closeAddPopover() {
  addPopover.classList.remove('open');
}

document.getElementById('pop-confirm').addEventListener('click', confirmAddShortcut);
document.getElementById('pop-cancel').addEventListener('click', closeAddPopover);

[popName, popUrl].forEach(inp => {
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); confirmAddShortcut(); }
    if (e.key === 'Escape') { closeAddPopover(); }
  });
});

function confirmAddShortcut() {
  const label = popName.value.trim();
  let   url   = popUrl.value.trim();
  if (!label || !url) {
    // Highlight missing fields
    if (!label) popName.focus();
    else         popUrl.focus();
    return;
  }
  // Prepend https:// if the user didn't include a scheme
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  const sc = { id: Date.now(), label, url };
  state.shortcuts.push(sc);
  dbSaveShortcut(sc).then(() => renderShortcuts());
  closeAddPopover();
}

// Click outside popover closes it
document.addEventListener('click', e => {
  if (!addPopover.contains(e.target) && e.target.id !== 'shortcut-add-tile') {
    closeAddPopover();
  }
});
addPopover.addEventListener('click', e => e.stopPropagation());

// =============================================================================
// CONTENT PARSERS
// =============================================================================

function parseTasks(raw = '') {
  return raw.split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => ({
      done: /^\[x\]/i.test(l),
      text: l.replace(/^\[[ xX]\]\s*/, ''),
    }));
}

function serializeTasks(tasks) {
  return tasks.map(t => `${t.done ? '[x]' : '[ ]'} ${t.text}`).join('\n');
}

function parseLinks(raw = '') {
  return raw.split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => {
      const [title, url] = l.split('|').map(s => s.trim());
      return url ? { title, url } : { title: '', url: title };
    });
}

// =============================================================================
// RENDER — widgets
// =============================================================================

const canvas      = document.getElementById('canvas');
const canvasInner = document.getElementById('canvas-inner');
const emptyEl     = document.getElementById('empty');

function visibleWidgets() {
  if (VIEWPORT_MODEL === 'pages')
    return state.widgets.filter(w => (w.page ?? 0) === state.currentPage);
  return state.widgets;
}

function renderAll() {
  canvasInner.querySelectorAll('.widget').forEach(el => el.remove());
  visibleWidgets().forEach(createWidgetEl);
  syncEmptyState();
}

function syncEmptyState() {
  emptyEl.style.display = visibleWidgets().length === 0 ? 'block' : 'none';
}

function createWidgetEl(w) {
  const el = document.createElement('div');
  el.className = 'widget';
  el.dataset.id   = w.id;
  el.dataset.type = w.type;
  el.style.cssText = `left:${w.x}px; top:${w.y}px; width:${w.w}px; height:${w.h}px;`;
  el.style.setProperty('--wc', w.color);

  el.innerHTML = `
    <div class="widget-header">
      <span class="drag-handle" title="Drag to move">⠿</span>
      <span class="widget-title">${esc(w.title || 'Untitled')}</span>
      <div class="widget-actions">
        <button class="act-btn edit" title="Edit">✎</button>
        <button class="act-btn del"  title="Delete">✕</button>
      </div>
    </div>
    <div class="widget-body">${renderBody(w)}</div>
    <div class="resize-handle"></div>
  `;

  el.querySelector('.act-btn.edit').addEventListener('click', e => {
    e.stopPropagation();
    if (EDIT_MODE_MODEL === 'b' || state.editMode) makeBodyEditable(el, w);
  });

  el.querySelector('.act-btn.del').addEventListener('click', e => {
    e.stopPropagation();
    deleteWidget(w.id);
  });

  el.addEventListener('click', e => {
    if (state.layoutMode) return; // widgets frozen in layout mode
    // Model B: always editable, no global mode
    if (EDIT_MODE_MODEL === 'b') {
      if (e.target.closest('.widget-title') && !el.querySelector('.inline-title-input')) {
        e.stopPropagation(); makeTitleEditable(el, w); return;
      }
      const bodyEl = e.target.closest('.widget-body');
      if (bodyEl && !el.querySelector('.inline-editor')) {
        if (e.target.tagName === 'INPUT') return;
        e.stopPropagation(); makeBodyEditable(el, w);
      }
      return;
    }

    // Model C: silently enter edit mode on first widget click
    if (EDIT_MODE_MODEL === 'c' && !state.editMode) setEditMode(true);

    if (!state.editMode) return;

    if (e.target.closest('.widget-title') && !el.querySelector('.inline-title-input')) {
      e.stopPropagation();
      makeTitleEditable(el, w);
      return;
    }

    const bodyEl = e.target.closest('.widget-body');
    if (bodyEl && !el.querySelector('.inline-editor')) {
      if (e.target.tagName === 'INPUT') return;
      e.stopPropagation();
      makeBodyEditable(el, w);
    }
  });

  el.addEventListener('dblclick', () => {
    // Model A: dblclick as a convenience shortcut to enter edit mode
    if (EDIT_MODE_MODEL === 'a' && !state.editMode) setEditMode(true);
  });

  if (w.type === 'task') wireTaskCheckboxes(el, w);

  attachDrag(el);
  attachResize(el);

  canvasInner.appendChild(el);
  return el;
}

function renderBody(w) {
  switch (w.type) {
    case 'note': {
      if (!w.content?.trim())
        return '<span class="widget-empty">empty note — click to edit</span>';
      return marked.parse(w.content);
    }
    case 'task': {
      const tasks = parseTasks(w.content);
      if (!tasks.length)
        return '<span class="widget-empty">no tasks yet — click to add</span>';
      return tasks.map((t, i) => `
        <div class="task-item ${t.done ? 'done' : ''}">
          <input type="checkbox" data-idx="${i}" ${t.done ? 'checked' : ''}>
          <span>${esc(t.text)}</span>
        </div>
      `).join('');
    }
    case 'link': {
      const links = parseLinks(w.content);
      if (!links.length)
        return '<span class="widget-empty">no links yet — click to add</span>';
      return links.map(l => `
        <a class="link-item" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">
          <img class="link-favicon"
            src="https://www.google.com/s2/favicons?domain=${esc(l.url)}&sz=32"
            onerror="this.style.display='none'">
          <span class="link-label">${esc(l.title || l.url)}</span>
          <span class="link-host">${esc(hostname(l.url))}</span>
        </a>
      `).join('');
    }
  }
  return '';
}

function wireTaskCheckboxes(widgetEl, widget) {
  widgetEl.querySelectorAll('.task-item input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const tasks = parseTasks(widget.content);
      const idx   = parseInt(cb.dataset.idx, 10);
      if (tasks[idx]) {
        tasks[idx].done = cb.checked;
        widget.content  = serializeTasks(tasks);
        dbSave(widget);
        cb.closest('.task-item').classList.toggle('done', cb.checked);
      }
    });
  });
}

function patchWidgetEl(w) {
  const el = document.querySelector(`.widget[data-id="${w.id}"]`);
  if (!el) return;
  el.querySelector('.widget-title').textContent = w.title || 'Untitled';
  const body = el.querySelector('.widget-body');
  body.innerHTML = renderBody(w);
  if (w.type === 'task') wireTaskCheckboxes(el, w);
}

// =============================================================================
// DRAG — widgets + chrome blocks
// =============================================================================

let dragging = null;
let dragOffX = 0;
let dragOffY = 0;

function startDrag(el, e) {
  dragging = el;
  const cr = canvasInner.getBoundingClientRect();
  dragOffX = e.clientX - cr.left - el.offsetLeft;
  dragOffY = e.clientY - cr.top  - el.offsetTop;
  el.classList.add('dragging');
}

function attachDrag(el) {
  el.querySelector('.widget-header').addEventListener('mousedown', e => {
    if (e.target.closest('.widget-actions')) return;
    if (state.layoutMode) return;
    if (EDIT_MODE_MODEL !== 'b' && !state.editMode) return;
    if (panning) return;
    e.preventDefault();
    startDrag(el, e);
  });
}

document.addEventListener('mousemove', e => {
  // ── Pan ──────────────────────────────────────────────────────────────
  if (panning) {
    panX = Math.min(0, Math.max(canvas.offsetWidth  - 3000, panOriginX + (e.clientX - panStartX)));
    panY = Math.min(0, Math.max(canvas.offsetHeight - 3000, panOriginY + (e.clientY - panStartY)));
    canvasInner.style.transform = `translate(${panX}px,${panY}px)`;
    const panIndicator = document.getElementById('pan-indicator');
    panIndicator.textContent = `${-panX | 0}, ${-panY | 0}`;
    panIndicator.style.display = 'block';
    return;
  }

  // ── Widget / chrome drag ─────────────────────────────────────────────
  if (!dragging) return;
  const cr = canvasInner.getBoundingClientRect();
  dragging.style.left = Math.max(0, e.clientX - cr.left - dragOffX) + 'px';
  dragging.style.top  = Math.max(0, e.clientY - cr.top  - dragOffY) + 'px';
});

document.addEventListener('mouseup', () => {
  // ── End pan ──────────────────────────────────────────────────────────
  if (panning) {
    panning = false;
    document.body.classList.remove('panning');
    if (!spaceDown) document.getElementById('pan-indicator').style.display = 'none';
    return;
  }

  if (!dragging) return;

  let snappedX = snap(parseFloat(dragging.style.left));
  let snappedY = snap(parseFloat(dragging.style.top));

  // Clamp mode: keep element fully inside canvas bounds
  if (VIEWPORT_MODEL === 'clamp') {
    const elW = dragging.offsetWidth;
    const elH = dragging.offsetHeight;
    snappedX = Math.max(0, Math.min(snappedX, snap(canvasInner.offsetWidth  - elW)));
    snappedY = Math.max(0, Math.min(snappedY, snap(canvasInner.offsetHeight - elH)));
  }

  dragging.style.left = snappedX + 'px';
  dragging.style.top  = snappedY + 'px';
  dragging.classList.remove('dragging');

  const chromeKey = dragging.dataset.chromeKey;
  if (chromeKey) {
    layoutState[chromeKey] = { x: snappedX, y: snappedY };
    dbSaveLayout(layoutState);
  } else {
    const w = state.widgets.find(w => w.id === dragging.dataset.id);
    if (w) { w.x = snappedX; w.y = snappedY; dbSave(w); }
  }
  dragging = null;
});

// ── Pan: Space key + canvas mousedown ────────────────────────────────────

document.addEventListener('keydown', e => {
  if (VIEWPORT_MODEL !== 'pan') return;
  if (e.code !== 'Space') return;
  if (e.target.matches('input, textarea, [contenteditable]')) return;
  e.preventDefault();
  spaceDown = true;
  document.body.classList.add('space-held');
});

document.addEventListener('keyup', e => {
  if (e.code !== 'Space') return;
  spaceDown = false;
  panning   = false;
  document.body.classList.remove('space-held', 'panning');
  if (VIEWPORT_MODEL === 'pan') document.getElementById('pan-indicator').style.display = 'none';
});

canvas.addEventListener('mousedown', e => {
  if (VIEWPORT_MODEL !== 'pan' || !spaceDown) return;
  if (dragging || resizing) return;
  e.preventDefault();
  panning    = true;
  panStartX  = e.clientX;
  panStartY  = e.clientY;
  panOriginX = panX;
  panOriginY = panY;
  document.body.classList.add('panning');
});

// =============================================================================
// RESIZE — widgets
// =============================================================================

let resizing     = null;
let resizeStartX = 0;
let resizeStartY = 0;
let resizeStartW = 0;
let resizeStartH = 0;

function attachResize(el) {
  el.querySelector('.resize-handle').addEventListener('mousedown', e => {
    if (state.layoutMode) return;
    if (EDIT_MODE_MODEL !== 'b' && !state.editMode) return;
    e.preventDefault();
    e.stopPropagation();
    resizing     = el;
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    resizeStartW = el.offsetWidth;
    resizeStartH = el.offsetHeight;
  });
}

document.addEventListener('mousemove', e => {
  if (!resizing) return;
  resizing.style.width  = Math.max(MIN_W, resizeStartW + (e.clientX - resizeStartX)) + 'px';
  resizing.style.height = Math.max(MIN_H, resizeStartH + (e.clientY - resizeStartY)) + 'px';
});

document.addEventListener('mouseup', () => {
  if (!resizing) return;
  const snappedW = Math.max(MIN_W, snap(resizing.offsetWidth));
  const snappedH = Math.max(MIN_H, snap(resizing.offsetHeight));
  resizing.style.width  = snappedW + 'px';
  resizing.style.height = snappedH + 'px';
  const w = state.widgets.find(w => w.id === resizing.dataset.id);
  if (w) { w.w = snappedW; w.h = snappedH; dbSave(w); }
  resizing = null;
});

// =============================================================================
// CHROME DRAG — clock, search, shortcuts
// =============================================================================

function attachChromeDrag(blockEl) {
  blockEl.addEventListener('mousedown', e => {
    if (!state.layoutMode) return;
    if (panning) return;
    if (e.target.closest('input, button, a, select, textarea')) return;
    e.preventDefault();
    startDrag(blockEl, e);
  });
}

// =============================================================================
// INLINE EDITORS — widgets
// =============================================================================

function makeTitleEditable(el, w) {
  const titleEl = el.querySelector('.widget-title');
  if (!titleEl) return;

  const input = document.createElement('input');
  input.className = 'inline-title-input';
  input.value = w.title || '';
  titleEl.replaceWith(input);
  input.focus();
  input.select();

  const commit = () => {
    w.title = input.value.trim() || 'Untitled';
    dbSave(w);
    const newTitle = document.createElement('span');
    newTitle.className   = 'widget-title';
    newTitle.textContent = w.title;
    input.replaceWith(newTitle);
  };

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.value = w.title; input.blur(); }
  });
}

function makeBodyEditable(el, w) {
  const body = el.querySelector('.widget-body');
  if (!body || body.querySelector('.inline-editor')) return;

  const ta = document.createElement('textarea');
  ta.className = 'inline-editor';
  ta.value = w.content || '';
  body.innerHTML = '';
  body.appendChild(ta);
  ta.focus();

  ta.addEventListener('blur', () => {
    w.content = ta.value;
    dbSave(w);
    body.innerHTML = renderBody(w);
    if (w.type === 'task') wireTaskCheckboxes(el, w);
  });
}

// =============================================================================
// WIDGET CRUD
// =============================================================================

function addWidget(type) {
  const color  = PALETTE[state.colorCursor % PALETTE.length];
  state.colorCursor++;

  const def    = DEFAULTS[type] || { w: 240, h: 200 };
  const vis    = visibleWidgets();
  const offset = vis.length * GRID;

  // Center in the currently-visible viewport area (accounts for pan offset)
  const vcx = Math.round(window.innerWidth  / 2);
  const vcy = Math.round((window.innerHeight - parseInt(getComputedStyle(document.documentElement).getPropertyValue('--toolbar-h')) || 52) / 2);
  const cx  = VIEWPORT_MODEL === 'pan' ? vcx - panX : vcx;
  const cy  = VIEWPORT_MODEL === 'pan' ? vcy - panY : 40;

  const w = {
    id:      crypto.randomUUID(),
    type,
    title:   { note: 'New Note', task: 'New Tasks', link: 'New Links' }[type],
    content: '',
    x: snap(cx - def.w / 2 + offset),
    y: snap(cy + offset),
    w: def.w,
    h: def.h,
    color,
  };

  if (VIEWPORT_MODEL === 'pages') w.page = state.currentPage;

  state.widgets.push(w);

  dbSave(w).then(() => {
    const el = createWidgetEl(w);
    syncEmptyState();
    setEditMode(true);
    makeTitleEditable(el, w);
  });
}

// ── Undo toast ────────────────────────────────────────────────────────────
const undoToast    = document.getElementById('undo-toast');
const undoToastMsg = document.getElementById('undo-toast-msg');
const undoToastBtn = document.getElementById('undo-toast-btn');
let undoTimer      = null;
let pendingDelete  = null; // { widget, el }

undoToastBtn.addEventListener('click', () => {
  if (!pendingDelete) return;
  clearTimeout(undoTimer);
  const { widget, el } = pendingDelete;
  state.widgets.push(widget);
  document.getElementById('canvas').appendChild(el);
  syncEmptyState();
  pendingDelete = null;
  undoToast.classList.remove('visible');
});

function showUndoToast(label) {
  undoToastMsg.textContent = `"${label}" deleted`;
  undoToast.classList.add('visible');
  clearTimeout(undoTimer);
  undoTimer = setTimeout(() => {
    undoToast.classList.remove('visible');
    if (pendingDelete) {
      dbDelete(pendingDelete.widget.id);
      pendingDelete = null;
    }
  }, 5000);
}

function deleteWidget(id) {
  const widget = state.widgets.find(w => w.id === id);
  if (!widget) return;
  const el = document.querySelector(`.widget[data-id="${id}"]`);
  state.widgets = state.widgets.filter(w => w.id !== id);
  el?.remove();
  syncEmptyState();
  pendingDelete = { widget, el };
  showUndoToast(widget.title || widget.type);
}

// =============================================================================
// EDIT MODE
// =============================================================================

const btnEdit   = document.getElementById('btn-edit');
const btnLayout = document.getElementById('btn-layout');

function setEditMode(on) {
  if (on && state.layoutMode) {
    // exit layout mode silently
    state.layoutMode = false;
    document.body.classList.remove('layout-mode');
    btnLayout.classList.remove('active');
    btnLayout.textContent = 'layout';
  }
  state.editMode = on;
  document.body.classList.toggle('edit-mode', on);
  btnEdit.classList.toggle('active', on);
  btnEdit.textContent = on ? 'lock' : 'edit';
}

function setLayoutMode(on) {
  if (on && state.editMode) {
    // exit edit mode silently
    state.editMode = false;
    document.body.classList.remove('edit-mode');
    btnEdit.classList.remove('active');
    btnEdit.textContent = 'edit';
  }
  state.layoutMode = on;
  document.body.classList.toggle('layout-mode', on);
  btnLayout.classList.toggle('active', on);
  btnLayout.textContent = on ? 'unlock' : 'layout';
}

btnEdit.addEventListener('click',   () => setEditMode(!state.editMode));
btnLayout.addEventListener('click', () => setLayoutMode(!state.layoutMode));

function syncEmButtons() {
  document.querySelectorAll('.em-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.model === EDIT_MODE_MODEL);
  });
}

function setEditModeModel(model) {
  if (model === EDIT_MODE_MODEL) return;
  EDIT_MODE_MODEL = model;
  localStorage.setItem('editModeModel', model);
  btnEdit.style.display = model === 'b' ? 'none' : '';
  if (model !== 'b') setEditMode(false);
  syncEmButtons();
}

// Apply initial state
btnEdit.style.display = EDIT_MODE_MODEL === 'b' ? 'none' : '';
syncEmButtons();

// =============================================================================
// TOOLBAR: ADD WIDGET DROPDOWN
// =============================================================================

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

// =============================================================================
// APPS PANEL
// =============================================================================

const GOOGLE_APPS = [
  { label: 'Search',    url: 'https://www.google.com'          },
  { label: 'Gmail',     url: 'https://mail.google.com'         },
  { label: 'Drive',     url: 'https://drive.google.com'        },
  { label: 'YouTube',   url: 'https://www.youtube.com'         },
  { label: 'Maps',      url: 'https://maps.google.com'         },
  { label: 'Calendar',  url: 'https://calendar.google.com'     },
  { label: 'Translate', url: 'https://translate.google.com'    },
  { label: 'Photos',    url: 'https://photos.google.com'       },
  { label: 'Meet',      url: 'https://meet.google.com'         },
  { label: 'Docs',      url: 'https://docs.google.com'         },
  { label: 'Sheets',    url: 'https://sheets.google.com'       },
  { label: 'Gemini',    url: 'https://gemini.google.com'       },
];

const btnApps  = document.getElementById('btn-apps');
const appsPanel = document.getElementById('apps-panel');
const appsGrid  = document.getElementById('apps-grid');

// Build the grid once
GOOGLE_APPS.forEach(app => {
  const a = document.createElement('a');
  a.className = 'app-tile';
  a.href = app.url;
  a.target = '_blank';
  a.rel = 'noopener';
  a.innerHTML = `
    <div class="app-icon">
      <img src="${faviconSrc(app.url)}" alt="" onerror="this.style.display='none'">
    </div>
    <span class="app-label">${esc(app.label)}</span>
  `;
  appsGrid.appendChild(a);
});

btnApps.addEventListener('click', e => {
  e.stopPropagation();
  const isOpen = appsPanel.classList.toggle('open');
  btnApps.classList.toggle('panel-open', isOpen);
});

document.addEventListener('click', e => {
  if (!appsPanel.contains(e.target) && e.target !== btnApps) {
    appsPanel.classList.remove('open');
    btnApps.classList.remove('panel-open');
  }
});

appsPanel.addEventListener('click', e => e.stopPropagation());

// =============================================================================
// SETTINGS PANEL
// =============================================================================

const btnSettings   = document.getElementById('btn-settings');
const settingsPanel = document.getElementById('settings-panel');

btnSettings.addEventListener('click', e => {
  e.stopPropagation();
  // close apps panel if open
  appsPanel.classList.remove('open');
  btnApps.classList.remove('panel-open');
  const isOpen = settingsPanel.classList.toggle('open');
  btnSettings.classList.toggle('panel-open', isOpen);
  if (isOpen) { syncVmButtons(); syncEmButtons(); }
});

document.addEventListener('click', e => {
  if (!settingsPanel.contains(e.target) && e.target !== btnSettings) {
    settingsPanel.classList.remove('open');
    btnSettings.classList.remove('panel-open');
  }
});

settingsPanel.addEventListener('click', e => e.stopPropagation());

// =============================================================================
// THEME — manual dark / light toggle (no system preference)
// =============================================================================

(function() {
  const btn      = document.getElementById('btn-theme');
  const iconSun  = document.getElementById('icon-sun');
  const iconMoon = document.getElementById('icon-moon');

  function applyTheme(dark) {
    document.body.classList.toggle('dark', dark);
    iconSun.style.display  = dark ? 'none' : '';
    iconMoon.style.display = dark ? ''     : 'none';
  }

  // Default: dark (#2a2b2e). Restore from localStorage if explicitly set.
  const stored = localStorage.getItem('theme');
  applyTheme(stored !== null ? stored === 'dark' : true);

  btn.addEventListener('click', () => {
    const dark = !document.body.classList.contains('dark');
    applyTheme(dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  });
})();

// =============================================================================
// PROFILE PANEL
// =============================================================================

(function() {
  const avatarBtn    = document.getElementById('avatar');
  const profilePanel = document.getElementById('profile-panel');

  // Load or prompt for name/email from localStorage
  const PROFILE_KEY = 'tabProfileName';
  const EMAIL_KEY   = 'tabProfileEmail';

  function getInitials(name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.trim().slice(0, 2).toUpperCase() || 'U';
  }

  function syncProfile() {
    const name  = localStorage.getItem(PROFILE_KEY) || 'User';
    const email = localStorage.getItem(EMAIL_KEY)   || 'user@gmail.com';
    const init  = getInitials(name);

    avatarBtn.textContent                                       = init[0];
    document.getElementById('pp-avatar-lg').textContent        = init[0];
    document.getElementById('pp-account-avatar').textContent   = init[0];
    document.getElementById('pp-name').textContent             = name;
    document.getElementById('pp-email').textContent            = email;
    document.getElementById('pp-account-name').textContent     = name;
    document.getElementById('pp-account-email').textContent    = email;
  }

  syncProfile();

  avatarBtn.addEventListener('click', e => {
    e.stopPropagation();
    // close other panels
    document.getElementById('apps-panel').classList.remove('open');
    document.getElementById('btn-apps').classList.remove('panel-open');
    document.getElementById('settings-panel').classList.remove('open');
    document.getElementById('btn-settings').classList.remove('panel-open');

    profilePanel.classList.toggle('open');
  });

  document.addEventListener('click', e => {
    if (!profilePanel.contains(e.target) && e.target !== avatarBtn) {
      profilePanel.classList.remove('open');
    }
  });

  profilePanel.addEventListener('click', e => e.stopPropagation());

  // "Add another account" — prompt for new profile
  document.getElementById('pp-add-account').addEventListener('click', () => {
    const name = prompt('Display name:');
    if (!name || !name.trim()) return;
    const email = prompt('Email address:');
    if (!email || !email.trim()) return;
    localStorage.setItem(PROFILE_KEY, name.trim());
    localStorage.setItem(EMAIL_KEY,   email.trim());
    syncProfile();
  });

  // "Sign out" — clear and reset
  document.getElementById('pp-signout').addEventListener('click', () => {
    if (!confirm('Clear your profile info?')) return;
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(EMAIL_KEY);
    syncProfile();
    profilePanel.classList.remove('open');
  });
})();

// =============================================================================
// VIEWPORT + EDIT MODE MODEL BUTTONS
// =============================================================================

document.querySelectorAll('.vm-btn').forEach(btn => {
  btn.addEventListener('click', () => setViewportModel(btn.dataset.mode));
});

document.querySelectorAll('.em-btn').forEach(btn => {
  btn.addEventListener('click', () => setEditModeModel(btn.dataset.model));
});

// =============================================================================
// TOOLBAR TOGGLES
// =============================================================================

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

function initToolbarToggles() {
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

// =============================================================================
// PAGES — switcher UI (pages mode only)
// =============================================================================

function renderPageSwitcher() {
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

// =============================================================================
// VIEWPORT MODEL SETUP / TEARDOWN / SWITCH
// =============================================================================

function setupViewportModel() {
  if (VIEWPORT_MODEL === 'pan') {
    canvasInner.classList.add('pan-surface');
  }
  if (VIEWPORT_MODEL === 'pages') {
    document.getElementById('page-switcher').style.display = 'flex';
    renderPageSwitcher();
  }
  syncVmButtons();
}

function teardownViewportModel() {
  if (VIEWPORT_MODEL === 'pan') {
    canvasInner.classList.remove('pan-surface');
    canvasInner.style.transform = '';
    panX = 0; panY = 0;
    panning = false; spaceDown = false;
    document.body.classList.remove('space-held', 'panning');
    document.getElementById('pan-indicator').style.display = 'none';
  }
  if (VIEWPORT_MODEL === 'pages') {
    document.getElementById('page-switcher').style.display = 'none';
  }
}

function setViewportModel(mode) {
  if (mode === VIEWPORT_MODEL) return;
  teardownViewportModel();
  VIEWPORT_MODEL = mode;
  localStorage.setItem('viewportModel', mode);
  setupViewportModel();
  renderAll();
}

function syncVmButtons() {
  document.querySelectorAll('.vm-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === VIEWPORT_MODEL);
  });
}

// =============================================================================
// INIT
// =============================================================================

async function init() {
  await initDB();

  // Widgets — shared store with dashboard.html
  state.widgets     = await dbLoadAll();
  state.colorCursor = state.widgets.length;

  // Shortcuts — seed defaults on first run
  let shortcuts = await dbLoadShortcuts();
  if (shortcuts.length === 0) {
    await Promise.all(DEFAULT_SHORTCUTS.map(dbSaveShortcut));
    shortcuts = [...DEFAULT_SHORTCUTS];
  }
  state.shortcuts = shortcuts;

  // Render shortcuts into DOM first so we can measure the block width for centering
  renderShortcuts();

  // Layout — compute centered defaults on first run (or if saved positions are degenerate)
  let layout = await dbLoadLayout();
  const layoutDegenerate = layout && layout.clock && layout.clock.x === 0 && layout.clock.y === 0
                        && layout.search && layout.search.x === 0 && layout.search.y === 0;
  if (!layout || layoutDegenerate) {
    // Wait for web fonts to finish loading before measuring element sizes
    await document.fonts.ready;
    await new Promise(r => requestAnimationFrame(r));
    const vw          = window.innerWidth;
    const vh          = window.innerHeight - 52; // canvas height (minus toolbar)
    const clockBlock  = document.getElementById('chrome-clock');
    const searchBlock = document.getElementById('chrome-search');
    const scBlock     = document.getElementById('chrome-shortcuts');
    // Fallback dimensions if fonts haven't rendered yet
    const clockW  = clockBlock.offsetWidth  || Math.round(vw * 0.38);
    const clockH  = clockBlock.offsetHeight || 100;
    const searchW = searchBlock.offsetWidth  || Math.min(580, Math.round(vw * 0.9));
    const searchH = searchBlock.offsetHeight || 50;
    const scW     = scBlock.offsetWidth      || Math.min(600, Math.round(vw * 0.95));
    const scH     = scBlock.offsetHeight     || 80;
    // Stack clock / search / shortcuts centered, with equal breathing room
    const totalH = clockH + searchH + scH + 60;
    const startY = Math.max(60, Math.round((vh - totalH) / 3));
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

  applyLayout(layout);

  // Restore pages state
  if (VIEWPORT_MODEL === 'pages') {
    state.pages       = layout.pages       ?? [0];
    state.currentPage = layout.currentPage ?? 0;
  }

  // Wire chrome drag handles
  ['chrome-clock', 'chrome-search', 'chrome-shortcuts'].forEach(id => {
    attachChromeDrag(document.getElementById(id));
  });

  setupViewportModel();
  initToolbarToggles();
  renderAll();
}

init().catch(err => console.error('[newtab] init failed:', err));
