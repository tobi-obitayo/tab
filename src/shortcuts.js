import { state } from './state.js';
import { dbSaveShortcut, dbDeleteShortcut } from './db.js';
import { esc, faviconSrc } from './utils.js';

const shortcutsEl = document.getElementById('shortcuts');

export function renderShortcuts() {
  shortcutsEl.innerHTML = '';
  const sorted = [...state.shortcuts].sort((a, b) => a.id - b.id);
  sorted.forEach(sc => shortcutsEl.appendChild(buildShortcutEl(sc)));
  shortcutsEl.appendChild(buildAddTile());
}

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

  div.addEventListener('contextmenu', e => {
    e.preventDefault();
    showCtxMenu(sc, e.clientX, e.clientY);
  });

  return div;
}

function patchShortcutEl(sc) {
  const old = shortcutsEl.querySelector(`.shortcut[data-id="${sc.id}"]`);
  if (old) old.replaceWith(buildShortcutEl(sc));
}

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

// ── Inline edit ───────────────────────────────────────────────────────────

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

function removeShortcut(id) {
  state.shortcuts = state.shortcuts.filter(sc => sc.id !== id);
  dbDeleteShortcut(id).then(() => renderShortcuts());
}

// ── Context menu ──────────────────────────────────────────────────────────

const ctxMenu   = document.getElementById('ctx-menu');
let   ctxTarget = null;

function showCtxMenu(sc, x, y) {
  ctxTarget = sc;
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

document.addEventListener('click', () => {
  ctxMenu.classList.remove('open');
  ctxTarget = null;
});

ctxMenu.addEventListener('click', e => e.stopPropagation());

// ── Add shortcut popover ──────────────────────────────────────────────────

const addPopover = document.getElementById('add-popover');
const popName    = document.getElementById('pop-name');
const popUrl     = document.getElementById('pop-url');

function openAddPopover(anchorEl) {
  const rect = anchorEl.getBoundingClientRect();
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

function confirmAddShortcut() {
  const label = popName.value.trim();
  let   url   = popUrl.value.trim();
  if (!label || !url) {
    if (!label) popName.focus();
    else         popUrl.focus();
    return;
  }
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  const sc = { id: Date.now(), label, url };
  state.shortcuts.push(sc);
  dbSaveShortcut(sc).then(() => renderShortcuts());
  closeAddPopover();
}

document.getElementById('pop-confirm').addEventListener('click', confirmAddShortcut);
document.getElementById('pop-cancel').addEventListener('click', closeAddPopover);

[popName, popUrl].forEach(inp => {
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); confirmAddShortcut(); }
    if (e.key === 'Escape') { closeAddPopover(); }
  });
});

document.addEventListener('click', e => {
  if (!addPopover.contains(e.target) && e.target.id !== 'shortcut-add-tile') {
    closeAddPopover();
  }
});
addPopover.addEventListener('click', e => e.stopPropagation());
