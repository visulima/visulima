// eslint-disable-next-line import/no-extraneous-dependencies
import helpCircleIcon from "lucide-static/icons/help-circle.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import keyboardIcon from "lucide-static/icons/keyboard.svg?data-uri&encoding=css";

const shortcutsButton = (): string => {
    return `<button type="button" aria-label="Open keyboard shortcuts" title="Keyboard shortcuts" class="flex justify-center items-center size-9 rounded-[var(--ono-radius-md)] shadow-[var(--ono-elevation-1)] bg-[var(--ono-surface)] text-[var(--ono-text)] hover:bg-[var(--ono-hover-overlay)] focus:outline-hidden focus:bg-[var(--ono-hover-overlay)] disabled:opacity-50 disabled:pointer-events-none cursor-pointer" onclick="showShortcutsModal()">
    <span class="dui shrink-0 size-4" style="-webkit-mask-image:url('${helpCircleIcon}'); mask-image:url('${helpCircleIcon}')"></span>
    <span class="sr-only">Keyboard shortcuts</span>
  </button>`;
};

export default shortcutsButton;
