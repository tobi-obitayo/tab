// v1 → widgets  (dashboard.html)
// v2 → + shortcuts
// v3 → + layout  (layout store exists but is unused in this version)

let db;

export function initDB() {
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

export function dbSave(widget) {
  return new Promise((res, rej) => {
    const tx = db.transaction('widgets', 'readwrite');
    tx.objectStore('widgets').put(widget).onsuccess = res;
    tx.onerror = rej;
  });
}

export function dbDelete(id) {
  return new Promise((res, rej) => {
    const tx = db.transaction('widgets', 'readwrite');
    tx.objectStore('widgets').delete(id).onsuccess = res;
    tx.onerror = rej;
  });
}

export function dbLoadAll() {
  return new Promise((res, rej) => {
    const tx  = db.transaction('widgets', 'readonly');
    const req = tx.objectStore('widgets').getAll();
    req.onsuccess = () => res(req.result);
    req.onerror   = rej;
  });
}

export function dbSaveShortcut(sc) {
  return new Promise((res, rej) => {
    const tx = db.transaction('shortcuts', 'readwrite');
    tx.objectStore('shortcuts').put(sc).onsuccess = res;
    tx.onerror = rej;
  });
}

export function dbDeleteShortcut(id) {
  return new Promise((res, rej) => {
    const tx = db.transaction('shortcuts', 'readwrite');
    tx.objectStore('shortcuts').delete(id).onsuccess = res;
    tx.onerror = rej;
  });
}

export function dbLoadShortcuts() {
  return new Promise((res, rej) => {
    const tx  = db.transaction('shortcuts', 'readonly');
    const req = tx.objectStore('shortcuts').getAll();
    req.onsuccess = () => res(req.result);
    req.onerror   = rej;
  });
}

export function dbSaveLayout(layout) {
  return new Promise((res, rej) => {
    const tx = db.transaction('layout', 'readwrite');
    tx.objectStore('layout').put(layout).onsuccess = res;
    tx.onerror = rej;
  });
}

export function dbLoadLayout() {
  return new Promise((res, rej) => {
    const tx  = db.transaction('layout', 'readonly');
    const req = tx.objectStore('layout').get('layout');
    req.onsuccess = () => res(req.result ?? null);
    req.onerror   = rej;
  });
}
