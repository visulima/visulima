import type { VisulimaError } from "@visulima/error/error";
// eslint-disable-next-line import/no-extraneous-dependencies
import checkIcon from "lucide-static/icons/check.svg?raw";
// eslint-disable-next-line import/no-extraneous-dependencies
import copyIcon from "lucide-static/icons/copy.svg?raw";
// eslint-disable-next-line import/no-extraneous-dependencies
import externalLinkIcon from "lucide-static/icons/external-link.svg?raw";

import type { SolutionError, SolutionFinder } from "../../../types";
import type { RuntimeName } from "../../../util/runtimes";
import solutions from "./solutions";
import stickyHeader from "./sticky-header";

const errorCard = async ({
    error,
    runtimeName,
    solutionFinders,
    version,
}: {
    error: Error | SolutionError | VisulimaError;
    runtimeName: RuntimeName | undefined;
    solutionFinders: SolutionFinder[];
    version: string | undefined;
}): Promise<{
    html: string;
    scripts: string[];
}> => {
    let runtime = `${runtimeName?.toUpperCase()} ${version ?? ""}`;

    if (runtime.includes("NODE")) {
        runtime = `<a href="https://nodejs.org/dist/latest-${version?.split(
            ".",
        )[0]}.x/docs/api/" class="text-blue-500 hover:underline inline-flex items-center text-sm" target="_blank" rel="noopener noreferrer">${runtime.replace(
            "NODE",
            "Node.js",
        )}<span class="dui ml-1" style="-webkit-mask-image: url('${externalLinkIcon}'); mask-image: url('${externalLinkIcon}')"></span></a>`;
    }

    const { html: solutionsHtml, script: solutionsScript } = await solutions(error, solutionFinders);
    const { html: stickyHeaderHtml, script: stickyHeaderScript } = stickyHeader(error);

    return {
        html: `<section id="error-card" class="container bg-white dark:shadow-none dark:bg-gray-800/50 dark:bg-linear-to-bl from-gray-700/50 via-transparent dark:ring-1 dark:ring-inset dark:ring-white/5 rounded-lg shadow-2xl shadow-gray-500/20">
    <div id="error-card" class="flex flex-row">
        <div class="flex flex-col gap-3 grow min-w-6/12 w-full px-4 py-2">
            <div class="flex flex-row items-center gap-2">
                <h1 class="text-lg font-semibold text-gray-500 dark:text-white bg-gray-100 dark:bg-gray-800/50 dark:ring-1 dark:ring-inset dark:ring-white/5 py-1 px-2">
                ${error.name}
                </h1>
                <button
                type="button"
                aria-label="Copy error title"
                title="Copy"
                class="js-clipboard cursor-pointer inline-flex items-center justify-center text-xs font-medium text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800/50 dark:ring-1 dark:ring-inset dark:ring-white/5 py-1 px-2 rounded"
                data-clipboard-text="${error.name}: ${(error as Error).message}"
                data-clipboard-success-text="Copied"
                >
                <span class="js-clipboard-default dui w-4 h-4" style="-webkit-mask-image: url('${copyIcon}'); mask-image: url('${copyIcon}')"></span>
                <span class="js-clipboard-success dui w-4 h-4 hidden" style="-webkit-mask-image: url('${checkIcon}'); mask-image: url('${checkIcon}')"></span>
                </button>
                <div class="grow"></div>
                <div class="text-sm font-semibold text-gray-500 dark:text-gray-400 py-1 px-2">
                ${runtime}
                </div>
            </div>
            <div class="text-lg font-semibold text-gray-600 dark:text-gray-400">
                ${error.message}
            </div>
        </div>
        ${solutionsHtml}
    </div>
</section>
${stickyHeaderHtml}`,
        scripts: [solutionsScript, stickyHeaderScript],
    };
};

export default errorCard;
