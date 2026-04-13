# Tab Dashboard

A personal dashboard that replaces Chrome's new tab page. Built with vanilla JS and IndexedDB — no frameworks, no backend, nothing leaves your browser.

> v0.1 — in active development. I use this as my daily driver and fix things as I find them.

---

## Features

- **Widgets** — draggable, resizable note, task list, and link cards that snap to a grid
- **Persistent layout** — everything saved locally in IndexedDB, survives browser restarts
- **Shortcuts bar** — favicon shortcuts with right-click edit/remove, just like Chrome's default new tab
- **Dark mode** — toggle in the toolbar
- **Layout modes** — Clamp (default), Pan (infinite canvas), Pages
- **Edit modes** — three interaction models for moving/resizing widgets (Mode First, Direct Manipulation, Hybrid)
- **Markdown support** — note widgets render markdown

## Install

1. Go to `chrome://extensions`
2. Enable **Developer mode** (toggle, top-right)
3. Click **Load unpacked**
4. Select this folder
5. Open a new tab

## Tech

- Vanilla JS — no framework, keeps new tab load time near-instant
- IndexedDB for persistence (no `chrome.storage` quota limits)
- Manifest V3
- `marked.js` for markdown rendering

## Status

Working daily driver. Known rough edges being tracked and fixed. Not yet submitted to the Chrome Web Store.
