import tooltip from "./tooltip";

const rawStackTrace = (stack?: string): string => {
    const { html: tooltipHtml } = tooltip({ message: `The orginal stack trace from the main error.` });

    return `<section class="mt-6">
    <h3 class="text-xl font-bold inline-flex justify-center items-center">Stack Trace</h3>
    ${tooltipHtml}
    <div class="container bg-white dark:shadow-none dark:bg-gray-800/50 dark:bg-gradient-to-bl from-gray-700/50 via-transparent dark:ring-1 dark:ring-inset dark:ring-white/5 rounded-lg shadow-2xl shadow-gray-500/20 my-6">
        <main id="raw-stack-trace" class="p-6 prose prose-sm max-w-full">${stack}</main>
    </div>
</section>`;
};

export default rawStackTrace;
