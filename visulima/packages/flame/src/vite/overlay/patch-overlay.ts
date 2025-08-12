/*
    Replaces Vite's default overlay implementation with a custom overlay class.
    Pattern inspired by Astro: inject our overlay code and rename Vite's class to not conflict.
*/

const getOverlayCode = (): string => {
    const style = `
*{box-sizing:border-box}
:host{position:fixed;inset:0;z-index:2147483647}
#visulima-flame-overlay{overflow:auto}
:host([hidden]){display:none}
`; // host baseline; template CSS handles visuals

    const template = `
<style>${style}</style>
<dialog id="visulima-flame-dialog" role="dialog" aria-modal="true" open>
  <div id="visulima-flame-overlay" part="overlay"></div>
</dialog>`;

    // Inject plain JS (no TS types) so it runs in Vite's client
    return `
// Make HTMLElement available in non-browser environments
var __BaseHTMLElement = (globalThis && globalThis.HTMLElement) || (function(){ return function(){}; })();

// Persistent reopen button (status dot)
function __visulimaGetOrCreateStatusDot(){
  try {
    var id = 'visulima-flame-status-dot';
    var existing = document.getElementById(id);
    if (existing) return existing;
    var btn = document.createElement('button');
    btn.id = id;
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Open error overlay');
    btn.style.cssText = 'position:fixed;left:12px;bottom:12px;width:12px;height:12px;border-radius:9999px;background:#ef4444;border:0;box-shadow:0 0 0 2px rgba(0,0,0,.2);z-index:2147483647;cursor:pointer;opacity:.85;';
    btn.addEventListener('click', function(){
      try { localStorage.removeItem('visulima:flame:dismissed'); } catch {}
      try { (globalThis.__VISULIMA_FLAME_OVERLAY && typeof globalThis.__VISULIMA_FLAME_OVERLAY.open === 'function') && globalThis.__VISULIMA_FLAME_OVERLAY.open(); } catch {}
    });
    btn.hidden = true; // hidden by default until overlay is dismissed
    document.body.appendChild(btn);
    return btn;
  } catch { return null; }
}

function __visulimaTrapFocus(container){
  try {
    var FOCUSABLE = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"])';
    var focusables = Array.prototype.slice.call(container.querySelectorAll(FOCUSABLE));
    if (!focusables.length) return function(){};
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    function handle(e){
      if (e.key !== 'Tab') return;
      if (focusables.length === 1){ e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    }
    container.addEventListener('keydown', handle);
    // Focus first element on open
    setTimeout(function(){ try { first.focus(); } catch {} }, 0);
    return function(){ container.removeEventListener('keydown', handle); };
  } catch { return function(){}; }
}

class ErrorOverlay extends __BaseHTMLElement {
  constructor(err) {
    super();
    this.root = this.attachShadow({ mode: 'open' });
    this.root.innerHTML = ${JSON.stringify(template)};
    this.dir = 'ltr';

    var payload = err && err.err ? err.err : err || {};
    var dialog = this.root.getElementById('visulima-flame-dialog');
    var contentEl = this.root.getElementById('visulima-flame-overlay');

    // Wire reopen signal
    var __onOpen = () => { try { if (dialog && !dialog.open) dialog.showModal(); this.hidden = false; var dot = __visulimaGetOrCreateStatusDot(); if (dot) dot.hidden = true; } catch{} };
    // Expose open() globally for status dot
    try { globalThis.__VISULIMA_FLAME_OVERLAY = { open: __onOpen }; } catch {}


    // Render only the template output if provided
    if (err && (err.flameHtml || err.flameCss) && contentEl) {
      contentEl.innerHTML = '';
      var html = String(err.flameHtml || '');
      var css = String(err.flameCss || '');
      if (css) {
        var styleEl = document.createElement('style');
        styleEl.textContent = css;
        contentEl.appendChild(styleEl);
      }
      if (html) {
        var wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        var container = wrapper.querySelector('#visulima-flame-container') || wrapper.firstElementChild || wrapper;
        contentEl.appendChild(container);
      }
    } else if (contentEl) {
      // Fallback UI when template HTML/CSS is not provided
      var theme = 'dark';
      try { theme = localStorage.getItem('visulima:flame:theme') || 'dark'; } catch {}

      var styleEl2 = document.createElement('style');
      styleEl2.textContent = '
        :host{font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial}
        #vf-root{position:fixed; inset:0; display:flex; flex-direction:column;}
        [data-theme="dark"]{--bg:#0b0b0d;--muted:#a1a1aa;--text:#e5e7eb;--danger:#ef4444;--panel:#111114;--border:#27272a}
        [data-theme="light"]{--bg:#ffffff;--muted:#52525b;--text:#0b0b0d;--danger:#b91c1c;--panel:#fafafa;--border:#e4e4e7}
        #vf-root{background:var(--bg); color:var(--text)}
        .vf-header{ position:sticky; top:0; z-index:1; display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid var(--border); background:var(--panel)}
        .vf-title{ display:flex; flex-direction:column; gap:2px }
        .vf-name{ font-weight:600; font-size:14px }
        .vf-msg{ color:var(--muted); font-size:12px }
        .vf-meta{ color:var(--muted); font-size:11px }
        .vf-actions{ display:flex; align-items:center; gap:8px }
        .vf-btn{ font-size:12px; padding:6px 10px; border-radius:6px; border:1px solid var(--border); background:transparent; color:var(--text); cursor:pointer }
        .vf-btn:hover{ border-color:var(--text) }
        .vf-content{ padding:12px 16px; display:grid; grid-template-columns: 1fr; gap:12px }
        .vf-card{ border:1px solid var(--border); border-radius:8px; overflow:hidden; background:var(--panel) }
        .vf-card h3{ margin:0; padding:8px 12px; font-size:12px; border-bottom:1px solid var(--border); color:var(--muted) }
        pre{ margin:0; padding:12px; font-size:12px; line-height:1.5; overflow:auto }
      ';
      contentEl.appendChild(styleEl2);

      var root = document.createElement('div');
      root.id = 'vf-root';
      root.setAttribute('data-theme', theme);

      var header = document.createElement('div');
      header.className = 'vf-header';
      var title = document.createElement('div');
      title.className = 'vf-title';
      var name = document.createElement('div'); name.className='vf-name'; name.textContent = String((payload && payload.name) || 'Error');
      var msg = document.createElement('div'); msg.className='vf-msg'; msg.textContent = String((payload && payload.message) || 'Runtime error');
      var meta = document.createElement('div'); meta.className='vf-meta'; meta.textContent = (payload && payload.id ? String(payload.id) : '') + (payload && payload.loc ? ':'+payload.loc.line+':'+payload.loc.column : '');
      title.appendChild(name); title.appendChild(msg); title.appendChild(meta);

      var actions = document.createElement('div'); actions.className='vf-actions';
      var btnCopy = document.createElement('button'); btnCopy.className='vf-btn'; btnCopy.textContent='Copy stack'; btnCopy.onclick = function(){ try { navigator.clipboard.writeText(String(payload && payload.stack || '')); } catch {} };
      var btnCopyFrame = document.createElement('button'); btnCopyFrame.className='vf-btn'; btnCopyFrame.textContent='Copy codeframe'; btnCopyFrame.onclick = function(){ try { navigator.clipboard.writeText(String(payload && payload.frame || '')); } catch {} };
      var btnTheme = document.createElement('button'); btnTheme.className='vf-btn'; btnTheme.textContent='Theme'; btnTheme.onclick = function(){ try { var next = (root.getAttribute('data-theme')==='dark'?'light':'dark'); root.setAttribute('data-theme', next); localStorage.setItem('visulima:flame:theme', next); } catch {} };
      var btnDismiss = document.createElement('button'); btnDismiss.className='vf-btn'; btnDismiss.textContent='Dismiss'; btnDismiss.onclick = () => this.close();
      actions.appendChild(btnCopy); actions.appendChild(btnCopyFrame); actions.appendChild(btnTheme); actions.appendChild(btnDismiss);

      header.appendChild(title); header.appendChild(actions);

      var content = document.createElement('div'); content.className='vf-content';

      if (payload && payload.frame){
        var card1 = document.createElement('div'); card1.className='vf-card';
        var h31 = document.createElement('h3'); h31.textContent='Codeframe'; card1.appendChild(h31);
        var pre1 = document.createElement('pre'); pre1.textContent = String(payload.frame||''); card1.appendChild(pre1);
        content.appendChild(card1);
      }
      if (payload && payload.stack){
        var card2 = document.createElement('div'); card2.className='vf-card';
        var h32 = document.createElement('h3'); h32.textContent='Stack trace'; card2.appendChild(h32);
        var pre2 = document.createElement('pre'); pre2.textContent = String(payload.stack||''); card2.appendChild(pre2);
        content.appendChild(card2);
      }

      root.appendChild(header);
      root.appendChild(content);
      contentEl.appendChild(root);
    }

    // Focus trap within dialog
    var removeTrap = __visulimaTrapFocus(dialog);

    // Close with ESC
    var onKey = (e) => { try { if (e.key === 'Escape') { e.stopPropagation(); this.close(); } } catch {} };
    this.addEventListener('keydown', onKey);

    // Dismiss persistence
    try {
      var dismissed = localStorage.getItem('visulima:flame:dismissed') === '1';
      if (dismissed) { this.close(/*silent*/true); }
    } catch {}

    // Expose a basic resize to ensure dialog is fullscreen
    try { dialog.style.cssText = 'position:fixed;inset:0;border:0;padding:0;background:transparent;'; } catch {}

    // Cleanups on detach
    this.__cleanup = function(){ try { removeTrap && removeTrap(); document.removeEventListener('visulima:flame:open', __onOpen); } catch {} };
  }
  close(silent){
    try {
      // Persist dismissed state unless silent
      if (!silent) { try { localStorage.setItem('visulima:flame:dismissed','1'); } catch {} }
      // Remove self from DOM
      this.parentNode && this.parentNode.removeChild(this);
    } catch {}
    try {
      // Show status dot for reopen
      var dot = __visulimaGetOrCreateStatusDot();
      if (dot) dot.hidden = false;
    } catch {}
  }
  disconnectedCallback(){ try { this.__cleanup && this.__cleanup(); } catch {} }
}
`;
};

export const patchOverlay = (code: string): string => {
    const injected = getOverlayCode();
    return code.replace("class ErrorOverlay", `${injected}\nclass ViteErrorOverlay`);
};

export default patchOverlay;