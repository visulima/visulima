// eslint-disable-next-line import/no-extraneous-dependencies
import helpCircleIcon from "lucide-static/icons/help-circle.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import keyboardIcon from "lucide-static/icons/keyboard.svg?data-uri&encoding=css";

const shortcutsButton = (): string => {
    return `<div class="hs-tooltip [--trigger:click] [--placement:bottom-end] inline-block">
  <button type="button" aria-label="Open keyboard shortcuts" title="Keyboard shortcuts" class="hs-tooltip-toggle flex justify-center items-center size-9 rounded-[var(--flare-radius-md)] shadow-[var(--flare-elevation-1)] bg-[var(--flare-surface)] text-[var(--flare-text)] hover:bg-[var(--flare-hover-overlay)] focus:outline-hidden focus:bg-[var(--flare-hover-overlay)] disabled:opacity-50 disabled:pointer-events-none" data-shortcuts-open>
    <span class="dui shrink-0 size-4" style="-webkit-mask-image:url('${helpCircleIcon}'); mask-image:url('${helpCircleIcon}')"></span>
    <span class="sr-only">Keyboard shortcuts</span>
  </button>

  <div class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity inline-block absolute invisible z-20 w-80 md:w-96 p-4 bg-[var(--flare-surface)] border border-[var(--flare-border)] text-sm text-[var(--flare-text-muted)] rounded-[var(--flare-radius-lg)] shadow-[var(--flare-elevation-2)]" role="tooltip">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <span class="dui shrink-0 size-4" style="-webkit-mask-image:url('${keyboardIcon}'); mask-image:url('${keyboardIcon}')"></span>
        <h3 class="font-semibold text-[var(--flare-text)] text-sm">Keyboard shortcuts</h3>
      </div>
      <kbd class="text-xs">?</kbd>
    </div>

    <ul class="grid grid-cols-1 gap-2">
      <li class="flex items-start justify-between gap-3">
        <span class="text-xs text-[var(--flare-text)]">Move focus</span>
        <div class="flex items-center gap-1 shrink-0">
          <kbd>Tab</kbd>
          <span class="text-[11px] text-[var(--flare-text-muted)]">or</span>
          <kbd>Shift</kbd>
          <kbd>Tab</kbd>
        </div>
      </li>
      <li class="flex items-start justify-between gap-3">
        <span class="text-xs text-[var(--flare-text)]">Activate controls</span>
        <div class="flex items-center gap-1 shrink-0">
          <kbd>Enter</kbd>
          <span class="text-[11px] text-[var(--flare-text-muted)]">or</span>
          <kbd>Space</kbd>
        </div>
      </li>
      <li class="flex items-start justify-between gap-3">
        <span class="text-xs text-[var(--flare-text)]">Open this help</span>
        <div class="flex items-center gap-1 shrink-0">
          <kbd>Shift</kbd>
          <kbd>/</kbd>
          <span class="text-[11px] text-[var(--flare-text-muted)]">( ? )</span>
        </div>
      </li>
      <li class="flex items-start justify-between gap-3">
        <span class="text-xs text-[var(--flare-text)]">Close dialogs</span>
        <div class="flex items-center gap-1 shrink-0">
          <kbd>Esc</kbd>
        </div>
      </li>
    </ul>
  </div>
</div>`;
};

export default shortcutsButton;
