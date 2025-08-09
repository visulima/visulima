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
import { diffWords } from 'diff';
import { parseStacktrace } from '@visulima/error';
const THEME_DEFAULT = ${JSON.stringify(theme)};
let __flame_overlay_silent__ = false;
let __flame_last__ = null; // { message, stack, kept, ignored, isHydration }
let __flame_overlay_host__ = null; // HTMLElement
let __flame_overlay_shadow__ = null; // ShadowRoot
const INITIAL_HTML = (() => { try { return document.body ? document.body.innerHTML : ''; } catch { return ''; } })();
const PREF_KEY = 'flame:overlay:prefs';
function getPrefs() { try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch { return {}; } }
function setPrefs(p) { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch {} }
let __fl_prefs__ = Object.assign({ theme: THEME_DEFAULT, showIgnored: false, showHydrationDiff: true, ownerGrouping: true }, getPrefs());

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
  try { return localStorage.getItem(THEME_KEY) || (__fl_prefs__.theme || THEME_DEFAULT); } catch { return THEME_DEFAULT; }
}
function setTheme(t) {
  try { localStorage.setItem(THEME_KEY, t); } catch {}
  __fl_prefs__.theme = t; setPrefs(__fl_prefs__);
  applyTheme(t);
}
function applyTheme(t) {
  if (__flame_overlay_host__) __flame_overlay_host__.setAttribute('data-flame-theme', String(t));
}

function timestamp() {
  try { return new Date().toLocaleTimeString(); } catch { return ''; }
}

function createStyles() {
  const style = document.createElement('style');
  style.setAttribute('data-flame-overlay', '');
  style.textContent = \`\`\`
:host {
  --fl-bg: ${theme === "dark" ? "#0b0b0c" : "#ffffff"};
  --fl-fg: ${theme === "dark" ? "#eaeaea" : "#111111"};
  --fl-muted: ${theme === "dark" ? "#9b9b9b" : "#666"};
  --fl-accent: #e00;
  --fl-surface: ${theme === "dark" ? "#151515" : "#f5f5f5"};
  --fl-border: ${theme === "dark" ? "#333" : "#e5e5e5"};
  --fl-code-bg: ${theme === "dark" ? "#0f0f10" : "#fff"};
}
:host([data-flame-theme="light"]) {
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
.fl-diff { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; line-height: 1.4; white-space: pre-wrap; background: var(--fl-code-bg); border: 1px solid var(--fl-border); border-radius: 8px; padding: 12px 14px; }
.fl-diff-add { background: rgba(16,185,129,0.2); }
.fl-diff-rem { background: rgba(239,68,68,0.25); text-decoration: line-through; }
.fl-popover { position: absolute; top: 44px; right: 16px; background: var(--fl-surface); border: 1px solid var(--fl-border); border-radius: 8px; padding: 10px 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); min-width: 240px; }
.fl-popover h4 { margin: 0 0 8px; font-size: 12px; color: var(--fl-muted); }
.fl-popover .row { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; gap: 12px; }
.fl-popover label { font-size: 12px; color: var(--fl-fg); }
.fl-popover input[type="checkbox"] { width: 14px; height: 14px; }
.fl-stack { padding: 10px 12px; border-top: 1px solid var(--fl-border); background: var(--fl-code-bg); }
.fl-stack-item { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; line-height: 1.4; color: var(--fl-fg); }
.fl-stack-item--owner { font-weight: 700; color: var(--fl-accent); }
\`\`\`;
  return style;
}

function ensureRoot() {
  let root = null;
  if (!__flame_overlay_host__) {
    __flame_overlay_host__ = document.getElementById('fl-overlay-host');
    if (!__flame_overlay_host__) {
      __flame_overlay_host__ = document.createElement('div');
      __flame_overlay_host__.id = 'fl-overlay-host';
      document.documentElement.appendChild(__flame_overlay_host__);
    }
    __flame_overlay_shadow__ = __flame_overlay_host__.attachShadow({ mode: 'open' });
    __flame_overlay_shadow__.appendChild(createStyles());
  }
  root = __flame_overlay_shadow__.querySelector('.fl-overlay__root');
  if (!root) {
    root = document.createElement('div');
    root.className = 'fl-overlay__root';
    __flame_overlay_shadow__.appendChild(root);
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
  const { kept, ignored } = framesFrom(((data.err && data.err.message) || data.message || ''), ((data.err && data.err.stack) || data.stack || ''));
  __flame_last__ = {
    message: (data.err && data.err.message) || data.message || 'Unknown error',
    stack: [((data.err && data.err.message) || data.message || ''), kept.join('\n'), ignored.join('\n')].filter(Boolean).join('\n'),
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
    toggleIgnoredBtn.textContent = __fl_prefs__.showIgnored ? 'Hide ignored frames' : 'Show ignored frames';

    const themeBtn = document.createElement('button');
    themeBtn.className = 'fl-overlay__button';
    themeBtn.textContent = 'Toggle theme';
    themeBtn.onclick = () => {
      const current = getTheme();
      setTheme(current === 'dark' ? 'light' : 'dark');
    };

    const reloadBtn = document.createElement('button');
    reloadBtn.className = 'fl-overlay__button';
    reloadBtn.textContent = 'Reload';
    reloadBtn.onclick = () => location.reload();

    const prefsBtn = document.createElement('button');
    prefsBtn.className = 'fl-overlay__button';
    prefsBtn.textContent = 'Preferences';

    actions.appendChild(openBtn);
    actions.appendChild(copyBtn);
    actions.appendChild(toggleIgnoredBtn);
    actions.appendChild(themeBtn);
    actions.appendChild(reloadBtn);
    actions.appendChild(prefsBtn);

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
    ignoredPre.style.display = __fl_prefs__.showIgnored ? 'block' : 'none';
    ignoredPre.textContent = ignored.join('\n');

    toggleIgnoredBtn.onclick = () => {
      const visible = ignoredPre.style.display !== 'none';
      ignoredPre.style.display = visible ? 'none' : 'block';
      toggleIgnoredBtn.textContent = visible ? 'Show ignored frames' : 'Hide ignored frames';
      __fl_prefs__.showIgnored = !visible; setPrefs(__fl_prefs__);
    };

    // Preferences popover
    let popover;
    prefsBtn.onclick = () => {
      if (popover && popover.isConnected) { popover.remove(); return; }
      popover = document.createElement('div');
      popover.className = 'fl-popover';
      popover.innerHTML = '';
      const title = document.createElement('h4'); title.textContent = 'Preferences'; popover.appendChild(title);
      // showIgnored
      const row1 = document.createElement('div'); row1.className = 'row';
      const lbl1 = document.createElement('label'); lbl1.textContent = 'Show ignored frames by default';
      const cb1 = document.createElement('input'); cb1.type = 'checkbox'; cb1.checked = !!__fl_prefs__.showIgnored;
      cb1.onchange = () => { __fl_prefs__.showIgnored = cb1.checked; setPrefs(__fl_prefs__); ignoredPre.style.display = cb1.checked ? 'block' : 'none'; toggleIgnoredBtn.textContent = cb1.checked ? 'Hide ignored frames' : 'Show ignored frames'; };
      row1.appendChild(lbl1); row1.appendChild(cb1); popover.appendChild(row1);
      // ownerGrouping
      const row2 = document.createElement('div'); row2.className = 'row';
      const lbl2 = document.createElement('label'); lbl2.textContent = 'Owner stack grouping';
      const cb2 = document.createElement('input'); cb2.type = 'checkbox'; cb2.checked = !!__fl_prefs__.ownerGrouping;
      cb2.onchange = () => { __fl_prefs__.ownerGrouping = cb2.checked; setPrefs(__fl_prefs__); renderCallStack(); };
      row2.appendChild(lbl2); row2.appendChild(cb2); popover.appendChild(row2);
      // hydration diff
      const row3 = document.createElement('div'); row3.className = 'row';
      const lbl3 = document.createElement('label'); lbl3.textContent = 'Show hydration diff';
      const cb3 = document.createElement('input'); cb3.type = 'checkbox'; cb3.checked = !!__fl_prefs__.showHydrationDiff;
      cb3.onchange = () => { __fl_prefs__.showHydrationDiff = cb3.checked; setPrefs(__fl_prefs__); diffContainer && (diffContainer.style.display = (isHydration && cb3.checked) ? 'block' : 'none'); };
      row3.appendChild(lbl3); row3.appendChild(cb3); popover.appendChild(row3);
      frameHeader.appendChild(popover);
    };

    frame.appendChild(frameHeader);
    frame.appendChild(code);
    frame.appendChild(stackPre);
    frame.appendChild(ignoredPre);

    // Call stack (owner grouping)
    const stackContainer = document.createElement('div');
    stackContainer.className = 'fl-stack';
    function renderCallStack() {
      stackContainer.innerHTML = '';
      const detail = parseFramesDetailed(((data.err && data.err.message) || data.message || ''), ((data.err && data.err.stack) || data.stack || ''));
      detail.traces.forEach((t, idx) => {
        const line = document.createElement('div');
        line.className = 'fl-stack-item' + (detail.ownerIndex === idx && __fl_prefs__.ownerGrouping ? ' fl-stack-item--owner' : '');
        const method = t.methodName ? String(t.methodName) : '<anonymous>';
        const locText = [t.file || '', t.line != null ? t.line : '', t.column != null ? t.column : ''].filter(Boolean).join(':');
        line.textContent = method + ' — ' + locText;
        stackContainer.appendChild(line);
      });
    }
    renderCallStack();
    frame.appendChild(stackContainer);
    content.appendChild(frame);
  }

  if (isHydration) {
    const nowHTML = (() => { try { return document.body ? document.body.innerHTML : ''; } catch { return ''; } })();
    const diff = diffWords(INITIAL_HTML, nowHTML);
    const diffEl = document.createElement('div');
    diffEl.className = 'fl-diff';
    for (const part of diff) {
      const span = document.createElement('span');
      if (part.added) { span.className = 'fl-diff-add'; }
      if (part.removed) { span.className = 'fl-diff-rem'; }
      span.textContent = part.value;
      diffEl.appendChild(span);
    }
    var diffContainer = diffEl;
    diffContainer.style.display = __fl_prefs__.showHydrationDiff ? 'block' : 'none';
    content.appendChild(diffContainer);
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
  const { kept } = framesFrom(m, ((data.err && data.err.stack) || data.stack || ''));
  const s = kept.join('\n');
  return [m, s].filter(Boolean).join('\n\n');
}

function isHydrationErrorPayload(data) {
  const m = (data.err && data.err.message) || data.message || '';
  const s = (data.err && data.err.stack) || data.stack || '';
  const joined = [m, s].join('\n');
  return HYDRATION_PATTERNS.some((re) => re.test(joined));
}

function framesFrom(message, stack) {
  try {
    const err = new Error(message || '');
    if (stack) { try { err.stack = stack; } catch {} }
    const traces = parseStacktrace(err);
    const reIgnore = /node_modules|vite\/dist|react(-dom)?\//;
    const kept = [];
    const ignored = [];
    for (const t of traces) {
      const parts = [];
      if (t.methodName) {
        const isComponent = /^[A-Z]/.test(String(t.methodName));
        parts.push(isComponent ? String(t.methodName) + ' [component]' : String(t.methodName));
      }
      if (t.file) parts.push(String(t.file));
      if (t.line != null) parts.push(String(t.line));
      if (t.column != null) parts.push(String(t.column));
      const line = parts.join(' : ');
      (reIgnore.test(String(t.file || '')) ? ignored : kept).push(line);
    }
    return { kept, ignored };
  } catch {
    const lines = String(stack || '').split('\n');
    const re = /node_modules|vite\/dist|react-dom\/|\(internal\)|__vite|next-dev-overlay/;
    const kept = [];
    const ignored = [];
    for (const l of lines) (re.test(l) ? ignored : kept).push(l);
    return { kept, ignored };
  }
}

function parseFramesDetailed(message, stack) {
  try {
    const err = new Error(message || '');
    if (stack) { try { err.stack = stack; } catch {} }
    const traces = parseStacktrace(err);
    const reIgnore = /node_modules|vite\/dist|react(-dom)?\//;
    let ownerIndex = -1;
    traces.forEach((t, idx) => {
      if (ownerIndex === -1 && t.methodName && /^[A-Z]/.test(String(t.methodName)) && !reIgnore.test(String(t.file || ''))) {
        ownerIndex = idx;
      }
    });
    return { traces, ownerIndex };
  } catch { return { traces: [], ownerIndex: -1 }; }
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