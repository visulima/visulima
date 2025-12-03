// eslint-disable-next-line import/no-extraneous-dependencies
import checkIcon from "lucide-static/icons/check.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import clipboardIcon from "lucide-static/icons/clipboard.svg?data-uri&encoding=css";

import { sanitizeAttribute, sanitizeHtml } from "../utils/sanitize";

const copyButton = ({ label = "Copy", successText = "Copied!", targetId }: { label?: string; successText?: string; targetId: string }): { html: string } => {
    const safeTarget = sanitizeAttribute(targetId);
    const safeLabelAttribute = sanitizeAttribute(label);
    const safeLabelHtml = sanitizeHtml(label);
    const safeSuccessTextHtml = sanitizeHtml(successText);

    const html = `
    <button
      type="button"
      aria-label="${safeLabelAttribute}"
      title="${safeLabelHtml}"
      class="ono-copy-btn relative inline-flex justify-center items-center size-8 rounded-[var(--ono-radius-md)] shadow-[var(--ono-elevation-1)] bg-[var(--ono-surface)] text-[var(--ono-text)] hover:bg-[var(--ono-hover-overlay)] focus:outline-hidden focus:bg-[var(--ono-hover-overlay)] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
      data-target="#${safeTarget}"
      data-success-text="${safeSuccessTextHtml}"
    >
      <span class="ono-copy-default dui size-4 transition" style="-webkit-mask-image: url('${clipboardIcon}'); mask-image: url('${clipboardIcon}')"></span>
      <span class="ono-copy-success dui hidden size-4 text-[var(--ono-red-orange)]" style="-webkit-mask-image: url('${checkIcon}'); mask-image: url('${checkIcon}')"></span>
      <span class="sr-only">${safeLabelHtml}</span>
    </button>
  `;

    return {
        html,
    };
};

export default copyButton;
