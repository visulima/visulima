const shortcutsButton = (): string => {
    return `
    <div class="hs-tooltip [--trigger:click] inline-block">
      <button 
        type="button" 
        class="hs-tooltip-toggle px-2 py-1 cursor-pointer rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs hover:bg-gray-200 dark:hover:bg-gray-700"
        aria-label="Open keyboard shortcuts" 
        title="Keyboard shortcuts"
      >
        ?
      </button>
      <div class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity absolute invisible z-20 py-3 px-4 bg-white border border-gray-200 text-sm text-gray-600 rounded-lg shadow-md dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-400 w-60" role="tooltip">
        <div class="space-y-3">
          <h3 class="font-semibold text-gray-800 dark:text-white mb-2">Keyboard Shortcuts</h3>
          
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <span class="text-gray-600 dark:text-gray-400">Open shortcuts</span>
              <kbd class="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">?</kbd>
            </div>
            
            <div class="flex justify-between items-center">
              <span class="text-gray-600 dark:text-gray-400">Toggle theme</span>
              <kbd class="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">🌙</kbd>
            </div>
            
            <div class="flex justify-between items-center">
              <span class="text-gray-600 dark:text-gray-400">Copy to clipboard</span>
              <kbd class="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">Click</kbd>
            </div>
            
            <div class="flex justify-between items-center">
              <span class="text-gray-600 dark:text-gray-400">Toggle solutions</span>
              <kbd class="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">Click</kbd>
            </div>
          </div>
          
          <div class="pt-2 border-t border-gray-200 dark:border-gray-700">
            <p class="text-xs text-gray-500 dark:text-gray-500">
              Press <kbd class="px-1 py-0.5 text-xs font-mono bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">Esc</kbd> to close
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
};

export default shortcutsButton;
