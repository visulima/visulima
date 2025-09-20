import { parseStacktrace } from "@visulima/error/stacktrace";
import { boxen } from "@visulima/boxen";
import type { RenderErrorOptions } from "@visulima/error/error";
import { renderError } from "@visulima/error/error";

import type { Solution, SolutionFinder } from "@visulima/error/solution";
import findLanguageBasedOnExtension from "./find-language-based-on-extension";
import getFileSource from "./get-file-source";
import { errorHintFinder, ruleBasedFinder } from "@visulima/error/solution";

type CliLogger = {
    error: (...arguments_: unknown[]) => void;
    log: (...arguments_: unknown[]) => void;
};

const sanitizeTitle = (title: string): string => title.replace(/^\s*#+\s*/, "").trim();

const runSolutionFinders = async (error: Error, solutionFinders: SolutionFinder[], debug: boolean = false): Promise<Solution | undefined> => {
    const candidates = [...solutionFinders, ruleBasedFinder, errorHintFinder];

    const firstTrace = (parseStacktrace(error, { frameLimit: 1 })[0] ?? {}) as { file?: string; line?: number };

    for await (const handler of candidates.sort((a, b) => a.priority - b.priority)) {
        const { handle, name: _name } = handler;

        if (debug) {
            // Debug: Running solution finder: ${name}
        }

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

export type BaseCliOptions = {
    solutionTitle?: string;
    solutionFinders?: SolutionFinder[];
    debug?: boolean;
} & Partial<Omit<RenderErrorOptions, "color">> & {
        color?: {
            codeFrame?: RenderErrorOptions["color"];
            boxen?: {
                headerTextColor?: ColorizeMethod;
                textColor?: ColorizeMethod;
                borderColor?: ColorizeMethod;
            };
        };
    };

export type CliHandlerOptions = BaseCliOptions & { logger?: CliLogger };

export const buildOutput = async (error: Error, options: BaseCliOptions): Promise<{ errorAnsi: string; solutionBox: undefined | string }> => {
    const { solutionFinders = [], solutionTitle, color, debug = false, ...renderOptions } = options;

    const errorAnsi = renderError(error, {
        ...renderOptions,
        ...color?.codeFrame,
    } as Partial<RenderErrorOptions>);

    const hint = await runSolutionFinders(error, solutionFinders, debug);

    if (!hint) {
        return { errorAnsi, solutionBox: undefined };
    }

    const header = sanitizeTitle(hint.header ?? solutionTitle ?? "A possible solution to this error");

    const solutionBox = boxen(hint.body, {
        borderStyle: "round",
        padding: { top: 1, right: 2, bottom: 1, left: 2 },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        headerText: `💡 ${header}`,
        headerAlignment: "left",
        textAlignment: "left",
        ...color?.boxen,
    });

    return {
        errorAnsi,
        solutionBox,
    };
};

export const terminalOutput = async (error: Error, options: CliHandlerOptions = {}): Promise<void> => {
    const { logger = console, ...rest } = options;

    const { errorAnsi, solutionBox } = await buildOutput(error, rest);

    logger.error(errorAnsi);
    
    if (solutionBox) {
        logger.log("");
        logger.log(solutionBox);
    }
};