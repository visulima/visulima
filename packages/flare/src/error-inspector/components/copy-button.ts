// eslint-disable-next-line import/no-extraneous-dependencies
import checkIcon from "lucide-static/icons/check.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import clipboardIcon from "lucide-static/icons/clipboard.svg?data-uri&encoding=css";

import { sanitizeAttr as sanitizeAttribute, sanitizeHtml } from "../util/sanitize";
import cn from "../util/tw";

const copyButton = ({ label = "Copy", successText = "Copied!", targetId }: { label?: string; successText?: string; targetId: string }): string => {
    const safeTarget = sanitizeAttribute(targetId);
    const safeLabelAttribute = sanitizeAttribute(label);
    const safeLabelHtml = sanitizeHtml(label);
    const safeSuccessTextAttribute = sanitizeAttribute(successText);
    const safeSuccessTextHtml = sanitizeHtml(successText);

    const tooltipId = sanitizeAttribute(`tooltip-copy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`);

    return `
    <button
      type="button"
      aria-label="${safeLabelAttribute}"
      aria-describedby="${tooltipId}"
      class="${cn(
            "[--is-toggle-tooltip:false] hs-tooltip relative inline-flex justify-center items-center size-8 rounded-[var(--flare-radius-md)] shadow-[var(--flare-elevation-1)] bg-[var(--flare-surface)] text-[var(--flare-text)] hover:bg-[var(--flare-hover-overlay)] focus:outline-hidden focus:bg-[var(--flare-hover-overlay)] disabled:opacity-50 disabled:pointer-events-none",
        )}"
      data-clipboard-target="#${safeTarget}"
      data-clipboard-action="copy"
      data-clipboard-success-text="${safeSuccessTextAttribute}"
      onclick="
        // Fallback if Preline clipboard isn't working
        const target = document.querySelector('#${safeTarget}');
        if (target && target.value) {
          navigator.clipboard.writeText(target.value).then(() => {
            // Show success feedback
            const defaultIcon = this.querySelector('.js-clipboard-default');
            const successIcon = this.querySelector('.js-clipboard-success');
            if (defaultIcon && successIcon) {
              defaultIcon.classList.add('hidden');
              successIcon.classList.remove('hidden');
              setTimeout(() => {
                defaultIcon.classList.remove('hidden');
                successIcon.classList.add('hidden');
              }, 2000);
            }
          }).catch(err => {
            console.warn('Failed to copy:', err);
          });
        }
      "
    >
      <span class="js-clipboard-default dui size-4 transition" style="-webkit-mask-image: url('${clipboardIcon}'); mask-image: url('${clipboardIcon}')"></span>

      <span class="js-clipboard-success dui hidden size-4 text-[var(--flare-red-orange)]" style="-webkit-mask-image: url('${checkIcon}'); mask-image: url('${checkIcon}')"></span>

      <span class="sr-only">${safeLabelHtml}</span>

      <span id="${tooltipId}" class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity hidden invisible z-10 py-1 px-2 text-xs font-medium rounded-[var(--flare-radius-md)] shadow-[var(--flare-elevation-1)] bg-[var(--flare-charcoal-black)] text-[var(--flare-white-smoke)]" role="tooltip">
        <span class="js-clipboard-success-text">${safeSuccessTextHtml}</span>
      </span>
    </button>
  `;
};

export default copyButton;
