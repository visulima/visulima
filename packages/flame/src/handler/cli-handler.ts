import { parseStacktrace } from "@visulima/error/stacktrace";
import { boxen } from "@visulima/boxen";
import { renderError, type RenderErrorOptions } from "@visulima/error/error";

import type { Solution, SolutionFinder } from "../types";
import debugLog from "../util/debug-log";
import findLanguageBasedOnExtension from "../util/find-language-based-on-extension";
import getFileSource from "../util/get-file-source";
import errorHintFinder from "../solution/error-hint-finder";
import ruleBasedFinder from "../solution/rule-based-finder";

type CliLogger = {
    error: (...arguments_: unknown[]) => void;
    log: (...arguments_: unknown[]) => void;
    warn: (...arguments_: unknown[]) => void;
};

const sanitizeTitle = (title: string): string => title.replace(/^\s*#+\s*/, "").trim();

const runSolutionFinders = async (error: Error, solutionFinders: SolutionFinder[]): Promise<Solution | undefined> => {
    const candidates = [...solutionFinders, ruleBasedFinder, errorHintFinder];

    const firstTrace = (parseStacktrace(error, { frameLimit: 1 })[0] ?? {}) as { file?: string; line?: number };

    for await (const handler of candidates.sort((a, b) => a.priority - b.priority)) {
        const { handle, name } = handler;

        debugLog(`Running solution finder: ${name}`);

        if (typeof handle !== "function") {
            continue;
        }

        const hint = await handle(error, {
            file: firstTrace.file ?? "",
            language: findLanguageBasedOnExtension(firstTrace.file ?? ""),
            line: firstTrace.line ?? 0,
            snippet: firstTrace.file ? await getFileSource(firstTrace.file) : "",
        });

        if (hint) {
            return hint;
        }
    }

    return undefined;
};

type ColorizeMethod = (value: string) => string;

const cliDisplayer = async (
    error: Error,
    options: {
        solutionTitle?: string;
        solutionFinders?: SolutionFinder[];
        logger?: CliLogger;
    } & Partial<Omit<RenderErrorOptions, "color">> & {
            color?: {
                codeFrame?: RenderErrorOptions["color"];
                boxen?: {
                    headerTextColor?: ColorizeMethod;
                    textColor?: ColorizeMethod;
                    borderColor?: ColorizeMethod;
                };
            };
        } = {},
): Promise<void> => {
    const { solutionFinders = [], logger = console, solutionTitle, color, ...renderOptions } = options;

    logger.error(
        renderError(error, {
            ...renderOptions,
            ...color?.codeFrame,
        } as RenderErrorOptions),
    );

    const hint = await runSolutionFinders(error, solutionFinders);
    if (!hint) {
        return;
    }

    logger.log("");

    const header = sanitizeTitle(hint.header ?? solutionTitle ?? "A possible solution to this error");

    logger.log(
        boxen(hint.body, {
            borderStyle: "round",
            padding: { top: 1, right: 2, bottom: 1, left: 2 },
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
            headerText: `💡 ${header}`,
            headerAlignment: "left",
            textAlignment: "left",
            ...color?.boxen,
        }),
    );
};

export default cliDisplayer;
