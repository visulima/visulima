// eslint-disable-next-line import/no-extraneous-dependencies
import infoIcon from "lucide-static/icons/info.svg?raw";

export const getTooltipScript = (): string => `
(window.subscribeToDOMContentLoaded || function (fn) {
  if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn);
})(function () {
  if (document.documentElement.getAttribute('data-tooltips-wired') === 'true') return;
  document.documentElement.setAttribute('data-tooltips-wired', 'true');
  function findTrigger(el){
    if (!el) return null;
    return el.closest ? el.closest('[data-tooltip-trigger]') : null;
  }
  document.addEventListener('mouseover', function (e) {
    var trigger = findTrigger(e.target);
    if (!trigger) return;
    var id = trigger.getAttribute('aria-describedby');
    if (!id) return;
    var tip = document.getElementById(id);
    if (!tip) return;
    tip.classList.remove('opacity-0','invisible');
    tip.classList.add('opacity-100','visible');
  });
  document.addEventListener('mouseout', function (e) {
    var trigger = findTrigger(e.target);
    if (!trigger) return;
    var id = trigger.getAttribute('aria-describedby');
    if (!id) return;
    var tip = document.getElementById(id);
    if (!tip) return;
    tip.classList.remove('opacity-100','visible');
    tip.classList.add('opacity-0','invisible');
  });
  document.addEventListener('focusin', function (e) {
    var t = e.target;
    if (!t || !t.matches('[data-tooltip-trigger]')) return;
    var id = t.getAttribute('aria-describedby');
    if (!id) return;
    var tip = document.getElementById(id);
    if (!tip) return;
    tip.classList.remove('opacity-0','invisible');
    tip.classList.add('opacity-100','visible');
  });
  document.addEventListener('focusout', function (e) {
    var t = e.target;
    if (!t || !t.matches('[data-tooltip-trigger]')) return;
    var id = t.getAttribute('aria-describedby');
    if (!id) return;
    var tip = document.getElementById(id);
    if (!tip) return;
    tip.classList.remove('opacity-100','visible');
    tip.classList.add('opacity-0','invisible');
  });
});`;

export const tooltip = ({ message }: { message?: string } = {}): string => {
    // Use a simple counter on globalThis to avoid randomness and external deps
    interface GlobalWithCounter {
        flameTooltipCounter?: number;
    }

    const g = globalThis as unknown as GlobalWithCounter;

    g.flameTooltipCounter = (g.flameTooltipCounter ?? 0) + 1;
    const uid = `${Date.now().toString(36)}-${g.flameTooltipCounter}`;
    const triggerId = `tooltip-trigger-${uid}`;
    const contentId = `tooltip-content-${uid}`;

    return message
        ? `<div class="custom-tooltip-container relative inline-block ml-2">
  <button type="button" id="${triggerId}" data-tooltip-trigger aria-describedby="${contentId}" class="inline-flex justify-center items-center gap-2 text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-gray-200">
    <span class="dui" style="-webkit-mask-image: url('${infoIcon}'); mask-image: url('${infoIcon}')"></span>
  </button>
  <span id="${contentId}" class="custom-tooltip opacity-0 invisible transition-opacity inline-block absolute z-10 py-1 px-2 bg-gray-900 text-xs font-medium text-white rounded-sm shadow-xs dark:bg-slate-700 whitespace-normal" role="tooltip" style="left: 100%; top: 50%; transform: translateY(-50%) translateX(0.5rem); min-width: 200px;">
    ${message}
  </span>
</div>`
        : "";
};
