import { codeFrame, parseStacktrace } from "@visulima/error";
import type { VisulimaError } from "@visulima/error/error";
import type { SolutionError, SolutionFinder } from "@visulima/error/solution";
import aiPrompt from "@visulima/error/solution/ai/prompt";
// eslint-disable-next-line import/no-extraneous-dependencies
import externalLinkIcon from "lucide-static/icons/external-link.svg?data-uri&encoding=css";

import findLanguageBasedOnExtension from "../../../../../../shared/utils/find-language-based-on-extension";
import getFileSource from "../../../../../../shared/utils/get-file-source";
import type { RuntimeName } from "../../../util/runtimes";
import { sanitizeAttr as sanitizeAttribute, sanitizeHtml } from "../../util/sanitize";
import copyDropdown from "../copy-dropdown";
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
        runtime = `<a href="https://nodejs.org/dist/latest-${
            version?.split(".")[0]
        }.x/docs/api/" class="text-blue-500 hover:underline inline-flex items-center text-sm" target="_blank" rel="noopener noreferrer">${runtime.replace(
            "NODE",
            "Node.js",
        )}<span class="dui ml-1" style="-webkit-mask-image: url('${externalLinkIcon}'); mask-image: url('${externalLinkIcon}')"></span></a>`;
    }

    const { html: solutionsHtml, script: solutionsScript } = await solutions(error, solutionFinders);
    const { html: stickyHeaderHtml, script: stickyHeaderScript } = await stickyHeader(error);

    const safeName = sanitizeHtml(error.name);
    const safeMessage = sanitizeHtml((error as Error).message);
    const safeTitleValue = sanitizeAttribute(`${error.name}: ${(error as Error).message}`);

    // Build AI prompt using first stack frame and code frame when available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trace = parseStacktrace(error as Error, { frameLimit: 1 })?.[0] as any;
    const filePath = trace?.file ?? "";
    const fileLine = trace?.line ?? 0;
    const fileSource = filePath ? await getFileSource(filePath) : "";
    const snippet = fileSource
        ? codeFrame(fileSource, { start: { column: trace?.column, line: fileLine } }, { linesAbove: 9, linesBelow: 10, showGutter: true })
        : "";
    const fixPrompt = aiPrompt({
        applicationType: undefined,
        error: error as Error,
        file: {
            file: filePath,
            language: findLanguageBasedOnExtension(filePath),
            line: fileLine,
            snippet,
        },
    });

    return {
        html: `<section id="error-card" class="container rounded-[var(--flare-radius-lg)] shadow-[var(--flare-elevation-2)] bg-[var(--flare-surface)]">
    <input type="hidden" id="clipboard-error-title" value="${safeTitleValue}">
    <div class="flex flex-row">
        <div class="flex flex-col gap-3 grow min-w-6/12 w-full p-6 pt-5">
            <div class="flex flex-row items-center gap-2">
                <h1 class="text-lg font-semibold py-1 px-2 text-[var(--flare-chip-text)] bg-[var(--flare-chip-bg)] rounded-[var(--flare-radius-md)] shadow-[var(--flare-elevation-1)]">
                ${safeName}
                </h1>
                ${copyDropdown({ label: "Copy error title", secondaryLabel: "Copy fix prompt", secondaryText: fixPrompt, targetId: "clipboard-error-title" })}
                <div class="grow"></div>
                <div class="text-sm font-semibold py-1 px-2 text-[var(--flare-text-muted)] rounded-[var(--flare-radius-md)] shadow-[var(--flare-elevation-1)]">
                ${runtime}
                </div>
            </div>
            <div class="text-md font-semibold text-[var(--flare-text)]">
                ${safeMessage}
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
