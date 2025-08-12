import { getTooltipScript } from "./components/tooltip";

const layout = ({
    content,
    css,
    description,
    error,
    scripts,
    title,
}: {
    content: string;
    css: string;
    description: string;
    error: Error;
    scripts: string[];
    title: string;
}): string => `<!--
${error.stack ? error.stack.replaceAll("\n", "\n\t") : error.toString()}
-->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${description}">
    <style>${css}</style>
    <script>
        function afterTransition (el, callback) {
            const handleEvent = () => {
                callback();

                el.removeEventListener("transitionend", handleEvent, true);
            };

            if (window.getComputedStyle(el, null).getPropertyValue("transition") !== "all 0s ease 0s") {
                el.addEventListener("transitionend", handleEvent, true);
            } else {
                callback();
            }
        }

        // Ensures listeners run as soon as the DOM is interactive
        function subscribeToDOMContentLoaded(listener) {
            if (document.readyState !== 'loading') {
                try { listener(); } catch (_) {}
                return;
            }
            try { document.addEventListener('DOMContentLoaded', listener); } catch (_) {}
        }

        // Focus trap utility (basic)
        function getFocusableElements(container) {
          var selectors = [
            'a[href]', 'button:not([disabled])', 'textarea:not([disabled])', 'input:not([disabled])', 'select:not([disabled])', '[tabindex]:not([tabindex="-1"])'
          ];
          try { return Array.prototype.slice.call(container.querySelectorAll(selectors.join(','))).filter(function(el){ return el.offsetParent !== null; }); } catch (_) { return []; }
        }

        function trapFocusWithin(container) {
          function onKeyDown(e){
            if (!e || e.key !== 'Tab') return;
            var focusable = getFocusableElements(container);
            if (!focusable.length) return;
            var first = focusable[0];
            var last = focusable[focusable.length - 1];
            var active = document.activeElement;
            if (e.shiftKey) {
              if (active === first || !container.contains(active)) { e.preventDefault(); try { last.focus(); } catch(_) {} }
            } else {
              if (active === last || !container.contains(active)) { e.preventDefault(); try { first.focus(); } catch(_) {} }
            }
          }
          try { container.addEventListener('keydown', onKeyDown); } catch (_) {}
          return function cleanup(){ try { container.removeEventListener('keydown', onKeyDown); } catch (_) {} };
        }
    </script>
    <script>${getTooltipScript()}</script>
    ${scripts.map((script) => `<script>${script}</script>`).join("\n")}
    <script>
      (function() {
        subscribeToDOMContentLoaded(() => {
          // Focus trap around main container
          var container = document.getElementById('visulima-flame-container');
          var cleanupTrap = null;
          if (container) {
            try {
              cleanupTrap = trapFocusWithin(container);
              // Ensure something focusable inside receives focus
              var first = getFocusableElements(container)[0];
              if (first && typeof first.focus === 'function') first.focus();
              else container.setAttribute('tabindex','-1'), container.focus();
              container.setAttribute('role','dialog');
              container.setAttribute('aria-modal','true');
              container.setAttribute('aria-label','Error inspector');
            } catch (_) {}
          }

          // Keyboard Shortcuts help dialog
          var help = document.createElement('div');
          help.id = 'flame-shortcuts-dialog';
          help.setAttribute('role','dialog');
          help.setAttribute('aria-modal','true');
          help.setAttribute('aria-label','Keyboard shortcuts');
          help.className = 'fixed inset-0 hidden items-center justify-center z-50';
          help.innerHTML = '<div class="absolute inset-0 bg-black/50" data-shortcuts-close></div>\
<div class="relative bg-white dark:bg-slate-900 rounded-lg shadow-xl w-[min(560px,95vw)] max-h-[80vh] overflow-auto p-6">\
  <div class="flex items-center justify-between mb-4">\
    <h2 class="text-lg font-semibold">Keyboard shortcuts</h2>\
    <button type="button" aria-label="Close shortcuts" class="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800" data-shortcuts-close>Esc</button>\
  </div>\
  <div class="text-sm space-y-2">\
    <p>Press the following keys to navigate:</p>\
    <ul class="list-disc ps-5 space-y-1">\
      <li><code>Tab</code> / <code>Shift+Tab</code> to move focus</li>\
      <li><code>Enter</code> / <code>Space</code> to activate selected controls</li>\
      <li><code>?</code> (Shift+/) to open this help</li>\
      <li><code>Esc</code> to close dialogs or help</li>\
    </ul>\
  </div>\
</div>';
          try { document.body.appendChild(help); } catch (_) {}

          var openHelp = function(){
            try {
              help.classList.remove('hidden');
              help.classList.add('flex');
              if (container) container.setAttribute('aria-hidden','true');
              var focusable = getFocusableElements(help);
              if (focusable[0]) focusable[0].focus();
              trapFocusWithin(help);
            } catch (_) {}
          };
          var closeHelp = function(){
            try {
              help.classList.add('hidden');
              help.classList.remove('flex');
              if (container) { container.removeAttribute('aria-hidden'); container.focus(); }
            } catch (_) {}
          };

          try {
            document.addEventListener('keydown', function(e){
              if (!e) return;
              if ((e.key === '?' || (e.key === '/' && e.shiftKey)) && !help.classList.contains('flex')) { e.preventDefault(); openHelp(); }
              else if (e.key === 'Escape' && help.classList.contains('flex')) { e.preventDefault(); closeHelp(); }
            });
            help.addEventListener('click', function(e){ var t = e.target; if (t && t instanceof Element && t.hasAttribute('data-shortcuts-close')) closeHelp(); });
            // Delegate click handler for any element requesting shortcuts open
            document.addEventListener('click', function(e){
              var t = e.target;
              if (!t) return;
              var trigger = (t.closest && t.closest('[data-shortcuts-open]'));
              if (trigger) { e.preventDefault(); openHelp(); }
            });
            // Keyboard trigger on focused element with data-shortcuts-open
            document.addEventListener('keydown', function(e){
              if (!e || (e.key !== 'Enter' && e.key !== ' ')) return;
              var active = document.activeElement;
              if (active && active instanceof Element && active.hasAttribute('data-shortcuts-open')) { e.preventDefault(); openHelp(); }
            });
          } catch (_) {}

          const $clipboards = document.querySelectorAll('.js-clipboard');

          $clipboards.forEach((el) => {
            function getClipboardText(trigger) {
              var clipboardText = trigger && trigger.dataset ? trigger.dataset.clipboardText : null;
              if (clipboardText) return clipboardText;
              var target = trigger && trigger.dataset ? trigger.dataset.clipboardTarget : null;
              var $element = target ? document.querySelector(target) : null;
              if (!$element) return '';
              var tag = $element.tagName;
              if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return $element.value;
              return $element.textContent;
            }

            function showCopySuccess() {
              var $default = el.querySelector('.js-clipboard-default');
              var $success = el.querySelector('.js-clipboard-success');
              var $successText = el.querySelector('.js-clipboard-success-text');
              var successText = el.dataset.clipboardSuccessText || '';
              var oldSuccessText;
              if ($successText) {
                oldSuccessText = $successText.textContent;
                $successText.textContent = successText;
              }
              if ($default) { try { $default.classList.add('hidden'); } catch (_) {} }
              if ($success) { try { $success.classList.remove('hidden'); } catch (_) {} }
              setTimeout(function () {
                if ($successText && oldSuccessText) $successText.textContent = oldSuccessText;
                if ($success) { try { $success.classList.add('hidden'); } catch (_) {} }
                if ($default) { try { $default.classList.remove('hidden'); } catch (_) {} }
              }, 800);
            }

          // Use the modern Clipboard API
          el.addEventListener('click', function (e) {
            e.preventDefault();
            try {
              var text = getClipboardText(el);
              if (!text || !navigator || !navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') return;
              navigator.clipboard.writeText(text).then(function(){ showCopySuccess(); }).catch(function(){});
            } catch (_) {}
          });
          });
        })
      })()
    </script>
</head>
<body>
    <div id="visulima-flame-container" class="w-full h-full overflow-auto bg-gray-100 dark:bg-slate-900 dark:text-gray-200">
        <div class="container mx-auto mt-6">
            ${content}
        </div>
    </div>
</body>
</html>
<!--
${error.stack ? error.stack.replaceAll("\n", "\n\t") : error.toString()}
-->
`;

export default layout;
