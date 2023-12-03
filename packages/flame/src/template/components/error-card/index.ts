import type { RuntimeName } from "../../../util/runtimes";
import solutions from "./solutions";
import type { Hint } from "../../../types";

const errorCard = ({
    hint,
    message,
    runtimeName,
    title,
    version,
}: {
    hint?: Hint | undefined;
    message: string;
    runtimeName: RuntimeName | undefined;
    title: string;
    version: string | undefined;
}): string => `
    <section class="container bg-white dark:shadow-none dark:bg-gray-800/50 dark:bg-gradient-to-bl from-gray-700/50 via-transparent dark:ring-1 dark:ring-inset dark:ring-white/5 rounded-lg shadow-2xl shadow-gray-500/20">
        <div class="xl:flex items-stretch">
            <main id="error-card" class="z-10 flex-grow min-w-0">
                <div class="px-6 pt-6 flex flex-row">
                    <h1 class="text-lg font-semibold text-gray-500 dark:text-white bg-gray-100 py-1 px-2">
                        ${title}
                    </h1>
                    <div class="flex-grow"></div>
                    <div class="text-sm font-semibold text-gray-500 dark:text-gray-400 py-1 px-2">
                        ${runtimeName?.toUpperCase()} ${version}
                    </div>
                </div>
                <div class="px-6 pt-2 pb-6 text-lg font-semibold text-gray-600 dark:text-gray-400">
                    ${message}
                </div>
                ${solutions(hint)}
            </main>
        </div>
    </section>
    `;

export default errorCard;
