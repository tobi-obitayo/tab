const clockEl = document.getElementById('clock');

export function updateClock() {
  const hour12 = localStorage.getItem('clockFormat') !== '24';
  clockEl.textContent = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12,
  });
}

export function initClock() {
  updateClock();
  setInterval(updateClock, 1000);
}
