const shortcutsButton = (): string => {
    return `
    <div class="hs-tooltip [--trigger:click] inline-block">
      <button
        type="button"
        class="hs-tooltip-toggle px-2 py-1 cursor-pointer rounded text-xs bg-[var(--flame-metallic-silver)] text-[var(--flame-charcoal-black)]"
        aria-label="Open keyboard shortcuts"
        title="Keyboard shortcuts"
      >
        ?
      </button>
      <div class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity absolute invisible z-20 py-3 px-4 text-sm rounded-lg shadow-md w-60 bg-[var(--flame-white-smoke)] text-[var(--flame-charcoal-black)]" role="tooltip">
        <div class="space-y-3">
          <h3 class="font-semibold mb-2 text-[var(--flame-charcoal-black)]">Keyboard Shortcuts</h3>

          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <span class="text-[var(--flame-charcoal-black)]">Open shortcuts</span>
              <kbd class="px-2 py-1 text-xs font-mono rounded bg-[var(--flame-metallic-silver)] text-[var(--flame-charcoal-black)]">?</kbd>
            </div>

            <div class="flex justify-between items-center">
              <span class="text-[var(--flame-charcoal-black)]">Toggle theme</span>
              <kbd class="px-2 py-1 text-xs font-mono rounded bg-[var(--flame-metallic-silver)] text-[var(--flame-charcoal-black)]">🌙</kbd>
            </div>

            <div class="flex justify-between items-center">
              <span class="text-[var(--flame-charcoal-black)]">Copy to clipboard</span>
              <kbd class="px-2 py-1 text-xs font-mono rounded bg-[var(--flame-metallic-silver)] text-[var(--flame-charcoal-black)]">Click</kbd>
            </div>

            <div class="flex justify-between items-center">
              <span class="text-[var(--flame-charcoal-black)]">Toggle solutions</span>
              <kbd class="px-2 py-1 text-xs font-mono rounded bg-[var(--flame-metallic-silver)] text-[var(--flame-charcoal-black)]">Click</kbd>
            </div>
          </div>

          <div class="pt-2 border-t border-[var(--flame-metallic-silver)]">
            <p class="text-xs text-[var(--flame-metallic-silver)]">
              Press <kbd class="px-1 py-0.5 text-xs font-mono rounded bg-[var(--flame-metallic-silver)] text-[var(--flame-charcoal-black)]">Esc</kbd> to close
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
};

export default shortcutsButton;
