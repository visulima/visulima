import copyButton from "../copy-button";
import shortcutsButton from "../shortcuts-button";

const stickyHeader = (
    error: Error,
): {
    html: string;
    script: string;
} => {
    return {
        html: `<div id="error-card-sticky-header" class="fixed invisible bg-white dark:bg-gray-800/50 dark:bg-linear-to-bl dark:ring-1 dark:ring-inset dark:ring-white/5 container px-6 py-4 -top-40 z-10 rounded-b-lg transition-all duration-300 dark:shadow-none from-gray-700/50 via-transparent shadow-2xl shadow-gray-500/20">
  <input type="hidden" id="clipboard-sticky-error-title" value="${error.name}: ${error.message}">
  <div class="flex items-center gap-2">
    <h1 class="text-sm font-semibold text-gray-700 dark:text-white bg-gray-100 dark:bg-gray-800/50 dark:ring-1 dark:ring-inset dark:ring-white/5 py-1 px-2" aria-label="Error name">${error.name}</h1>
    <span class="text-md font-semibold text-gray-600 dark:text-gray-400 line-clamp-1" aria-label="Error message">${error.message}</span>
    <div class="grow"></div>
    ${shortcutsButton()}
    ${copyButton({ targetId: "clipboard-sticky-error-title", label: "Copy error title" })}
  </div>
</div>`,
        script: `(window.subscribeToDOMContentLoaded || function (fn) { 
          if (document.readyState !== 'loading') fn(); 
          else document.addEventListener('DOMContentLoaded', fn); 
        })(function () {
          const errorCard = document.getElementById("error-card");
          const header = document.getElementById("error-card-sticky-header");
          
          if (!errorCard || !header) {
            console.warn('Sticky header elements not found');
            return;
          }

          const stickyHeader = () => {
            const bounding = errorCard.getBoundingClientRect();

            if (bounding.bottom <= -15) {
              header.classList.remove("invisible");
              header.classList.remove("-top-40");
              header.classList.add("top-0");
              header.classList.add("visible");
            } else {
              header.classList.remove("top-0");
              header.classList.remove("visible");
              header.classList.add("invisible");
              header.classList.add("-top-40");
            }
          };

          // Initialize sticky header
          stickyHeader();

          // Add scroll listener
          window.addEventListener('scroll', stickyHeader, { passive: true });
        });`,
    };
};

export default stickyHeader;
