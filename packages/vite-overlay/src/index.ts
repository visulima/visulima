import { getErrorCauses } from "@visulima/error/error";
import type { Solution, SolutionFinder } from "@visulima/error/solution";
import { errorHintFinder, ruleBasedFinder } from "@visulima/error/solution";
import DOMPurify from "dompurify";
// eslint-disable-next-line import/no-extraneous-dependencies
import { parse } from "marked";
import type { IndexHtmlTransformResult, Plugin, PluginOption, TransformOptions, ViteDevServer, WebSocketClient } from "vite";

import { terminalOutput } from "../../../shared/utils/cli-error-builder";
import findLanguageBasedOnExtension from "../../../shared/utils/find-language-based-on-extension";
import { DEFAULT_ERROR_MESSAGE, DEFAULT_ERROR_NAME, MESSAGE_TYPE, PLUGIN_NAME, RECENT_ERROR_TTL_MS } from "./constants";
import { patchOverlay } from "./overlay/patch-overlay";
import type { DevelopmentLogger, ExtendedError, RawErrorData, RecentErrorTracker, VisulimaViteOverlayErrorPayload, ViteErrorData } from "./types";
import buildExtendedErrorData from "./utils/error-processing";
import enhanceViteSsrError from "./utils/ssr-error-enhancer";
import { absolutizeStackUrls, cleanErrorStack } from "./utils/stack-trace-utils";
import createViteSolutionFinder from "./utils/vite-solution-finder";

/**
 * Logs an error using the Vite dev server's logger with a prefix.
 * @param server The Vite dev server instance
 * @param prefix The prefix to prepend to the error message
 * @param error The error to log
 */
const logError = (server: ViteDevServer, prefix: string, error: unknown): void => {
    try {
        const message = error instanceof Error ? error.message : String(error);

        server.config.logger.error(`${prefix}: ${message}`, { clear: true, timestamp: true });
    } catch {
        // Silent fallback if logging fails
    }
};

/**
 * Creates a development logger that wraps the Vite dev server's logger.
 * @param server The Vite dev server instance
 * @returns A development logger interface
 */
const createDevelopmentLogger = (server: ViteDevServer): DevelopmentLogger => {
    return {
        error: (message: unknown) =>
            server.config.logger.error(String(message ?? ""), {
                clear: true,
                timestamp: true,
            }),
        log: (message: unknown) => server.config.logger.info(String(message ?? "")),
    };
};

/**
 * Creates a tracker for recent errors to prevent duplicate error reporting.
 * @returns An object containing recent errors map and shouldSkip function
 */
const createRecentErrorTracker = (): RecentErrorTracker => {
    const recentErrors = new Map<string, number>();

    /**
     * Checks if an error signature should be skipped based on recent occurrence.
     * @param signature The error signature to check
     * @returns True if the error should be skipped
     */
    const shouldSkip = (signature: string): boolean => {
        const now = Date.now();
        const lastOccurrence = recentErrors.get(signature) || 0;

        if (now - lastOccurrence < RECENT_ERROR_TTL_MS) {
            return true;
        }

        recentErrors.set(signature, now);

        return false;
    };

    return { recentErrors, shouldSkip };
};

/**
 * Creates a signature string from an error for deduplication purposes.
 * @param raw The error object or raw error data
 * @returns A string signature combining message and stack
 */
const createErrorSignature = (raw: Error | RawErrorData): string => `${String(raw?.message || "")}\n${String(raw?.stack || "")}`;

/**
 * Processes a runtime error by cleaning its stack trace and outputting it to the terminal.
 * @param runtimeError The runtime error to process
 * @param rootPath The root path of the project
 * @param developmentLogger The development logger to use
 */
const processRuntimeError = async (runtimeError: Error, rootPath: string, developmentLogger: DevelopmentLogger): Promise<void> => {
    try {
        runtimeError.stack = absolutizeStackUrls(cleanErrorStack(String(runtimeError.stack || "")), rootPath);
    } catch {
        // Ignore stack cleaning errors
    }

    await terminalOutput(runtimeError, { logger: developmentLogger });
};

/**
 * Creates a handler for unhandled promise rejections.
 * @param server The Vite dev server instance
 * @param rootPath The root path of the project
 * @param developmentLogger The development logger to use
 * @returns A function that handles unhandled rejections
 */
const createUnhandledRejectionHandler = (server: ViteDevServer, rootPath: string, developmentLogger: DevelopmentLogger) => async (reason: unknown) => {
    const runtimeError = reason instanceof Error ? reason : new Error(String((reason as any)?.stack || reason));

    try {
        server.ssrFixStacktrace(runtimeError as any);
    } catch (error) {
        logError(server, "[visulima:vite-overlay:server] ssrFixStacktrace failed", error);
    }

    try {
        const enhanced = await enhanceViteSsrError(runtimeError, server);

        Object.assign(runtimeError, enhanced);
    } catch (error) {
        logError(server, "[visulima:vite-overlay:server] enhanceViteSsrError failed", error);
    }

    try {
        runtimeError.stack = absolutizeStackUrls(cleanErrorStack(String(runtimeError.stack || "")), rootPath);
    } catch {
        // Ignore stack cleaning errors
    }

    await terminalOutput(runtimeError, { logger: developmentLogger });
    server.ws.send({ err: runtimeError, type: "error" } as any);
};

/**
 * Finds a solution for an error by running through available solution finders.
 * @param error The extended error to find a solution for
 * @param solutionFinders Array of solution finder handlers
 * @param rootPath The root path of the project
 * @returns A solution object if found, undefined otherwise
 */
const findSolution = async (error: ExtendedError, solutionFinders: SolutionFinder[], rootPath: string): Promise<Solution | undefined> => {
    let hint: Solution | undefined;

    solutionFinders.push(errorHintFinder, createViteSolutionFinder(rootPath), ruleBasedFinder);

    for await (const handler of solutionFinders.toSorted((a, b) => b.priority - a.priority)) {
        const { handle: solutionHandler, name } = handler;

        if (process.env.DEBUG) {
            // eslint-disable-next-line no-console
            console.debug(`Running solution finder: ${name}`);
        }

        if (typeof solutionHandler !== "function") {
            continue;
        }

        try {
            const result = await solutionHandler(
                {
                    hint: error?.hint ?? "",
                    message: error.message,
                    name: error.name,
                    stack: error?.stack,
                },
                {
                    file: error?.originalFilePath ?? "",
                    language: findLanguageBasedOnExtension(error?.originalFilePath ?? ""),
                    line: error?.originalFileLine ?? 0,
                    snippet: error?.originalSnippet ?? "",
                },
            );

            if (result === undefined) {
                continue;
            }

            const parsedHeader = (await parse(result.header ?? "")) as string;
            const parsedBody = (await parse(result.body ?? "")) as string;

            hint = {
                body: parsedBody,
                header: parsedHeader,
            };

            break;
        } catch {
            continue;
        }
    }

    return hint;
};

/**
 * Builds extended error data by processing all error causes and finding solutions.
 * @param rawError The original error to process
 * @param server The Vite dev server instance
 * @param rootPath The root path of the project
 * @param viteErrorData Additional Vite-specific error data
 * @param errorType The type of error (client or server)
 * @param solutionFinders Array of solution finder handlers
 * @returns A comprehensive error payload with all processed errors and solutions
 */
const buildExtendedError = async (
    rawError: Error,
    server: ViteDevServer,
    rootPath: string,
    viteErrorData: ViteErrorData | undefined,
    errorType: "client" | "server",
    solutionFinders: SolutionFinder[],
): Promise<VisulimaViteOverlayErrorPayload> => {
    const allErrors = getErrorCauses(rawError);

    if (allErrors.length === 0) {
        throw new Error("No errors found in the error stack");
    }

    const extendedErrors = await Promise.all(
        allErrors.map(async (error, index) => {
            let causeViteErrorData = viteErrorData;

            if (index > 0) {
                const stackLines = error?.stack?.split("\n") || [];
                const firstStackLine = stackLines.find((line) => line.includes("at ") && !line.includes("node_modules"));

                if (firstStackLine) {
                    const match = firstStackLine.match(/at\s+[^(\s]+\s*\(([^:)]+):(\d+):(\d+)\)/) || firstStackLine.match(/at\s+([^:)]+):(\d+):(\d+)/);

                    if (match) {
                        const [, file, line, col] = match;

                        causeViteErrorData = {
                            column: Number.parseInt(col || "0", 10),
                            file,
                            line: Number.parseInt(line || "0", 10),
                            plugin: viteErrorData?.plugin,
                        };
                    }
                }
            }

            let enhancedViteErrorData = causeViteErrorData;

            if (index === 0 && (error as any)?.sourceFile) {
                enhancedViteErrorData = {
                    ...causeViteErrorData,
                    file: (error as any).sourceFile,
                };
            }

            const extendedData = await buildExtendedErrorData(error, server, enhancedViteErrorData, allErrors, index);

            return {
                hint: error?.hint,
                message: error?.message || "",
                name: error?.name || DEFAULT_ERROR_NAME,
                stack: absolutizeStackUrls(cleanErrorStack(error?.stack || ""), rootPath),
                ...extendedData,
            };
        }),
    );

    const solution = await findSolution(extendedErrors[0] as ExtendedError, solutionFinders, rootPath);

    return {
        errors: extendedErrors,
        errorType,
        rootPath,
        solution,
    } as VisulimaViteOverlayErrorPayload;
};

/**
 * Generates the client-side script for error interception and reporting.
 * @param mode The current Vite mode (development/production)
 * @param isReact Whether the project is using React
 * @returns The client-side JavaScript code as a string
 */
const generateClientScript = (mode: string, isReact: boolean): string => {
    const reactLogger = String.raw`var orig = console.error;

console.error = function() {
    function parseConsoleArgs(args) {
        if (
            args.length > 3 &&
            typeof args[0] === 'string' &&
            args[0].startsWith('%c%s%c') &&
            typeof args[1] === 'string' &&
            typeof args[2] === 'string' &&
            typeof args[3] === 'string'
        ) {
            const environmentName = args[2]
            const maybeError = args[4]

            return {
                environmentName: environmentName.trim(),
                error: isError(maybeError) ? maybeError : null,
            }
        }

        return {
            environmentName: null,
            error: null,
        }
    }

    function isError(err) {
        return typeof err === 'object' && err !== null && 'name' in err && 'message' in err;
    }

    try {
        if (${mode} !== 'production') {
            const { error: replayedError } = parseConsoleArgs(args)

            if (replayedError) {
                maybeError = replayedError
            } else if ((args[isError0])) {
                maybeError = args[0]
            } else {
                maybeError = args[1]
            }
        } else {
            maybeError = args[0]
        }

        if (maybeError) {
            sendError(maybeError);
        }
    } catch {}

    return orig.apply(console, arguments);
}`;

    return String.raw`
 import { createHotContext } from '/@vite/client';

 const hot = createHotContext('/@visulima/vite-overlay');

async function sendError(error, loc) {
    if (!(error instanceof Error)) {
        error = new Error("(unknown runtime error)");
    }

    var ownerStack = null;

    try {
        var mod = await import('react');

        if (mod && typeof mod.captureOwnerStack === 'function') {
            ownerStack = mod.captureOwnerStack();
        }
    } catch {}


    function extractCauseChain(err) {
        if (!err || !err.cause) {
            return null;
        }

        var current = err.cause;
        var rootCause = {
            name: current.name || null,
            message: current.message || null,
            stack: current.stack || null,
            cause: null
        };

        var currentNested = rootCause;
        current = current.cause;

        while (current) {
            currentNested.cause = {
                name: current.name || null,
                message: current.message || null,
                stack: current.stack || null,
                cause: null
            };
            currentNested = currentNested.cause;
            current = current.cause;
        }

        return rootCause;
    }

    var causeChain = extractCauseChain(error);

    hot.send('${MESSAGE_TYPE}', {
        name: error?.name || null,
        message: error.message,
        stack: error.stack,
        cause: causeChain,
        ownerStack,
        file: loc?.filename || null,
        line: loc?.lineno || null,
        column: loc?.colno || null
    });
}

window.addEventListener("error", function (evt) {
    sendError(evt.error, { filename: evt.filename, lineno: evt.lineno, colno: evt.colno });
});

window.addEventListener("unhandledrejection", function (evt) {
    sendError(evt.reason);
});

window.__flameSendError = sendError;

${isReact ? reactLogger : ""}
`;
};

/**
 * Reconstructs an error object from cause chain data received from the client.
 * @param causeData The cause data object from the client
 * @returns A reconstructed Error object with cause chain
 */
const reconstructCauseChain = (causeData: any): Error | null => {
    if (!causeData) {
        return null;
    }

    const causeError = new Error(String(causeData.message || "Caused by error"));

    causeError.name = String(causeData.name || "Error");
    causeError.stack = String(causeData.stack || "");

    if (causeData.cause) {
        causeError.cause = reconstructCauseChain(causeData.cause);
    }

    return causeError;
};

/**
 * Sets up WebSocket message interception to handle error data from the client.
 * @param server The Vite dev server instance
 * @param shouldSkip Function to check if an error should be skipped
 * @param recentErrors Map of recent error signatures
 * @param rootPath The root path of the project
 * @param solutionFinders Array of solution finder handlers
 */
const setupWebSocketInterception = (
    server: ViteDevServer,
    shouldSkip: (signature: string) => boolean,
    recentErrors: Map<string, number>,
    rootPath: string,
    solutionFinders: SolutionFinder[],
): void => {
    const originalSend = server.ws.send.bind(server.ws);

    // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-explicit-any
    server.ws.send = async (data: any, client?: any): Promise<void> => {
        try {
            if (data && typeof data === "object" && data.type === "error" && data.err) {
                const { err } = data;
                const rawSig = createErrorSignature(err);

                if (shouldSkip(rawSig)) {
                    return;
                }

                if (err.message?.includes("Failed to resolve import")) {
                    const match = err.message.match(/Failed to resolve import ["']([^"']+)["'] from ["']([^"']+)["']/);

                    if (match) {
                        const sourceFile = match[2];
                        const importError = new Error(err.message);

                        importError.name = "ImportResolutionError";
                        importError.stack = err.stack;

                        const extensionPayload = await buildExtendedError(
                            importError,
                            server,
                            rootPath,
                            {
                                column: err.loc?.column || 1,
                                file: sourceFile,
                                line: err.loc?.line || 1,
                                plugin: err.plugin || "vite:import-analysis",
                            },
                            "server",
                            solutionFinders,
                        );

                        // eslint-disable-next-line no-param-reassign
                        data.err = extensionPayload;

                        recentErrors.set(JSON.stringify(extensionPayload), Date.now());
                    }
                } else {
                    const name = String(err?.name || "Error");
                    const message = String(err.message);
                    const rawStack = String(err.stack);

                    const syntaicError = new Error(message);

                    syntaicError.name = name;
                    syntaicError.stack = `${name}: ${message}\n${absolutizeStackUrls(rawStack, rootPath)}`;

                    if (err.cause) {
                        syntaicError.cause = reconstructCauseChain(err.cause);
                    }

                    const viteErrorData = err.sourceFile
                        ? {
                            column: err.column,
                            file: err.sourceFile,
                            line: err.line,
                            plugin: err.plugin,
                        }
                        : undefined;

                    const extensionPayload = await buildExtendedError(syntaicError, server, rootPath, viteErrorData, "server", solutionFinders);

                    data.err = extensionPayload;

                    recentErrors.set(JSON.stringify(extensionPayload), Date.now());
                }
            }

            originalSend(data, client);
        } catch (error) {
            logError(server, "[visulima:vite-overlay:server] ws.send intercept failed", error);

            client.send(data, client);
        }
    };
};

/**
 * Sets up HMR (Hot Module Replacement) handler for client-side error messages.
 * @param server The Vite dev server instance
 * @param developmentLogger The development logger to use
 * @param shouldSkip Function to check if an error should be skipped
 * @param recentErrors Map of recent error signatures
 * @param rootPath The root path of the project
 * @param solutionFinders Array of solution finder handlers
 */
const setupHMRHandler = (
    server: ViteDevServer,
    developmentLogger: DevelopmentLogger,
    shouldSkip: (signature: string) => boolean,
    recentErrors: Map<string, number>,
    rootPath: string,
    solutionFinders: SolutionFinder[],
): void => {
    server.ws.on(MESSAGE_TYPE, async (data: unknown, client: WebSocketClient) => {
        const raw
            = data && typeof data === "object"
                ? (data as RawErrorData)
                : ({
                    message: DEFAULT_ERROR_MESSAGE,
                    stack: "",
                } as RawErrorData);

        const rawSig = createErrorSignature(raw);

        if (shouldSkip(rawSig)) {
            return;
        }

        const name = String(raw?.name || "Error");
        const message = String(raw.message);
        const rawStack = String(raw.stack);

        const syntaicError = new Error(message);

        syntaicError.name = name;
        syntaicError.stack = `${name}: ${message}\n${absolutizeStackUrls(rawStack, rootPath)}`;

        if (raw.cause) {
            syntaicError.cause = reconstructCauseChain(raw.cause);
        }

        try {
            await processRuntimeError(syntaicError, rootPath, developmentLogger);

            const extensionPayload = await buildExtendedError(
                syntaicError,
                server,
                rootPath,
                {
                    column: raw?.column,
                    file: raw?.file,
                    line: raw?.line,
                    plugin: raw?.plugin,
                } as ViteErrorData,
                "client",
                solutionFinders,
            );

            recentErrors.set(JSON.stringify(extensionPayload), Date.now());

            const payload: any = { err: extensionPayload, type: "error" };

            if (extensionPayload.solution) {
                payload.solutions = extensionPayload.solution;
            }

            client.send(payload);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            logError(server, "[visulima:vite-overlay:server] failed to build extended client error", error);

            client.send({
                err: {
                    message: error.message,
                    name: String(error.name || DEFAULT_ERROR_NAME),
                    stack: error.stack,
                },
                type: "error",
            });
        }
    });
};

/**
 * Checks if the Vite configuration includes a React plugin.
 * @param plugins Array of Vite plugins to check
 * @param reactPluginName Optional custom React plugin name to look for
 * @returns True if a React plugin is found
 */
const hasReactPlugin = (plugins: PluginOption[], reactPluginName?: string): boolean =>
    plugins
        .flat()
        .some(
            (plugin) =>
                plugin
                && ((reactPluginName && (plugin as Plugin).name === reactPluginName)
                    || (plugin as Plugin).name === "vite:react"
                    || (plugin as Plugin).name === "@vitejs/plugin-react"
                    || (typeof plugin === "function" && (plugin as Plugin).name?.includes("react"))
                    || ((plugin as Plugin).constructor && (plugin as Plugin).constructor.name?.includes("React"))),
        );

/**
 * Main Vite plugin for error overlay functionality.
 * Intercepts runtime errors and displays them in a user-friendly overlay.
 * @param options Plugin configuration options
 * @param options.logRuntimeError Whether to log runtime errors (optional)
 * @param options.reactPluginName Custom React plugin name (optional)
 * @param options.solutionFinders Custom solution finders (optional)
 * @returns The Vite plugin configuration
 */
const errorOverlayPlugin = (options: { logRuntimeError?: boolean; reactPluginName?: string; solutionFinders?: SolutionFinder[] }): Plugin => {
    let mode: string;
    let isReactProject: boolean;

    return {
        apply: "serve",

        config(config, environment) {
            if (config.plugins) {
                isReactProject = hasReactPlugin(config.plugins, options?.reactPluginName);
            }

            mode = environment.mode || "development";

            return config;
        },

        configureServer(server) {
            const rootPath = server.config.root || process.cwd();

            const developmentLogger = createDevelopmentLogger(server);
            const { recentErrors, shouldSkip } = createRecentErrorTracker();

            const originalTransformRequest = server.transformRequest.bind(server);

            server.transformRequest = async (url: string, transformOptions?: TransformOptions) => {
                try {
                    return await originalTransformRequest(url, transformOptions);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } catch (error: any) {
                    if (error?.message?.includes("Failed to resolve import")) {
                        const match = error.message.match(/Failed to resolve import ["']([^"']+)["'] from ["']([^"']+)["']/);

                        if (match) {
                            const [, importPath, sourceFile] = match;

                            (error as any).sourceFile = sourceFile;
                            (error as any).importPath = importPath;
                        }
                    }

                    throw error;
                }
            };

            setupWebSocketInterception(server, shouldSkip, recentErrors, rootPath, options?.solutionFinders ?? []);

            setupHMRHandler(server, developmentLogger, shouldSkip, recentErrors, rootPath, options?.solutionFinders ?? []);

            const handleUnhandledRejection = createUnhandledRejectionHandler(server, rootPath, developmentLogger);

            process.on("unhandledRejection", handleUnhandledRejection);
            server.httpServer?.on("close", () => {
                process.off("unhandledRejection", handleUnhandledRejection);
            });
        },
        enforce: "pre",

        name: PLUGIN_NAME,

        transform(code, id, transformOptions): string | null {
            if (transformOptions?.ssr) {
                // eslint-disable-next-line unicorn/no-null
                return null;
            }

            if (!(id.includes("vite/dist/client/client.mjs") || id.includes("/@vite/client"))) {
                // eslint-disable-next-line unicorn/no-null
                return null;
            }

            return patchOverlay(code);
        },

        transformIndexHtml(): IndexHtmlTransformResult {
            return {
                html: "",
                tags: [{ attrs: { type: "module" }, children: generateClientScript(mode, isReactProject), injectTo: "head" as const, tag: "script" }],
            };
        },
    };
};

/**
 * Default export of the Vite error overlay plugin.
 * Use this plugin to enable error overlay functionality in your Vite project.
 */
export default errorOverlayPlugin;
