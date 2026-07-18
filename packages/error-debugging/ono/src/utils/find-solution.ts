import type { Trace } from "@visulima/error";
import { parseStacktrace } from "@visulima/error";
import type { Solution, SolutionError, SolutionFinder } from "@visulima/error/solution";
import { errorHintFinder, ruleBasedFinder } from "@visulima/error/solution";

import findLanguageBasedOnExtension from "../../../../../shared/utils/find-language-based-on-extension";
import getFileSource from "../../../../../shared/utils/get-file-source";
import process from "./process";

/**
 * Resolve the first matching solution for an error using the configured finders (plus the built-in
 * rule-based and error-hint finders). Finders are tried in descending priority order and the first hint
 * wins; finder errors are swallowed so a single bad finder never breaks rendering.
 *
 * Shared by both the JSON (`toJSON`) and HTML (error-card solutions panel) renderers so their
 * finder-resolution semantics — priority sort, first-trace context, snippet loading — stay in sync.
 */
const findSolution = async (error: Error | SolutionError, solutionFinders: SolutionFinder[] = []): Promise<Solution | undefined> => {
    const allFinders: SolutionFinder[] = [...solutionFinders, ruleBasedFinder, errorHintFinder];
    const firstTrace: Trace | undefined = parseStacktrace(error, { frameLimit: 1 })[0];

    for (const handler of allFinders.toSorted((a, b) => b.priority - a.priority)) {
        const { handle: solutionHandler, name } = handler;

        if (process.env?.DEBUG) {
            // eslint-disable-next-line no-console
            console.debug(`Running solution finder: ${name}`);
        }

        if (typeof solutionHandler !== "function") {
            continue;
        }

        try {
            // eslint-disable-next-line no-await-in-loop -- sequential: stop at first matching solution
            const hint = await solutionHandler(error, {
                file: firstTrace?.file ?? "",
                language: findLanguageBasedOnExtension(firstTrace?.file ?? ""),
                line: firstTrace?.line ?? 0,
                // eslint-disable-next-line no-await-in-loop -- sequential: stop at first matching solution
                snippet: firstTrace?.file ? await getFileSource(firstTrace.file) : "",
            });

            if (hint) {
                return hint;
            }
        } catch {
            continue;
        }
    }

    return undefined;
};

export default findSolution;
