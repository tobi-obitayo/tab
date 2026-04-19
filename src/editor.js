import { dbSave } from './db.js';
// Circular import — safe because renderBody/wireTaskCheckboxes are only called at runtime (in blur handlers)
import { renderBody, wireTaskCheckboxes } from './render.js';

export function makeTitleEditable(el, w) {
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

export function makeBodyEditable(el, w) {
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
