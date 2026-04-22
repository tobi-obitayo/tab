// Mutable config — persisted to localStorage
export const config = {
  viewportModel: localStorage.getItem('viewportModel') || 'clamp',
  editModeModel: localStorage.getItem('editModeModel') || 'c',
};

export const state = {
  widgets:     [],
  shortcuts:   [],
  editMode:    false,
  layoutMode:  false,
  colorCursor: 0,
  currentPage: 0,
  pages:       [0],
};

// Pan mode state — grouped into an object so any module can mutate it freely
export const pan = {
  x: 0, y: 0,
  active:   false,
  startX:   0, startY:   0,
  originX:  0, originY:  0,
  spaceDown: false,
};

export let layoutState = null;
export function setLayoutState(v) { layoutState = v; }

export function applyLayout(layout) {
  setLayoutState(layout);
  const map = {
    clock:     document.getElementById('chrome-clock'),
    search:    document.getElementById('chrome-search'),
    shortcuts: document.getElementById('chrome-shortcuts'),
  };
  for (const [key, el] of Object.entries(map)) {
    const pos = layout[key];
    if (pos) { el.style.left = pos.x + 'px'; el.style.top = pos.y + 'px'; el.style.visibility = 'visible'; }
  }
}
