// eslint-disable-next-line import/no-extraneous-dependencies
import checkIcon from "lucide-static/icons/check.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import chevronDownIcon from "lucide-static/icons/chevron-down.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import clipboardIcon from "lucide-static/icons/clipboard.svg?data-uri&encoding=css";

import { sanitizeAttribute, sanitizeHtml } from "../util/sanitize";

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
}): { html: string } => {
    const safeSecondaryLabelHtml = sanitizeHtml(secondaryLabel);
    const safeSecondaryTextAttribute = sanitizeAttribute(secondaryText);
    const safeTarget = sanitizeAttribute(targetId);
    const safeLabelAttribute = sanitizeAttribute(label);
    const safeLabelHtml = sanitizeHtml(label);

    const html = `
<div class="ono-dropdown relative inline-block">
  <button
    type="button"
    aria-label="${safeLabelAttribute}"
    title="${safeLabelHtml}"
    class="ono-dropdown-toggle inline-flex justify-center items-center gap-2 px-1 h-8 rounded-[var(--ono-radius-md)] shadow-[var(--ono-elevation-1)] bg-[var(--ono-surface)] text-[var(--ono-text)] hover:bg-[var(--ono-hover-overlay)] focus:outline-hidden focus:bg-[var(--ono-hover-overlay)] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
  >
    <span class="ono-copy-default dui size-4 transition" style="-webkit-mask-image: url('${clipboardIcon}'); mask-image: url('${clipboardIcon}')"></span>
    <span class="ono-copy-success dui hidden size-4 text-[var(--ono-red-orange)]" style="-webkit-mask-image: url('${checkIcon}'); mask-image: url('${checkIcon}')"></span>
    <span class="sr-only">${safeLabelHtml}</span>
    <span class="dui size-4 transition-transform duration-200 [&.ono-dropdown-open]:rotate-180" style="-webkit-mask-image:url('${chevronDownIcon}'); mask-image:url('${chevronDownIcon}')"></span>
  </button>

  <div class="ono-dropdown-menu absolute z-20 top-full left-0 mt-1 min-w-52 p-1 bg-[var(--ono-surface)] border border-[var(--ono-border)] text-sm text-[var(--ono-text)] rounded-[var(--ono-radius-md)] shadow-[var(--ono-elevation-2)] [&.ono-dropdown-open]:block" role="menu">
    <button
      type="button"
      role="menuitem"
      class="ono-copy-menu-item w-full text-left px-3 py-2 rounded-[var(--ono-radius-md)] hover:bg-[var(--ono-hover-overlay)] focus:outline-hidden cursor-pointer"
      data-target="#${safeTarget}"
      data-success-text="${sanitizeAttribute(successText)}"
    >
      ${safeLabelHtml}
    </button>
    <button
      type="button"
      role="menuitem"
      class="ono-copy-menu-item w-full text-left px-3 py-2 rounded-[var(--ono-radius-md)] hover:bg-[var(--ono-hover-overlay)] focus:outline-hidden cursor-pointer"
      data-text="${safeSecondaryTextAttribute}"
      data-success-text="${sanitizeAttribute(successText)}"
    >
      ${safeSecondaryLabelHtml}
    </button>
  </div>
</div>
`;

    return {
        html,
    };
};

export default copyDropdown;
