// Basic client runtime for the Flame overlay injected into Vite's client
var __BaseHTMLElement = (globalThis && globalThis.HTMLElement) || (function(){ return function(){}; })();
function __now(){ try { return Date.now(); } catch(_) { return new Date().getTime(); } }
function __makeId(){ return String(__now()) + '-' + Math.random().toString(36).slice(2,8); }
var __state = (globalThis.__visulimaFlameState = globalThis.__visulimaFlameState || { errors: [], selectedIndex: 0, maxHistory: 10, minimized: false });

function __normalizePayload__(input){
  var p = (input && input.err) ? input.err : (input || {});
  var name = String(p.name || 'Error');
  var message = String(p.message || 'Runtime error');
  var html = String(p.flameHtml || '');
  var css = String(p.flameCss || '');
  var stack = String(p.stack || '');
  return { id: __makeId(), name: name, message: message, html: html, css: css, stack: stack, raw: p };
}

function __pushError__(payload){
  try {
    var key = (payload.name + '|' + payload.message + '|' + payload.stack).slice(0, 2000);
    var last = __state.errors[__state.errors.length - 1];
    if (last && (last.name + '|' + last.message + '|' + last.stack).slice(0,2000) === key) {
      __state.errors[__state.errors.length - 1] = payload;
    } else {
      __state.errors.push(payload);
      if (__state.errors.length > __state.maxHistory) __state.errors.shift();
    }
    __state.selectedIndex = __state.errors.length - 1;
  } catch(_) {}
}

function __renderList__(root){
  var list = root.getElementById('__flame__list');
  var count = root.getElementById('__flame__count');
  var heading = root.getElementById('__flame__heading');
  if (!list || !count || !heading) return;
  try { count.textContent = String(__state.errors.length) + ' issue' + (__state.errors.length === 1 ? '' : 's'); } catch(_) {}
  list.querySelectorAll('.item').forEach(function(n){ n.remove(); });
  __state.errors.forEach(function(e, i){
    var el = document.createElement('div');
    el.className = 'item' + (i === __state.selectedIndex ? ' active' : '');
    var title = (e.name ? (e.name + ': ') : '') + (e.message || 'Runtime error');
    el.innerHTML = '<div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + title + '</div>' +
                   '<div class="meta">' + (e.raw && e.raw.id ? e.raw.id : '') + '</div>';
    el.addEventListener('click', function(){ __state.selectedIndex = i; __render(root); });
    list.appendChild(el);
  });
  var active = __state.errors[__state.selectedIndex];
  try { heading.textContent = active ? (active.name || 'Error') : 'Runtime Error'; } catch(_) {}
}

function __renderContent__(root){
  var contentMount = root.getElementById('visulima-flame-overlay');
  if (!contentMount) return;
  var active = __state.errors[__state.selectedIndex];
  contentMount.innerHTML = '';
  if (!active) return;
  if (active.css) {
    var styleEl = document.createElement('style');
    styleEl.textContent = active.css;
    contentMount.appendChild(styleEl);
  }
  var html = String(active.html || '');
  if (html) {
    var wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    var container = wrapper.querySelector('#visulima-flame-container');
    contentMount.appendChild(container || wrapper);
  } else {
    // Minimal fallback when no template is available
    var fallback = document.createElement('div');
    var title = (active.name ? (active.name + ': ') : '') + (active.message || 'Runtime error');
    fallback.style.padding = '1rem';
    fallback.innerHTML = '<div style="font-weight:600;margin-bottom:.5rem">' + title + '</div>' +
                         '<pre style="white-space:pre-wrap;overflow:auto">' + (active.stack || '') + '</pre>';
    contentMount.appendChild(fallback);
  }
}

function __bindHeader__(root, host){
  var closeBtn = root.getElementById('__flame__close');
  var minimizeBtn = root.getElementById('__flame__minimize');
  if (closeBtn) closeBtn.addEventListener('click', function(){ try { host.close(); } catch(_) {} });
  if (minimizeBtn) minimizeBtn.addEventListener('click', function(){
    try {
      __state.minimized = !__state.minimized;
      var panel = root.getElementById('__flame__panel');
      if (panel) panel.style.inset = __state.minimized ? 'auto 1rem 1rem auto' : '1.25rem';
      var body = root.getElementById('__flame__body');
      if (body) body.style.display = __state.minimized ? 'none' : 'flex';
    } catch(_) {}
  });
}

function __render(root){
  __renderList__(root);
  __renderContent__(root);
}

class ErrorOverlay extends __BaseHTMLElement {
  constructor(err) {
    super();
    this.root = this.attachShadow({ mode: 'open' });
    /*__INJECT_TEMPLATE__*/
    var payload = __normalizePayload__(err);
    __pushError__(payload);
    __bindHeader__(this.root, this);
    __render(this.root);
  }
  close(){ this.parentNode && this.parentNode.removeChild(this); }
}


