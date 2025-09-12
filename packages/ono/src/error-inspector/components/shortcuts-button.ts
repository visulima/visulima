// eslint-disable-next-line import/no-extraneous-dependencies
import helpCircleIcon from "lucide-static/icons/help-circle.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import keyboardIcon from "lucide-static/icons/keyboard.svg?data-uri&encoding=css";

const shortcutsModalHtml = `
<div id="ono-shortcuts-modal" class="fixed inset-0 z-50 hidden backdrop-blur-xl items-center justify-center p-2" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="ono-shortcuts-title">
  <div class="bg-[var(--ono-surface)] rounded-[var(--ono-radius-lg)] shadow-[var(--ono-elevation-2)] max-w-md w-full max-h-[90vh] overflow-auto">
    <div class="flex items-center justify-between px-4 py-2 border-b border-[var(--ono-border)]">
      <div class="flex items-center gap-2">
        <span class="dui shrink-0 size-4" style="-webkit-mask-image:url('${keyboardIcon}'); mask-image:url('${keyboardIcon}')"></span>
        <h3 id="ono-shortcuts-title" class="font-semibold text-[var(--ono-text)] text-lg">Keyboard shortcuts</h3>
      </div>
      <button type="button" data-ono-action="close-shortcuts-modal" aria-label="Close keyboard shortcuts" class="text-[var(--ono-text-muted)] hover:text-[var(--ono-text)] p-1 text-xl font-bold">
        ×
      </button>
    </div>

    <div class="p-4">
      <ul class="grid grid-cols-1 gap-3">
        <li class="flex items-start justify-between gap-3">
          <span class="text-sm text-[var(--ono-text)]">Move focus</span>
          <div class="flex items-center gap-1 shrink-0">
            <kbd class="text-xs bg-[var(--ono-chip-bg)] text-[var(--ono-chip-text)] px-2 py-1 rounded">Tab</kbd>
            <span class="text-[11px] text-[var(--ono-text-muted)]">or</span>
            <kbd class="text-xs bg-[var(--ono-chip-bg)] text-[var(--ono-chip-text)] px-2 py-1 rounded">Shift</kbd>
            <kbd class="text-xs bg-[var(--ono-chip-bg)] text-[var(--ono-chip-text)] px-2 py-1 rounded">Tab</kbd>
          </div>
        </li>
        <li class="flex items-start justify-between gap-3">
          <span class="text-sm text-[var(--ono-text)]">Activate controls</span>
          <div class="flex items-center gap-1 shrink-0">
            <kbd class="text-xs bg-[var(--ono-chip-bg)] text-[var(--ono-chip-text)] px-2 py-1 rounded">Enter</kbd>
            <span class="text-[11px] text-[var(--ono-text-muted)]">or</span>
            <kbd class="text-xs bg-[var(--ono-chip-bg)] text-[var(--ono-chip-text)] px-2 py-1 rounded">Space</kbd>
          </div>
        </li>
        <li class="flex items-start justify-between gap-3">
          <span class="text-sm text-[var(--ono-text)]">Open this help</span>
          <div class="flex items-center gap-1 shrink-0">
            <kbd class="text-xs bg-[var(--ono-chip-bg)] text-[var(--ono-chip-text)] px-2 py-1 rounded">Shift</kbd>
            <kbd class="text-xs bg-[var(--ono-chip-bg)] text-[var(--ono-chip-text)] px-2 py-1 rounded">/</kbd>
            <kbd class="text-xs bg-[var(--ono-chip-bg)] text-[var(--ono-chip-text)] px-2 py-1 rounded cursor-help" title="to open this help">?</kbd>
          </div>
        </li>
        <li class="flex items-start justify-between gap-3">
          <span class="text-sm text-[var(--ono-text)]">Close dialogs</span>
          <div class="flex items-center gap-1 shrink-0">
            <kbd class="text-xs bg-[var(--ono-chip-bg)] text-[var(--ono-chip-text)] px-2 py-1 rounded">Esc</kbd>
          </div>
        </li>
      </ul>
    </div>
  </div>
</div>
`;

const bindShortcutsModalScript = `
const bindShortcutsModal = () => {
    const modal = document.getElementById('ono-shortcuts-modal');
    if (!modal) return;

    const openButtons = document.querySelectorAll('[data-ono-action="open-shortcuts-modal"]');
    const closeButtons = document.querySelectorAll('[data-ono-action="close-shortcuts-modal"]');

    const showModal = () => {
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        modal.focus();
    };

    const hideModal = () => {
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
    };

    // Bind open buttons
    openButtons.forEach(button => {
        button.addEventListener('click', showModal);
    });

    // Bind close buttons
    closeButtons.forEach(button => {
        button.addEventListener('click', hideModal);
    });

    // Handle Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            hideModal();
        }
    };

    document.addEventListener('keydown', handleEscape);

    // Click outside modal to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideModal();
        }
    });
};
`;

const shortcutsButton = (): { html: string; script: string } => {
    const buttonHtml = `
<button type="button" aria-label="Open keyboard shortcuts" title="Keyboard shortcuts" data-ono-action="open-shortcuts-modal" class="flex justify-center items-center size-9 rounded-[var(--ono-radius-md)] shadow-[var(--ono-elevation-1)] bg-[var(--ono-surface)] text-[var(--ono-text)] hover:bg-[var(--ono-hover-overlay)] focus:outline-hidden focus:bg-[var(--ono-hover-overlay)] disabled:opacity-50 disabled:pointer-events-none cursor-pointer">
    <span class="dui shrink-0 size-4" style="-webkit-mask-image:url('${helpCircleIcon}'); mask-image:url('${helpCircleIcon}')"></span>
    <span class="sr-only">Keyboard shortcuts</span>
  </button>
`;

    const html = shortcutsModalHtml + buttonHtml;

    return {
        html,
        script: bindShortcutsModalScript.trim(),
    };
};

export default shortcutsButton;
