import type { VisulimaError } from "@visulima/error/error";
import externalLinkIcon from "lucide-static/icons/external-link.svg";

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
        )}${(externalLinkIcon as string).replace("lucide-external-link", "lucide-external-link h-4 w-4 ml-1")}</a>`;
    }

    const { html: solutionsHtml, script: solutionsScript } = await solutions(error, solutionFinders);
    const { html: stickyHeaderHtml, script: stickyHeaderScript } = stickyHeader(error);

    return {
        html: `<section id="error-card" class="container bg-white dark:shadow-none from-gray-700/50 via-transparent rounded-lg shadow-2xl shadow-gray-500/20 mb-6">
    <div class="xl:flex items-stretch">
        <main id="error-card" class="z-10 flex-grow min-w-0">
        <div class="px-6 pt-6 flex flex-row">
            <h1 class="text-lg font-semibold text-gray-500 dark:text-white bg-gray-100 py-1 px-2">
            ${error.name}
            </h1>
            <div class="flex-grow"></div>
            <div class="text-sm font-semibold text-gray-500 dark:text-gray-400 py-1 px-2">
            ${runtime}
            </div>
        </div>
        <div class="px-6 pt-2 pb-6 text-lg font-semibold text-gray-600 dark:text-gray-400">
            ${error.message}
        </div>
        ${solutionsHtml}
        </main>
    </div>
</section>
${stickyHeaderHtml}`,
        scripts: [solutionsScript, stickyHeaderScript],
    };
};

export default errorCard;
