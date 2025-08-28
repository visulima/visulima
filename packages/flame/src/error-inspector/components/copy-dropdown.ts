import svgToDataUrl from "../util/svg-to-data-url";
import { sanitizeAttr, sanitizeHtml } from "../util/sanitize";
// eslint-disable-next-line import/no-extraneous-dependencies
import chevronDownIcon from "lucide-static/icons/chevron-down.svg?raw";
// eslint-disable-next-line import/no-extraneous-dependencies
import clipboardIcon from "lucide-static/icons/clipboard.svg?raw";
// eslint-disable-next-line import/no-extraneous-dependencies
import checkIcon from "lucide-static/icons/check.svg?raw";

const copyDropdown = ({
    targetId,
    label = "Copy",
    successText = "Copied!",
    secondaryLabel = "Copy fix prompt",
    secondaryText,
}: {
    targetId: string;
    label?: string;
    successText?: string;
    secondaryLabel?: string;
    secondaryText: string;
}): string => {
    const safeSecondaryLabelHtml = sanitizeHtml(secondaryLabel);
    const safeSecondaryTextAttr = sanitizeAttr(secondaryText);
    const safeTarget = sanitizeAttr(targetId);
    const safeLabelAttr = sanitizeAttr(label);
    const safeLabelHtml = sanitizeHtml(label);

    return `
<div class="hs-dropdown relative inline-block hs-tooltip [--is-toggle-tooltip:false]">
  <button
    type="button"
    aria-label="${safeLabelAttr}"
    class="inline-flex justify-center items-center gap-2 px-1 h-8 rounded-[var(--flame-radius-md)] shadow-[var(--flame-elevation-1)] bg-[var(--flame-surface)] text-[var(--flame-text)] hover:bg-[var(--flame-hover-overlay)] focus:outline-hidden focus:bg-[var(--flame-hover-overlay)] disabled:opacity-50 disabled:pointer-events-none hs-dropdown-toggle"
    data-copy-toggle
  >

    <span class="js-clipboard-default dui size-4 transition" style="-webkit-mask-image: url('${svgToDataUrl(clipboardIcon)}'); mask-image: url('${svgToDataUrl(clipboardIcon)}')"></span>
    <span class="js-clipboard-success dui hidden size-4 text-[var(--flame-red-orange)]" style="-webkit-mask-image: url('${svgToDataUrl(checkIcon)}'); mask-image: url('${svgToDataUrl(checkIcon)}')"></span>
    <span class="sr-only">${safeLabelHtml}</span>
    <span class="dui size-4 hs-dropdown-open:rotate-180" style="-webkit-mask-image:url('${svgToDataUrl(chevronDownIcon)}'); mask-image:url('${svgToDataUrl(
        chevronDownIcon,
    )}')"></span>
  </button>
  <span class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity hidden invisible z-10 py-1 px-2 text-xs font-medium rounded-[var(--flame-radius-md)] shadow-[var(--flame-elevation-1)] bg-[var(--flame-charcoal-black)] text-[var(--flame-white-smoke)]" role="tooltip" aria-hidden="true">${safeLabelHtml}</span>

  <div class="hs-dropdown-menu [--auto-close:inside] transition-[opacity,margin] duration hs-dropdown-open:opacity-100 hs-dropdown-open:visible opacity-0 hidden z-20 mt-1 min-w-52 p-1 bg-[var(--flame-surface)] border border-[var(--flame-border)] text-sm text-[var(--flame-text)] rounded-[var(--flame-radius-md)] shadow-[var(--flame-elevation-2)]" role="menu">
    <button
      type="button"
      role="menuitem"
      class="w-full text-left px-3 py-2 rounded-[var(--flame-radius-md)] hover:bg-[var(--flame-hover-overlay)] focus:outline-hidden"
      data-clipboard-target="#${safeTarget}"
      data-clipboard-action="copy"
      data-clipboard-success-text="${sanitizeAttr(successText)}"
      onclick="(function(btn){ try { var targetSel = btn.getAttribute('data-clipboard-target'); var target = targetSel ? document.querySelector(targetSel) : null; var text = target ? (target.value || target.textContent || '') : ''; if (!text) return; navigator.clipboard.writeText(text).then(function(){ var root = btn.closest('.hs-dropdown'); var toggle = root ? root.querySelector('[data-copy-toggle]') : null; if (toggle) { var d = toggle.querySelector('.js-clipboard-default'); var s = toggle.querySelector('.js-clipboard-success'); if (d && s) { d.classList.add('hidden'); s.classList.remove('hidden'); setTimeout(function(){ d.classList.remove('hidden'); s.classList.add('hidden'); }, 2000); } } }).catch(function(err){ console.warn('Failed to copy:', err); }); } catch(_){} })(this)"
    >
      ${safeLabelHtml}
    </button>
    <button
      type="button"
      role="menuitem"
      class="w-full text-left px-3 py-2 rounded-[var(--flame-radius-md)] hover:bg-[var(--flame-hover-overlay)] focus:outline-hidden"
      data-clipboard-text="${safeSecondaryTextAttr}"
      data-clipboard-action="copy"
      data-clipboard-success-text="${sanitizeAttr(successText)}"
      onclick="(function(btn){ try { var text = btn.getAttribute('data-clipboard-text') || ''; if (!text) return; navigator.clipboard.writeText(text).then(function(){ var root = btn.closest('.hs-dropdown'); var toggle = root ? root.querySelector('[data-copy-toggle]') : null; if (toggle) { var d = toggle.querySelector('.js-clipboard-default'); var s = toggle.querySelector('.js-clipboard-success'); if (d && s) { d.classList.add('hidden'); s.classList.remove('hidden'); setTimeout(function(){ d.classList.remove('hidden'); s.classList.add('hidden'); }, 2000); } } }).catch(function(err){ console.warn('Failed to copy:', err); }); } catch(_){} })(this)"
    >
      ${safeSecondaryLabelHtml}
    </button>
  </div>
</div>`;
};

export default copyDropdown;


