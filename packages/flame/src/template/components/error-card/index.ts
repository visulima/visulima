import type { VisulimaError } from "@visulima/error/error";
// eslint-disable-next-line import/no-extraneous-dependencies
import externalLinkIcon from "lucide-static/icons/external-link.svg?raw";

import type { SolutionError, SolutionFinder } from "../../../types";
import type { RuntimeName } from "../../../util/runtimes";
import solutions from "./solutions";
import stickyHeader from "./sticky-header";
import copyButton from "../copy-button";

// Utility function to properly encode SVG content for CSS mask-image
const svgToDataUrl = (svgContent: string): string => {
    // Remove HTML comments and clean up the SVG content
    const cleanSvg = svgContent
        .replace(/<!--[\s\S]*?-->/g, "") // Remove HTML comments
        .replace(/\s+/g, " ") // Normalize whitespace
        .trim();

    // Encode for use in CSS url()
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cleanSvg)}`;
};

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
        runtime = `<a href="https://nodejs.org/dist/latest-${
            version?.split(".")[0]
        }.x/docs/api/" class="text-blue-500 hover:underline inline-flex items-center text-sm" target="_blank" rel="noopener noreferrer">${runtime.replace(
            "NODE",
            "Node.js",
        )}<span class="dui ml-1" style="-webkit-mask-image: url('${svgToDataUrl(externalLinkIcon)}'); mask-image: url('${svgToDataUrl(externalLinkIcon)}')"></span></a>`;
    }

    const { html: solutionsHtml, script: solutionsScript } = await solutions(error, solutionFinders);
    const { html: stickyHeaderHtml, script: stickyHeaderScript } = stickyHeader(error);

    return {
        html: `<section id="error-card" class="container bg-white dark:shadow-none dark:bg-gray-800/50 dark:bg-linear-to-bl from-gray-700/50 via-transparent dark:ring-1 dark:ring-inset dark:ring-white/5 rounded-lg shadow-2xl shadow-gray-500/20">
    <input type="hidden" id="clipboard-error-title" value="${error.name}: ${(error as Error).message}">
    <div id="error-card" class="flex flex-row">
        <div class="flex flex-col gap-3 grow min-w-6/12 w-full p-6 pt-5">
            <div class="flex flex-row items-center gap-2">
                <h1 class="text-lg font-semibold text-gray-500 dark:text-white bg-gray-100 dark:bg-gray-800/50 dark:ring-1 dark:ring-inset dark:ring-white/5 py-1 px-2">
                ${error.name}
                </h1>
                ${copyButton({ targetId: "clipboard-error-title", label: "Copy error title" })}
                <div class="grow"></div>
                <div class="text-sm font-semibold text-gray-500 dark:text-gray-400 py-1 px-2">
                ${runtime}
                </div>
            </div>
            <div class="text-md font-semibold text-gray-600 dark:text-gray-400">
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
