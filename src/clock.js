const clockEl = document.getElementById('clock');

function updateClock() {
  clockEl.textContent = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

export function initClock() {
  updateClock();
  setInterval(updateClock, 1000);
}
