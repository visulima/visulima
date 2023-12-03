const layout = ({
    title,
    description,
    content,
    css,
    script,
    error,
}: {
    title: string;
    description: string;
    css: string;
    script: string;
    content: string;
    error: Error,
}): string => `<!--
${error?.stack ? error.stack?.replace(/\n/g, "\n\t") : error.toString()}
-->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${description}">
    <style>${css}</style>
    <script>${script}</script>
    <script>
      (function() {
        window.addEventListener('load', () => {
          const $clipboards = document.querySelectorAll('.js-clipboard');
          $clipboards.forEach((el) => {
            const isToggleTooltip = HSStaticMethods.getClassProperty(el, '--is-toggle-tooltip') === 'false' ? false : true;
            const clipboard = new ClipboardJS(el, {
              text: (trigger) => {
                const clipboardText = trigger.dataset.clipboardText;

                if (clipboardText) return clipboardText;

                const clipboardTarget = trigger.dataset.clipboardTarget;
                const $element = document.querySelector(clipboardTarget);

                if (
                  $element.tagName === 'SELECT'
                  || $element.tagName === 'INPUT'
                  || $element.tagName === 'TEXTAREA'
                ) return $element.value
                else return $element.textContent;
              }
            });
            clipboard.on('success', () => {
              const $default = el.querySelector('.js-clipboard-default');
              const $success = el.querySelector('.js-clipboard-success');
              const $successText = el.querySelector('.js-clipboard-success-text');
              const successText = el.dataset.clipboardSuccessText || '';
              const tooltip = el.closest('.hs-tooltip');
              const $tooltip = HSTooltip.getInstance(tooltip, true);
              let oldSuccessText;

              if ($successText) {
                oldSuccessText = $successText.textContent
                $successText.textContent = successText
              }
              if ($default && $success) {
                $default.style.display = 'none'
                $success.style.display = 'block'
              }
              if (tooltip && isToggleTooltip) HSTooltip.show(tooltip);
              if (tooltip && !isToggleTooltip) $tooltip.element.popperInstance.update();

              setTimeout(function () {
                if ($successText && oldSuccessText) $successText.textContent = oldSuccessText;
                if (tooltip && isToggleTooltip) HSTooltip.hide(tooltip);
                if (tooltip && !isToggleTooltip) $tooltip.element.popperInstance.update();
                if ($default && $success) {
                  $success.style.display = '';
                  $default.style.display = '';
                }
              }, 800);
            });
          });
        })
      })()
    </script>
</head>
<body class="bg-gray-100">
    <div class="container mx-auto">
        <div class="flex flex-wrap">
            ${content}
        </div>
    </div>
</body>
</html>
<!--
${error?.stack ? error.stack?.replace(/\n/g, "\n\t") : error.toString()}
-->
`;

export default layout;
