import type { VisulimaError, Trace } from "@visulima/error/error";
import { parseStacktrace } from "@visulima/error/stacktrace";
import { parse } from "marked";
import sanitizeHtml from "sanitize-html";

import errorHintFinder from "../../../solution/error-hint-finder";
import type { Solution, SolutionError, SolutionFinder } from "../../../types";
import debugLog from "../../../util/debug-log";
import findLanguageBasedOnExtension from "../../../util/find-language-based-on-extension";
import getFileSource from "../../../util/get-file-source";

const solutions = async (error: Error | SolutionError | VisulimaError, solutionFinders: SolutionFinder[]): Promise<string> => {
    let hint: Solution | undefined;

    solutionFinders.push(errorHintFinder);

    const trace = parseStacktrace(error, {
        frameLimit: 1,
    })[0] as Trace;

    for await (const handler of solutionFinders.sort((a, b) => a.priority - b.priority)) {
        if (hint) {
            break;
        }

        const { handle: solutionHandler, name } = handler;

        debugLog(`Running solution finder: ${name}`);

        if (typeof solutionHandler !== "function") {
            continue;
        }

        hint = await solutionHandler(error, {
            file: trace.file as string,
            language: findLanguageBasedOnExtension(trace.file),
            line: trace.line,
            snippet: await getFileSource(trace.file),
        });
    }

    if (!hint) {
        return "";
    }

    return `
    <div class="px-6 pb-6">
        <div class="bg-green-300 dark:bg-gray-700/50 dark:bg-gradient-to-bl from-gray-700/50 via-transparent dark:ring-1 dark:ring-inset dark:ring-white/5 rounded-lg shadow-2xl shadow-gray-500/20">
            <div class="px-4 py-5 sm:p-6">
                <div class="text-lg font-semibold text-gray-900 dark:text-white">${
                    hint.header ? `${sanitizeHtml(await parse(hint.header))}` : "A possible solution to this error"
                }</div>
                <div class="mt-2 max-w-xl text-sm font-medium">
                    ${sanitizeHtml(await parse(hint.body))}
                </div>
            </div>
        </div>
    </div>`;
};

export default solutions;
