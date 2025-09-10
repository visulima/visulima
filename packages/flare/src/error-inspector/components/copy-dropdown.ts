// eslint-disable-next-line import/no-extraneous-dependencies
import checkIcon from "lucide-static/icons/check.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import chevronDownIcon from "lucide-static/icons/chevron-down.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import clipboardIcon from "lucide-static/icons/clipboard.svg?data-uri&encoding=css";

import { sanitizeAttr as sanitizeAttribute, sanitizeHtml } from "../util/sanitize";

const copyDropdown = ({
    label = "Copy",
    secondaryLabel = "Copy fix prompt",
    secondaryText,
    successText = "Copied!",
    targetId,
}: {
    label?: string;
    secondaryLabel?: string;
    secondaryText: string;
    successText?: string;
    targetId: string;
}): string => {
    const safeSecondaryLabelHtml = sanitizeHtml(secondaryLabel);
    const safeSecondaryTextAttribute = sanitizeAttribute(secondaryText);
    const safeTarget = sanitizeAttribute(targetId);
    const safeLabelAttribute = sanitizeAttribute(label);
    const safeLabelHtml = sanitizeHtml(label);

    return `
<div class="hs-dropdown relative inline-block hs-tooltip [--is-toggle-tooltip:false]">
  <button
    type="button"
    aria-label="${safeLabelAttribute}"
    class="inline-flex justify-center items-center gap-2 px-1 h-8 rounded-[var(--flare-radius-md)] shadow-[var(--flare-elevation-1)] bg-[var(--flare-surface)] text-[var(--flare-text)] hover:bg-[var(--flare-hover-overlay)] focus:outline-hidden focus:bg-[var(--flare-hover-overlay)] disabled:opacity-50 disabled:pointer-events-none hs-dropdown-toggle"
    data-copy-toggle
  >

    <span class="js-clipboard-default dui size-4 transition" style="-webkit-mask-image: url('${clipboardIcon}'); mask-image: url('${clipboardIcon}')"></span>
    <span class="js-clipboard-success dui hidden size-4 text-[var(--flare-red-orange)]" style="-webkit-mask-image: url('${checkIcon}'); mask-image: url('${checkIcon}')"></span>
    <span class="sr-only">${safeLabelHtml}</span>
    <span class="dui size-4 hs-dropdown-open:rotate-180" style="-webkit-mask-image:url('${chevronDownIcon}'); mask-image:url('${chevronDownIcon}')"></span>
  </button>
  <span class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity hidden invisible z-10 py-1 px-2 text-xs font-medium rounded-[var(--flare-radius-md)] shadow-[var(--flare-elevation-1)] bg-[var(--flare-charcoal-black)] text-[var(--flare-white-smoke)]" role="tooltip" aria-hidden="true">${safeLabelHtml}</span>

  <div class="hs-dropdown-menu [--auto-close:inside] transition-[opacity,margin] duration hs-dropdown-open:opacity-100 hs-dropdown-open:visible opacity-0 hidden z-20 mt-1 min-w-52 p-1 bg-[var(--flare-surface)] border border-[var(--flare-border)] text-sm text-[var(--flare-text)] rounded-[var(--flare-radius-md)] shadow-[var(--flare-elevation-2)]" role="menu">
    <button
      type="button"
      role="menuitem"
      class="w-full text-left px-3 py-2 rounded-[var(--flare-radius-md)] hover:bg-[var(--flare-hover-overlay)] focus:outline-hidden"
      data-clipboard-target="#${safeTarget}"
      data-clipboard-action="copy"
      data-clipboard-success-text="${sanitizeAttribute(successText)}"
      onclick="(function(btn){ try { var targetSel = btn.getAttribute('data-clipboard-target'); var target = targetSel ? document.querySelector(targetSel) : null; var text = target ? (target.value || target.textContent || '') : ''; if (!text) return; navigator.clipboard.writeText(text).then(function(){ var root = btn.closest('.hs-dropdown'); var toggle = root ? root.querySelector('[data-copy-toggle]') : null; if (toggle) { var d = toggle.querySelector('.js-clipboard-default'); var s = toggle.querySelector('.js-clipboard-success'); if (d && s) { d.classList.add('hidden'); s.classList.remove('hidden'); setTimeout(function(){ d.classList.remove('hidden'); s.classList.add('hidden'); }, 2000); } } }).catch(function(err){ console.warn('Failed to copy:', err); }); } catch(_){} })(this)"
    >
      ${safeLabelHtml}
    </button>
    <button
      type="button"
      role="menuitem"
      class="w-full text-left px-3 py-2 rounded-[var(--flare-radius-md)] hover:bg-[var(--flare-hover-overlay)] focus:outline-hidden"
      data-clipboard-text="${safeSecondaryTextAttribute}"
      data-clipboard-action="copy"
      data-clipboard-success-text="${sanitizeAttribute(successText)}"
      onclick="(function(btn){ try { var text = btn.getAttribute('data-clipboard-text') || ''; if (!text) return; navigator.clipboard.writeText(text).then(function(){ var root = btn.closest('.hs-dropdown'); var toggle = root ? root.querySelector('[data-copy-toggle]') : null; if (toggle) { var d = toggle.querySelector('.js-clipboard-default'); var s = toggle.querySelector('.js-clipboard-success'); if (d && s) { d.classList.add('hidden'); s.classList.remove('hidden'); setTimeout(function(){ d.classList.remove('hidden'); s.classList.add('hidden'); }, 2000); } } }).catch(function(err){ console.warn('Failed to copy:', err); }); } catch(_){} })(this)"
    >
      ${safeSecondaryLabelHtml}
    </button>
  </div>
</div>`;
};

export default copyDropdown;
