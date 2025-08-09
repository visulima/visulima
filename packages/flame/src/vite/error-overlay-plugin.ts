import type { IndexHtmlTransformResult, Plugin } from "vite";

export type ViteOverlayOptions = {
    theme?: "dark" | "light";
};

const VIRTUAL_ID = "virtual:flame-error-overlay";
const RESOLVED_VIRTUAL_ID = "\0" + VIRTUAL_ID;

export default function viteErrorOverlay(options: ViteOverlayOptions = {}): Plugin {
    return {
        name: "flame-error-overlay",
        apply: "serve",
        enforce: "pre",
        config(userConfig) {
            return {
                server: { hmr: { overlay: false } },
                ...userConfig,
            };
        },
        resolveId(id) {
            if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID;
        },
        load(id) {
            if (id !== RESOLVED_VIRTUAL_ID) return;

            const theme = options.theme ?? "dark";

            const code = `
const THEME_DEFAULT = ${JSON.stringify(theme)};
let __flame_overlay_silent__ = false;
let __flame_last__ = null; // { message, stack, kept, ignored, isHydration }

const HYDRATION_PATTERNS = [
  /Hydration failed/i,
  /hydrating this/i,
  /Text content did not match/i,
  /Expected server HTML/i,
  /There was an error while hydrating/i,
  /An error occurred during hydration/i
];

const THEME_KEY = 'flame:overlay:theme';
function getTheme() {
  try { return localStorage.getItem(THEME_KEY) || THEME_DEFAULT; } catch { return THEME_DEFAULT; }
}
function setTheme(t) {
  try { localStorage.setItem(THEME_KEY, t); } catch {}
  applyTheme(t);
}
function applyTheme(t) {
  const root = document.documentElement;
  root.setAttribute('data-flame-theme', String(t));
}

function timestamp() {
  try { return new Date().toLocaleTimeString(); } catch { return ''; }
}

function createStyles() {
  const style = document.createElement('style');
  style.setAttribute('data-flame-overlay', '');
  style.textContent = \`\`\`
:root {
  --fl-bg: ${theme === "dark" ? "#0b0b0c" : "#ffffff"};
  --fl-fg: ${theme === "dark" ? "#eaeaea" : "#111111"};
  --fl-muted: ${theme === "dark" ? "#9b9b9b" : "#666"};
  --fl-accent: #e00;
  --fl-surface: ${theme === "dark" ? "#151515" : "#f5f5f5"};
  --fl-border: ${theme === "dark" ? "#333" : "#e5e5e5"};
  --fl-code-bg: ${theme === "dark" ? "#0f0f10" : "#fff"};
}
[data-flame-theme="light"] {
  --fl-bg: #ffffff;
  --fl-fg: #111111;
  --fl-muted: #666666;
  --fl-surface: #f5f5f5;
  --fl-border: #e5e5e5;
  --fl-code-bg: #ffffff;
}
@keyframes fl-fade-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes fl-slide-up { from { transform: translateY(8px); opacity: .9 } to { transform: translateY(0); opacity: 1 } }
.fl-overlay__root { position: fixed; inset: 0; z-index: 2147483647; background: rgba(0,0,0,0.5); display: none; animation: fl-fade-in .15s ease-out; }
.fl-overlay__panel { position: absolute; inset: 0; background: var(--fl-bg); color: var(--fl-fg); overflow: auto; animation: fl-slide-up .2s ease-out; }
.fl-overlay__header { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--fl-border); background: var(--fl-surface); }
.fl-overlay__badge { padding: 3px 8px; border-radius: 6px; background: var(--fl-accent); color: white; font-weight: 600; font-size: 12px; letter-spacing: .02em; }
.fl-overlay__badge--muted { background: #555; }
.fl-overlay__title { font-size: 14px; font-weight: 600; }
.fl-overlay__subtitle { font-size: 12px; color: var(--fl-muted); }
.fl-overlay__content { padding: 16px; display: grid; gap: 16px; }
.fl-overlay__message { font-size: 14px; line-height: 1.5; white-space: pre-wrap; }
.fl-overlay__frame { background: var(--fl-code-bg); border: 1px solid var(--fl-border); border-radius: 8px; overflow: hidden; }
.fl-overlay__frame-header { padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--fl-border); }
.fl-overlay__frame-path { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 12px; }
.fl-overlay__actions { display: flex; gap: 8px; }
.fl-overlay__button { appearance: none; border: 1px solid var(--fl-border); background: transparent; color: var(--fl-fg); font-size: 12px; padding: 6px 10px; border-radius: 6px; cursor: pointer; }
.fl-overlay__code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 12px; line-height: 1.4; overflow-x: auto; display: block; padding: 12px 14px; white-space: pre; }
.fl-overlay__hint { color: var(--fl-muted); font-size: 12px; }
\`\`\`;
  return style;
}

function ensureRoot() {
  let root = document.querySelector('.fl-overlay__root');
  if (!root) {
    root = document.createElement('div');
    root.className = 'fl-overlay__root';
    document.documentElement.appendChild(root);
    document.head.appendChild(createStyles());
  }
  return root;
}

function showOverlay(data) {
  const root = ensureRoot();
  root.innerHTML = '';

  const panel = document.createElement('div');
  panel.className = 'fl-overlay__panel';

  const header = document.createElement('div');
  header.className = 'fl-overlay__header';

  const badge = document.createElement('div');
  badge.className = 'fl-overlay__badge';
  badge.textContent = 'ERROR';

  const isHydration = isHydrationErrorPayload(data);
  const hydrationBadge = document.createElement('div');
  if (isHydration) {
    hydrationBadge.className = 'fl-overlay__badge fl-overlay__badge--muted';
    hydrationBadge.textContent = 'HYDRATION';
  }

  const title = document.createElement('div');
  title.className = 'fl-overlay__title';
  title.textContent = normalizeMessageTitle(data);

  const subtitle = document.createElement('div');
  subtitle.className = 'fl-overlay__subtitle';
  subtitle.textContent = timestamp();

  header.appendChild(badge);
  if (isHydration) header.appendChild(hydrationBadge);
  header.appendChild(title);
  header.appendChild(subtitle);

  const content = document.createElement('div');
  content.className = 'fl-overlay__content';

  const message = document.createElement('div');
  message.className = 'fl-overlay__message';
  message.textContent = normalizeMessageBody(data);
  content.appendChild(message);

  const frameText = data.frame || (data.err && data.err.frame) || '';
  const file = (data.id || (data.err && data.err.id) || '');
  const loc = extractLoc(frameText);

  // Stack section
  const { kept, ignored } = splitStack(((data.err && data.err.stack) || data.stack || ''));
  __flame_last__ = {
    message: (data.err && data.err.message) || data.message || 'Unknown error',
    stack: ((data.err && data.err.stack) || data.stack || ''),
    kept, ignored, isHydration
  };

  if (frameText) {
    const frame = document.createElement('div');
    frame.className = 'fl-overlay__frame';

    const frameHeader = document.createElement('div');
    frameHeader.className = 'fl-overlay__frame-header';

    const framePath = document.createElement('div');
    framePath.className = 'fl-overlay__frame-path';
    framePath.textContent = file || 'Code Frame';

    const actions = document.createElement('div');
    actions.className = 'fl-overlay__actions';

    const openBtn = document.createElement('button');
    openBtn.className = 'fl-overlay__button';
    openBtn.textContent = 'Open in editor';
    openBtn.onclick = () => openInEditor(file, loc);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'fl-overlay__button';
    copyBtn.textContent = 'Copy stack';
    copyBtn.onclick = () => copyStack();

    const toggleIgnoredBtn = document.createElement('button');
    toggleIgnoredBtn.className = 'fl-overlay__button';
    toggleIgnoredBtn.textContent = 'Show ignored frames';

    const themeBtn = document.createElement('button');
    themeBtn.className = 'fl-overlay__button';
    themeBtn.textContent = 'Toggle theme';
    themeBtn.onclick = () => {
      const current = getTheme();
      setTheme(current === 'dark' ? 'light' : 'dark');
    };

    actions.appendChild(openBtn);
    actions.appendChild(copyBtn);
    actions.appendChild(toggleIgnoredBtn);
    actions.appendChild(themeBtn);

    frameHeader.appendChild(framePath);
    frameHeader.appendChild(actions);

    const code = document.createElement('pre');
    code.className = 'fl-overlay__code';
    code.textContent = frameText;

    const stackPre = document.createElement('pre');
    stackPre.className = 'fl-overlay__code';
    stackPre.textContent = kept.join('\n');

    const ignoredPre = document.createElement('pre');
    ignoredPre.className = 'fl-overlay__code';
    ignoredPre.style.display = 'none';
    ignoredPre.textContent = ignored.join('\n');

    toggleIgnoredBtn.onclick = () => {
      const visible = ignoredPre.style.display !== 'none';
      ignoredPre.style.display = visible ? 'none' : 'block';
      toggleIgnoredBtn.textContent = visible ? 'Show ignored frames' : 'Hide ignored frames';
    };

    frame.appendChild(frameHeader);
    frame.appendChild(code);
    frame.appendChild(stackPre);
    frame.appendChild(ignoredPre);
    content.appendChild(frame);
  }

  const hint = document.createElement('div');
  hint.className = 'fl-overlay__hint';
  hint.textContent = 'Press Esc to dismiss. Hydration issues are detected. You can copy the stack and toggle ignored frames.';
  content.appendChild(hint);

  panel.appendChild(header);
  panel.appendChild(content);
  root.appendChild(panel);
  root.style.display = 'block';

  window.addEventListener('keydown', escListener);
  applyTheme(getTheme());
}

function hideOverlay() {
  const root = document.querySelector('.fl-overlay__root');
  if (root) {
    root.style.display = 'none';
    root.innerHTML = '';
  }
  window.removeEventListener('keydown', escListener);
}

function escListener(e) { if (e.key === 'Escape') hideOverlay(); }

function normalizeMessageTitle(data) {
  const plugin = data.plugin || (data.err && data.err.plugin);
  const message = (data.err && data.err.message) || data.message || 'Unknown error';
  return plugin ? (message.split('\n')[0] + ' · ' + plugin) : message.split('\n')[0];
}

function normalizeMessageBody(data) {
  const m = (data.err && data.err.message) || data.message || '';
  const s = filterStack(((data.err && data.err.stack) || data.stack || ''));
  return [m, s].filter(Boolean).join('\n\n');
}

function isHydrationErrorPayload(data) {
  const m = (data.err && data.err.message) || data.message || '';
  const s = (data.err && data.err.stack) || data.stack || '';
  const joined = [m, s].join('\n');
  return HYDRATION_PATTERNS.some((re) => re.test(joined));
}

function filterStack(stack) {
  if (!stack) return '';
  const lines = String(stack).split('\n');
  const ignored = /node_modules|vite\/dist|react-dom\/|\(internal\)|__vite|next-dev-overlay/;
  const kept = lines.filter(l => !ignored.test(l));
  return kept.slice(0, 12).join('\n');
}

function splitStack(stack) {
  const lines = String(stack || '').split('\n');
  const re = /node_modules|vite\/dist|react-dom\/|\(internal\)|__vite|next-dev-overlay/;
  const kept = [];
  const ignored = [];
  for (const l of lines) (re.test(l) ? ignored : kept).push(l);
  return { kept, ignored };
}

function extractLoc(frame) {
  const m = /:(\\d+):(\\d+)/.exec(frame.split('\n')[0] || '');
  return m ? { line: Number(m[1]), column: Number(m[2]) } : undefined;
}

function openInEditor(file, loc) {
  if (!file) return;
  const q = new URLSearchParams({ file: loc ? `${file}:${loc.line}:${loc.column || 1}` : file });
  fetch('/__open-in-editor?' + q.toString());
}

async function copyStack() {
  try {
    const s = __flame_last__ ? `${__flame_last__.message}\n\n${__flame_last__.stack}` : '';
    await navigator.clipboard.writeText(s);
  } catch {}
}

function setup() {
  if (import.meta.hot) {
    import.meta.hot.on('vite:beforeUpdate', hideOverlay);
    import.meta.hot.on('vite:error', (data) => { showOverlay(data); });
  }
  // runtime errors
  window.addEventListener('error', (e) => { if (!__flame_overlay_silent__) showOverlay({ message: e.message, stack: e.error && e.error.stack }); });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason instanceof Error ? e.reason : new Error(String(e.reason));
    if (!__flame_overlay_silent__) showOverlay({ message: reason.message, stack: reason.stack });
  });
  // react hydration detection via console.error
  const origConsoleError = console.error;
  console.error = function(...args) {
    try {
      const joined = args.map(String).join(' ');
      if (HYDRATION_PATTERNS.some((re) => re.test(joined))) {
        const err = new Error(joined);
        if (!__flame_overlay_silent__) showOverlay({ message: err.message, stack: err.stack });
      }
    } catch {}
    return origConsoleError.apply(console, args);
  }
  // reportError integration
  const origReportError = window.reportError;
  try {
    window.reportError = function(err) {
      try {
        const e = err instanceof Error ? err : new Error(String(err));
        if (!__flame_overlay_silent__) showOverlay({ message: e.message, stack: e.stack });
      } catch {}
      if (typeof origReportError === 'function') return origReportError.apply(window, arguments);
    }
  } catch {}
}

export default function init() { setup(); }
`;
            return code;
        },
        transformIndexHtml(html): IndexHtmlTransformResult {
            const scriptTag = {
                tag: "script",
                attrs: { type: "module" },
                children: `import init from '${VIRTUAL_ID}'; init();`,
                injectTo: "head",
            } as const;
            return { html, tags: [scriptTag] };
        },
    };
}