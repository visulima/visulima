const rawStackTrace = (stack?: string): string => `<section class="container bg-white dark:shadow-none dark:bg-gray-800/50 dark:bg-gradient-to-bl from-gray-700/50 via-transparent dark:ring-1 dark:ring-inset dark:ring-white/5 rounded-lg shadow-2xl shadow-gray-500/20 my-6">
    <main id="raw-stack-trace" class="p-6 prose prose-sm max-w-full">${stack}</main>
</section>`;

export default rawStackTrace;
