export const GRID  = 20;
export const MIN_W = 160;
export const MIN_H = 100;

export const PALETTE = ['var(--c0)','var(--c1)','var(--c2)','var(--c3)','var(--c4)','var(--c5)','var(--c6)','var(--c7)'];

export const DEFAULTS = {
  note:      { w: 280, h: 220 },
  task:      { w: 240, h: 200 },
  link:      { w: 260, h: 180 },
  stopwatch: { w: 220, h: 180 },
  weather:   { w: 280, h: 180 },
};

export const ICON_OVERRIDES = {
  'docs.google.com':     'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico',
  'sheets.google.com':   'https://ssl.gstatic.com/docs/spreadsheets/favicon3.ico',
  'slides.google.com':   'https://ssl.gstatic.com/docs/presentations/images/favicon5.ico',
  'forms.google.com':    'https://ssl.gstatic.com/docs/forms/images/favicon2.ico',
  'drive.google.com':    'https://ssl.gstatic.com/docs/doclist/images/favicon2.ico',
  'calendar.google.com': 'https://calendar.google.com/googlecalendar/images/favicon_v2014_2.ico',
  'mail.google.com':     'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico',
  'meet.google.com':     'https://meet.google.com/favicon.ico',
  'gemini.google.com':   'https://www.gstatic.com/lamda/images/gemini_favicon_f069958c85030456e93de685481c559f160ea06.svg',
};

export const DEFAULT_SHORTCUTS = [
  { id: 0, label: 'Google',   url: 'https://www.google.com'      },
  { id: 1, label: 'Gmail',    url: 'https://mail.google.com'     },
  { id: 2, label: 'YouTube',  url: 'https://www.youtube.com'     },
  { id: 3, label: 'GitHub',   url: 'https://github.com'          },
  { id: 4, label: 'Maps',     url: 'https://maps.google.com'     },
  { id: 5, label: 'ChatGPT',  url: 'https://chat.openai.com'     },
];
