import { syncVmButtons } from './viewport.js';
import { syncEmButtons } from './settings.js';
import { faviconSrc, esc } from './utils.js';

const GOOGLE_APPS = [
  { label: 'Search',    url: 'https://www.google.com'       },
  { label: 'Gmail',     url: 'https://mail.google.com'      },
  { label: 'Drive',     url: 'https://drive.google.com'     },
  { label: 'YouTube',   url: 'https://www.youtube.com'      },
  { label: 'Maps',      url: 'https://maps.google.com'      },
  { label: 'Calendar',  url: 'https://calendar.google.com'  },
  { label: 'Translate', url: 'https://translate.google.com' },
  { label: 'Photos',    url: 'https://photos.google.com'    },
  { label: 'Meet',      url: 'https://meet.google.com'      },
  { label: 'Docs',      url: 'https://docs.google.com'      },
  { label: 'Sheets',    url: 'https://sheets.google.com'    },
  { label: 'Gemini',    url: 'https://gemini.google.com'    },
];

export function initAppsPanel() {
  const btnApps   = document.getElementById('btn-apps');
  const appsPanel = document.getElementById('apps-panel');
  const appsGrid  = document.getElementById('apps-grid');

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
}

export function initSettingsPanel() {
  const btnApps       = document.getElementById('btn-apps');
  const appsPanel     = document.getElementById('apps-panel');
  const btnSettings   = document.getElementById('btn-settings');
  const settingsPanel = document.getElementById('settings-panel');

  btnSettings.addEventListener('click', e => {
    e.stopPropagation();
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
}

export function initProfilePanel() {
  const avatarBtn    = document.getElementById('avatar');
  const profilePanel = document.getElementById('profile-panel');
  const PROFILE_KEY  = 'tabProfileName';
  const EMAIL_KEY    = 'tabProfileEmail';

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

  document.getElementById('pp-manage').addEventListener('click', () => {
    window.open('https://myaccount.google.com', '_blank', 'noopener,noreferrer');
  });

  document.getElementById('pp-add-account').addEventListener('click', () => {
    window.open('https://accounts.google.com/AddSession', '_blank', 'noopener,noreferrer');
  });

  document.getElementById('pp-signout').addEventListener('click', () => {
    if (!confirm('Clear your profile info?')) return;
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(EMAIL_KEY);
    syncProfile();
    profilePanel.classList.remove('open');
  });
}
