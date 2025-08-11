// eslint-disable-next-line import/no-extraneous-dependencies
import checkIcon from "lucide-static/icons/check.svg?raw";
// eslint-disable-next-line import/no-extraneous-dependencies
import copyIcon from "lucide-static/icons/copy.svg?raw";

const stickyHeader = (
    error: Error,
): {
    html: string;
    script: string;
} => {
    return {
        html: `<div id="error-card-sticky-header" class="fixed invisible bg-white dark:bg-gray-800/50 dark:bg-linear-to-bl dark:ring-1 dark:ring-inset dark:ring-white/5 container px-6 py-4 -top-40 z-10 rounded-b-lg transition-all duration-300 dark:shadow-none from-gray-700/50 via-transparent shadow-2xl shadow-gray-500/20">
  <div class="flex items-center gap-2">
    <h1 class="text-sm font-semibold text-gray-700 dark:text-white bg-gray-100 dark:bg-gray-800/50 dark:ring-1 dark:ring-inset dark:ring-white/5 py-1 px-2">${error.name}</h1>
    <span class="text-md font-semibold text-gray-600 dark:text-gray-400 line-clamp-1">${error.message}</span>
    <div class="grow"></div>
    <button
      type="button"
      aria-label="Copy error title"
      title="Copy"
      class="js-clipboard cursor-pointer inline-flex items-center justify-center text-xs font-medium text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800/50 dark:ring-1 dark:ring-inset dark:ring-white/5 py-1 px-2 rounded"
      data-clipboard-text="${error.name}: ${error.message}"
      data-clipboard-success-text="Copied"
    >
      <span class="js-clipboard-default dui w-4 h-4" style="-webkit-mask-image: url('${copyIcon}'); mask-image: url('${copyIcon}')"></span>
      <span class="js-clipboard-success dui w-4 h-4 hidden" style="-webkit-mask-image: url('${checkIcon}'); mask-image: url('${checkIcon}')"></span>
    </button>
  </div>
</div>`,
        script: `(window.subscribeToDOMContentLoaded || function (fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); })(function () {
    const errorCard = document.getElementById("error-card");
    const header = document.getElementById("error-card-sticky-header");
    const sticky = header.offsetTop;

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
    }

    stickyHeader();

    window.onscroll = () => {
        stickyHeader();
    };
});`,
    };
};

export default stickyHeader;
