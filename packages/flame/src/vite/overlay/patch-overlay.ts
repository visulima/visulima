/*
    Replaces Vite's default overlay implementation with a custom overlay class.
    Pattern inspired by Astro: inject our overlay code and rename Vite's class to not conflict.
*/

const getOverlayCode = (): string => {
    const style = `
*{box-sizing:border-box}
:host{position:fixed;inset:0;z-index:2147483647}
#backdrop{position:fixed;inset:0;background:#0b0b0c;color:#eaeaea;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;overflow:auto}
#layout{max-width:min(100%,1200px);margin:24px auto;padding:0 16px;display:grid;gap:16px}
#header{display:flex;align-items:center;gap:12px}
.badge{padding:4px 8px;border-radius:999px;background:#e00;color:#fff;font-weight:700;font-size:12px;letter-spacing:.02em}
#title{font-size:18px;margin:0;color:#fff;font-weight:700}
.spacer{flex:1}
.actions{display:flex;gap:8px}
.btn{border:1px solid #333;background:transparent;color:#eaeaea;padding:6px 10px;border-radius:6px;cursor:pointer}
.card{background:#151515;border:1px solid #333;border-radius:10px;overflow:hidden}
.card header{display:flex;align-items:center;justify-content:space-between;padding:12px;border-bottom:1px solid #333}
.card h2{margin:0;font-size:14px;color:#eaeaea}
.code{background:#0f0f10;white-space:pre;overflow:auto;max-height:50vh;padding:12px}
.muted{color:#9b9b9b}
.path{font-size:12px}
.link{color:#9ecbff;text-decoration:none}
.link:hover{text-decoration:underline}
`;

    const template = `
<style>${style}</style>
<div id="backdrop">
  <div id="layout">
    <header id="header">
      <div class="badge">ERROR</div>
      <h1 id="title">An error occurred.</h1>
      <div class="spacer"></div>
      <div class="actions">
        <button id="reload" class="btn">Reload</button>
        <button id="close" class="btn">Close (Esc)</button>
      </div>
    </header>
    <section class="card" id="message-card">
      <header><h2>Message</h2></header>
      <div class="code" id="message-content"></div>
    </section>
    <section class="card" id="code" style="display:none">
      <header>
        <h2 class="path" id="code-path"></h2>
        <a id="open-editor" class="link" href="#" target="_blank" rel="noreferrer">Open in editor</a>
      </header>
      <div class="code" id="code-content"></div>
    </section>
    <section class="card" id="stack">
      <header><h2>Stack Trace</h2></header>
      <div class="code" id="stack-content"></div>
    </section>
  </div>
</div>`;

    // Inject plain JS (no TS types) so it runs in Vite's client
    return `
// Make HTMLElement available in non-browser environments
var __BaseHTMLElement = (globalThis && globalThis.HTMLElement) || (function(){ return function(){}; })();
class ErrorOverlay extends __BaseHTMLElement {
  constructor(err) {
    super();
    this.root = this.attachShadow({ mode: "open" });
    this.root.innerHTML = ${JSON.stringify(template)};
    this.dir = "ltr";
    var payload = err && err.err ? err.err : err || {};
    var msg = String((payload && payload.message) || "Unknown error");
    var stack = String((payload && payload.stack) || "");
    var id = String((payload && (payload.id || payload.file)) || "");
    var frame = String((payload && payload.frame) || "");
    var messageEl = this.root.querySelector("#message-content");
    var stackEl = this.root.querySelector("#stack-content");
    if (messageEl) messageEl.textContent = msg;
    if (stackEl) stackEl.textContent = stack;

    // Code frame section (if available)
    var codeCard = this.root.querySelector("#code");
    if (frame && codeCard) {
      codeCard.style.display = "block";
      var codeContent = this.root.querySelector("#code-content");
      var codePath = this.root.querySelector("#code-path");
      var openEditor = this.root.querySelector("#open-editor");
      if (codeContent) codeContent.textContent = frame;
      if (codePath) codePath.textContent = id || "Code Frame";
      if (openEditor && id) {
        var firstLine = (frame.split(/\\r?\\n/)[0] || "");
        var locMatch = /:(\\d+):(\\d+)/.exec(firstLine);
        var openHref = "/__open-in-editor?file=" + encodeURIComponent(locMatch ? (id + ":" + locMatch[1] + ":" + (locMatch[2] || 1)) : id);
        openEditor.setAttribute("href", openHref);
      }
    }

    var reload = this.root.querySelector("#reload");
    var close = this.root.querySelector("#close");
    if (reload) reload.onclick = function(){ location.reload(); };
    if (close) close.onclick = () => this.close();
    window.addEventListener("keydown", (e) => { if (e.key === "Escape") this.close(); }, { once: true });
  }
  close() { this.parentNode && this.parentNode.removeChild(this); }
}
`;
};

export const patchOverlay = (code: string): string => {
    const injected = getOverlayCode();
    return code.replace("class ErrorOverlay", `${injected}\nclass ViteErrorOverlay`);
};

export default patchOverlay;


