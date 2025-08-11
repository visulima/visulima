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
    </script>
    <script>${getTooltipScript()}</script>
    ${scripts.map((script) => `<script>${script}</script>`).join("\n")}
    <script>
      (function() {
        subscribeToDOMContentLoaded(() => {
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
        <div class="container mx-auto">
            <div class="flex flex-wrap gap-6 mt-6">
                ${content}
            </div>
        </div>
    </div>
</body>
</html>
<!--
${error.stack ? error.stack.replaceAll("\n", "\n\t") : error.toString()}
-->
`;

export default layout;
