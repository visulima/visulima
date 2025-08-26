import cn from "../util/tw";
// eslint-disable-next-line import/no-extraneous-dependencies
import clipboardIcon from "lucide-static/icons/clipboard.svg?raw";
// eslint-disable-next-line import/no-extraneous-dependencies
import checkIcon from "lucide-static/icons/check.svg?raw";

// Utility function to properly encode SVG content for CSS mask-image
const svgToDataUrl = (svgContent: string): string => {
    const cleanSvg = svgContent
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/\s+/g, " ")
        .trim();

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cleanSvg)}`;
};

const copyButton = ({ targetId, label = "Copy", successText = "Copied!" }: { targetId: string; label?: string; successText?: string }): string => {
    return `
    <button
      type="button"
      aria-label="${label}"
      title="${label}"
      class="${cn(
          "[--is-toggle-tooltip:false] hs-tooltip relative inline-flex justify-center items-center size-8 rounded-[var(--flame-radius-md)] shadow-[var(--flame-elevation-1)] bg-[var(--flame-surface)] text-[var(--flame-text)] hover:bg-[var(--flame-hover-overlay)] focus:outline-hidden focus:bg-[var(--flame-hover-overlay)] disabled:opacity-50 disabled:pointer-events-none",
      )}"
      data-clipboard-target="#${targetId}"
      data-clipboard-action="copy"
      data-clipboard-success-text="${successText}"
      onclick="
        // Fallback if Preline clipboard isn't working
        const target = document.querySelector('#${targetId}');
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
      <span class="js-clipboard-default dui size-4 transition" style="-webkit-mask-image: url('${svgToDataUrl(clipboardIcon)}'); mask-image: url('${svgToDataUrl(clipboardIcon)}')"></span>

      <span class="js-clipboard-success dui hidden size-4 text-[var(--flame-red-orange)]" style="-webkit-mask-image: url('${svgToDataUrl(checkIcon)}'); mask-image: url('${svgToDataUrl(checkIcon)}')"></span>

      <span class="sr-only">${label}</span>

      <span class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity hidden invisible z-10 py-1 px-2 text-xs font-medium rounded-[var(--flame-radius-md)] shadow-[var(--flame-elevation-1)] bg-[var(--flame-charcoal-black)] text-[var(--flame-white-smoke)]" role="tooltip">
        <span class="js-clipboard-success-text">${label}</span>
      </span>
    </button>
  `;
};

export default copyButton;
