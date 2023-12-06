import infoIcon from "lucide-static/icons/info.svg";

const rawStackTrace = (stack?: string): string => `<section class="mt-6">
    <h3 class="text-xl font-bold inline-flex justify-center items-center">Stack Trace</h3>
    <div class="hs-tooltip inline-block [--placement:right]">
        <button type="button" class="hs-tooltip-toggle inline-flex justify-center items-center gap-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white">
            ${(infoIcon as string).replace("lucide-info", "lucide-info w-4 h-4")}
            <span class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity inline-block absolute invisible z-10 py-1 px-2 bg-gray-900 text-xs font-medium text-white rounded shadow-sm dark:bg-slate-700" role="tooltip">
              The orginal stack trace from the main error.
            </span>
        </button>
    </div>
    <div class="container bg-white dark:shadow-none dark:bg-gray-800/50 dark:bg-gradient-to-bl from-gray-700/50 via-transparent dark:ring-1 dark:ring-inset dark:ring-white/5 rounded-lg shadow-2xl shadow-gray-500/20 my-6">
        <main id="raw-stack-trace" class="p-6 prose prose-sm max-w-full">${stack}</main>
    </div>
</section>`;

export default rawStackTrace;
