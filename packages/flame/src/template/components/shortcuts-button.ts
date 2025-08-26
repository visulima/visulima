// eslint-disable-next-line import/no-extraneous-dependencies
import helpCircleIcon from "lucide-static/icons/help-circle.svg?raw";
// eslint-disable-next-line import/no-extraneous-dependencies
import keyboardIcon from "lucide-static/icons/keyboard.svg?raw";

// Utility function to properly encode SVG content for CSS mask-image
const svgToDataUrl = (svgContent: string): string => {
    const cleanSvg = svgContent
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/\s+/g, " ")
        .trim();

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cleanSvg)}`;
};

const shortcutsButton = (): string => {
    return `<div class="hs-tooltip [--trigger:click] [--placement:bottom-end] inline-block">
  <button type="button" aria-label="Open keyboard shortcuts" title="Keyboard shortcuts" class="hs-tooltip-toggle flex justify-center items-center size-8 rounded-[var(--flame-radius-md)] shadow-[var(--flame-elevation-1)] bg-[var(--flame-surface)] text-[var(--flame-text)] hover:bg-[var(--flame-hover-overlay)] focus:outline-hidden focus:bg-[var(--flame-hover-overlay)] disabled:opacity-50 disabled:pointer-events-none" data-shortcuts-open>
    <span class="dui shrink-0 size-4" style="-webkit-mask-image:url('${svgToDataUrl(helpCircleIcon)}'); mask-image:url('${svgToDataUrl(helpCircleIcon)}')"></span>
    <span class="sr-only">Keyboard shortcuts</span>
  </button>

  <div class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity inline-block absolute invisible z-20 w-80 md:w-96 p-4 bg-[var(--flame-surface)] border border-[var(--flame-border)] text-sm text-[var(--flame-text-muted)] rounded-[var(--flame-radius-lg)] shadow-[var(--flame-elevation-2)]" role="tooltip">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <span class="dui shrink-0 size-4" style="-webkit-mask-image:url('${svgToDataUrl(keyboardIcon)}'); mask-image:url('${svgToDataUrl(keyboardIcon)}')"></span>
        <h3 class="font-semibold text-[var(--flame-text)] text-sm">Keyboard shortcuts</h3>
      </div>
      <kbd class="text-xs">?</kbd>
    </div>

    <ul class="grid grid-cols-1 gap-2">
      <li class="flex items-start justify-between gap-3">
        <span class="text-xs text-[var(--flame-text)]">Move focus</span>
        <div class="flex items-center gap-1 shrink-0">
          <kbd>Tab</kbd>
          <span class="text-[11px] text-[var(--flame-text-muted)]">or</span>
          <kbd>Shift</kbd>
          <kbd>Tab</kbd>
        </div>
      </li>
      <li class="flex items-start justify-between gap-3">
        <span class="text-xs text-[var(--flame-text)]">Activate controls</span>
        <div class="flex items-center gap-1 shrink-0">
          <kbd>Enter</kbd>
          <span class="text-[11px] text-[var(--flame-text-muted)]">or</span>
          <kbd>Space</kbd>
        </div>
      </li>
      <li class="flex items-start justify-between gap-3">
        <span class="text-xs text-[var(--flame-text)]">Open this help</span>
        <div class="flex items-center gap-1 shrink-0">
          <kbd>Shift</kbd>
          <kbd>/</kbd>
          <span class="text-[11px] text-[var(--flame-text-muted)]">( ? )</span>
        </div>
      </li>
      <li class="flex items-start justify-between gap-3">
        <span class="text-xs text-[var(--flame-text)]">Close dialogs</span>
        <div class="flex items-center gap-1 shrink-0">
          <kbd>Esc</kbd>
        </div>
      </li>
    </ul>
  </div>
</div>`;
};

export default shortcutsButton;
