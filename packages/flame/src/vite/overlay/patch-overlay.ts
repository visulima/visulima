/*
    Replaces Vite's default overlay implementation with a custom overlay class.
    Pattern inspired by Astro: inject our overlay code and rename Vite's class to not conflict.
*/

const getOverlayCode = (): string => {
    const style = `
*{box-sizing:border-box}
:host{position:fixed;inset:0;z-index:2147483647}
#visulima-flame-overlay{overflow: auto;}
`;

    const template = `
<style>${style}</style>
<div id="visulima-flame-overlay"></div>`;

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
    var contentEl = this.root.querySelector('#visulima-flame-overlay');
    if (err && (err.flameHtml || err.flameCss) && contentEl) {
      // Render only the template output
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
        var container = wrapper.querySelector('#visulima-flame-container');
        contentEl.appendChild(container || wrapper);
      }
    }
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
