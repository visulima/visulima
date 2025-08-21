const shortcutsModal = (): string => {
    return `<div class="hs-tooltip [--trigger:click] [--placement:bottom] inline-block">
  <button type="button" class="hs-tooltip-toggle flex justify-center items-center size-8 text-sm font-semibold rounded-lg border border-gray-200 bg-white text-gray-800 shadow-2xs hover:bg-gray-50 focus:outline-hidden focus:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-900 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-800 dark:focus:bg-neutral-800" data-shortcuts-open>
    <svg class="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.18-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"></path>
    </svg>
    <span class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity inline-block absolute invisible z-10 py-3 px-4 bg-white border border-gray-200 text-sm text-gray-600 rounded-lg shadow-md dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-400 max-w-xs" role="tooltip">
      <div class="space-y-2">
        <h3 class="font-bold text-gray-800 dark:text-white text-sm">Keyboard shortcuts</h3>
        <ul class="list-disc ps-4 space-y-1 text-xs text-gray-800 dark:text-gray-200">
          <li><code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">Tab</code> / <code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">Shift+Tab</code> to move focus</li>
          <li><code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">Enter</code> / <code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">Space</code> to activate controls</li>
          <li><code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">?</code> (Shift+/) to open this help</li>
          <li><code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">Esc</code> to close dialogs</li>
        </ul>
      </div>
    </span>
  </button>
</div>`;
};

export default shortcutsModal;
