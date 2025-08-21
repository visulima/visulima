const copyButton = ({
    targetId,
    label = "Copy",
    successText = "Copied!",
    className = "js-clipboard-example [--is-toggle-tooltip:false] hs-tooltip relative py-1 px-2 inline-flex justify-center items-center gap-x-2 text-xs font-medium rounded border border-gray-200 bg-white text-gray-800 shadow-2xs hover:bg-gray-50 focus:outline-hidden focus:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-900 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-800 dark:focus:bg-neutral-800",
}: {
    targetId: string;
    label?: string;
    successText?: string;
    className?: string;
}): string => {
    return `
    <button 
      type="button" 
      class="${className}"
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
      <svg class="js-clipboard-default size-4 transition" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect>
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
      </svg>
      
      <svg class="js-clipboard-success hidden size-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>

      <span class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity hidden invisible z-10 py-1 px-2 bg-gray-900 text-xs font-medium text-white rounded-lg shadow-md dark:bg-neutral-700" role="tooltip">
        <span class="js-clipboard-success-text">${label}</span>
      </span>
    </button>
  `;
};

export default copyButton;
