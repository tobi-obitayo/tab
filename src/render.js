import { state, config } from './state.js';
import { PALETTE } from './constants.js';
import { esc, hostname } from './utils.js';
import { dbSave } from './db.js';
import { attachDrag, attachResize } from './drag.js';
// Circular imports — safe because cross-calls only happen in event handlers (runtime, not load time)
import { bringToFront, deleteWidget } from './widgets.js';
import { makeTitleEditable, makeBodyEditable } from './editor.js';
import { setEditMode } from './settings.js';

const canvasInner = document.getElementById('canvas-inner');
const emptyEl     = document.getElementById('empty');

export function visibleWidgets() {
  if (config.viewportModel === 'pages')
    return state.widgets.filter(w => (w.page ?? 0) === state.currentPage);
  return state.widgets;
}

export function renderAll() {
  canvasInner.querySelectorAll('.widget').forEach(el => el.remove());
  visibleWidgets().forEach(createWidgetEl);
  syncEmptyState();
}

export function syncEmptyState() {
  emptyEl.style.display = visibleWidgets().length === 0 ? 'block' : 'none';
}

// ── Content parsers ───────────────────────────────────────────────────────

function parseTasks(raw = '') {
  return raw.split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => ({
      done: /^\[x\]/i.test(l),
      text: l.replace(/^\[[ xX]\]\s*/, ''),
    }));
}

export function serializeTasks(tasks) {
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

// ── Widget body renderer ──────────────────────────────────────────────────

export function renderBody(w) {
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

export function wireTaskCheckboxes(widgetEl, widget) {
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

// ── Widget DOM creation ───────────────────────────────────────────────────

export function createWidgetEl(w) {
  const el = document.createElement('div');
  el.className = 'widget';
  el.dataset.id   = w.id;
  el.dataset.type = w.type;
  el.style.cssText = `left:${w.x}px; top:${w.y}px; width:${w.w}px; height:${w.h}px; z-index:${w.z || 0};`;
  el.style.setProperty('--wc', w.color);

  const swatches = PALETTE.map(c =>
    `<span class="color-swatch${w.color === c ? ' active' : ''}" data-color="${c}" style="background:${c}"></span>`
  ).join('');

  el.innerHTML = `
    <div class="widget-header">
      <span class="drag-handle" title="Drag to move">⠿</span>
      <span class="widget-title">${esc(w.title || 'Untitled')}</span>
      <div class="widget-actions">
        <button class="act-btn color" title="Color">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 2a10 10 0 0 1 0 20"/>
            <path d="M2 12h20"/>
          </svg>
          <div class="color-popup">${swatches}</div>
        </button>
        <button class="act-btn front" title="Bring to front">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="5" y="5" width="9" height="9" rx="1.5"/>
            <path d="M2 11V3a1.5 1.5 0 0 1 1.5-1.5H11" opacity="0.45"/>
          </svg>
        </button>
        <button class="act-btn edit" title="Edit">✎</button>
        <button class="act-btn del"  title="Delete">✕</button>
      </div>
    </div>
    <div class="widget-body">${renderBody(w)}</div>
    <div class="resize-handle"></div>
  `;

  el.querySelector('.act-btn.color').addEventListener('click', e => {
    e.stopPropagation();
    const popup = el.querySelector('.color-popup');
    const isOpen = popup.classList.contains('open');
    document.querySelectorAll('.color-popup.open').forEach(p => p.classList.remove('open'));
    if (!isOpen) popup.classList.add('open');
  });

  el.querySelector('.color-popup').addEventListener('click', e => {
    const swatch = e.target.closest('.color-swatch');
    if (!swatch) return;
    e.stopPropagation();
    const color = swatch.dataset.color;
    w.color = color;
    el.style.setProperty('--wc', color);
    el.querySelectorAll('.color-swatch').forEach(s => s.classList.toggle('active', s.dataset.color === color));
    el.querySelector('.color-popup').classList.remove('open');
    dbSave(w);
  });

  el.querySelector('.act-btn.front').addEventListener('click', e => {
    e.stopPropagation();
    bringToFront(w.id);
  });

  el.querySelector('.act-btn.edit').addEventListener('click', e => {
    e.stopPropagation();
    if (config.editModeModel === 'b' || state.editMode) makeBodyEditable(el, w);
  });

  el.querySelector('.act-btn.del').addEventListener('click', e => {
    e.stopPropagation();
    deleteWidget(w.id);
  });

  el.addEventListener('mousedown', () => bringToFront(w.id));

  el.addEventListener('click', e => {
    if (state.layoutMode) return;

    if (config.editModeModel === 'b') {
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

    if (config.editModeModel === 'c' && !state.editMode) setEditMode(true);

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
    if (config.editModeModel === 'a' && !state.editMode) setEditMode(true);
  });

  if (w.type === 'task') wireTaskCheckboxes(el, w);

  attachDrag(el);
  attachResize(el);

  canvasInner.appendChild(el);
  return el;
}

export function patchWidgetEl(w) {
  const el = document.querySelector(`.widget[data-id="${w.id}"]`);
  if (!el) return;
  el.querySelector('.widget-title').textContent = w.title || 'Untitled';
  const body = el.querySelector('.widget-body');
  body.innerHTML = renderBody(w);
  if (w.type === 'task') wireTaskCheckboxes(el, w);
}
