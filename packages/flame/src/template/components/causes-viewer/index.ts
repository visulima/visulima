import infoIcon from "lucide-static/icons/info.svg";

import stackTraceViewer from "../stack-trace-viewer";

const causes = async (causes: any[]): Promise<string> => {
    if (causes.length === 0) {
        return "";
    }

    let content = [];

    for await (const [index, cause] of causes.entries()) {
        if (cause instanceof Error) {
            content.push(`<div id="hs-active-cause-${index}" class="hs-accordion hs-accordion-active:border-gray-200 bg-white border border-transparent rounded-xl dark:hs-accordion-active:border-gray-700 dark:bg-gray-800 dark:border-transparent mb-2 last:mb-0 dark:shadow-none shadow-2xl shadow-gray-500/20">
    <button aria-controls="hs-cause-collapse-${index}" class="hs-accordion-toggle hs-accordion-active:text-blue-600 inline-flex justify-between items-center gap-x-3 w-full font-semibold text-start text-gray-800 py-4 px-5 hover:text-gray-500 disabled:opacity-50 disabled:pointer-events-none dark:hs-accordion-active:text-blue-500 dark:text-gray-200 dark:hover:text-gray-400 dark:focus:outline-none dark:focus:text-gray-400">
      ${cause.name}: ${cause.message}
      <svg class="hs-accordion-active:hidden block w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
      <svg class="hs-accordion-active:block hidden w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>
    </button>
    <div id="hs-cause-collapse-${index}" class="hs-accordion-content hidden w-full overflow-hidden transition-[height] duration-300" aria-labelledby="hs-active-cause-${index}">
      ${await stackTraceViewer(cause)}
    </div>
</div>`);
        } else if (typeof cause === "string") {
            content.push(
                `<div class="container bg-white dark:shadow-none from-gray-700/50 via-transparent rounded-lg shadow-2xl shadow-gray-500/20 mt-2 py-4 px-5">${cause}</div>`,
            );
        } else if (Array.isArray(cause)) {
            // TODO: Add Array Support
            content.push(
                `<div class="container bg-white dark:shadow-none from-gray-700/50 via-transparent rounded-lg shadow-2xl shadow-gray-500/20 mt-2 py-4 px-5">${JSON.stringify(cause)}</div>`,
            );
        } else {
            content.push(
                `<div class="container bg-white dark:shadow-none from-gray-700/50 via-transparent rounded-lg shadow-2xl shadow-gray-500/20 mt-2 py-4 px-5">${JSON.stringify(cause)}</div>`,
            );
        }
    }

    return `<section class="w-full mt-6">
    <div>
        <h3 class="text-xl font-bold inline-flex justify-center items-center">Error causes</h3>
        <div class="hs-tooltip inline-block [--placement:right]">
          <button type="button" class="hs-tooltip-toggle inline-flex justify-center items-center gap-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white">
            <img src="${infoIcon}" alt="Info" class="w-4 h-4" />
            <span class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity inline-block absolute invisible z-10 py-1 px-2 bg-gray-900 text-xs font-medium text-white rounded shadow-sm dark:bg-slate-700" role="tooltip">
              The cause data property of an Error instance indicates the specific original cause of the error.</br></br>
              All causes in the error are order in the way they occurred.
            </span>
          </button>
        </div>
    </div>
    <div class="hs-accordion-group mt-6">${content.join("\n")}</div>
</section>`;
};

export default causes;
