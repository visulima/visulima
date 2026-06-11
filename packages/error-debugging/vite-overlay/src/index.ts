/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-base-to-string, @typescript-eslint/await-thenable, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/no-misused-promises, @typescript-eslint/prefer-optional-chain, sonarjs/prefer-regexp-exec, sonarjs/deprecation */
import { styleText } from "node:util";

import { codeToANSI } from "@shikijs/cli";
import { getErrorCauses, renderError } from "@visulima/error/error";
import type { Solution, SolutionFinder } from "@visulima/error/solution";
import { errorHintFinder, ruleBasedFinder } from "@visulima/error/solution";
// eslint-disable-next-line import/no-extraneous-dependencies
import { parse } from "marked";
import type { IndexHtmlTransformResult, Plugin, PluginOption, TransformOptions, ViteDevServer, WebSocketClient } from "vite";

import findLanguageBasedOnExtension from "../../../../shared/utils/find-language-based-on-extension";
import { CAUSE_CHAIN_DEPTH_LIMIT, DEFAULT_ERROR_MESSAGE, DEFAULT_ERROR_NAME, MESSAGE_TYPE, PLUGIN_NAME, RECENT_ERROR_TTL_MS } from "./constants";
import { patchOverlay } from "./overlay/patch-overlay";
import type {
    DevelopmentLogger,
    ExtendedError,
    RawErrorData,
    RecentErrorTracker,
    VisulimaViteOverlayErrorPayload,
    VisulimaViteOverlayOptions,
    ViteErrorData,
} from "./types";
import createViteSolutionFinder from "./utils/create-vite-solution-finder";
import enhanceViteSsrError from "./utils/enhance-vite-ssr-error";
import buildExtendedErrorData from "./utils/error-processing";
import generateClientScript from "./utils/generate-client-script";
import { absolutizeStackUrls, cleanErrorStack } from "./utils/stack-trace";

const AT_PAREN_FRAME_RE = /at\s+[^(\s]+\s*\(([^:)]+):(\d+):(\d+)\)/;
// eslint-disable-next-line sonarjs/slow-regex, regexp/no-super-linear-backtracking
const AT_BARE_FRAME_RE = /at\s+([^:)]+):(\d+):(\d+)/;
const FAILED_RESOLVE_IMPORT_RE = /Failed to resolve import ["']([^"']+)["'] from ["']([^"']+)["']/;

// Stack strings arrive verbatim from the browser over the HMR channel. The frame regexes above
// carry super-linear-backtracking suppressions, so bound the input length before matching to
// neutralize a pathological single-line "stack".
const MAX_STACK_LINE_LENGTH = 2048;

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
        error: (message: unknown) => {
            server.config.logger.error(String(message ?? ""), {
                clear: true,
                timestamp: true,
            });
        },
        log: (message: unknown) => {
            server.config.logger.info(String(message ?? ""));
        },
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

        for (const [key, ts] of recentErrors) {
            if (now - ts >= RECENT_ERROR_TTL_MS) {
                recentErrors.delete(key);
            }
        }

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
 * Creates a handler for unhandled promise rejections.
 * @param server The Vite dev server instance
 * @param rootPath The root path of the project
 * @param developmentLogger The development logger to use
 * @returns A function that handles unhandled rejections
 */
const createUnhandledRejectionHandler = (server: ViteDevServer, rootPath: string, developmentLogger: DevelopmentLogger) => async (reason: unknown) => {
    const runtimeError = reason instanceof Error ? reason : new Error(String((reason as { stack?: string })?.stack || reason));

    try {
        server.ssrFixStacktrace(runtimeError);
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

    await developmentLogger.error(renderError(runtimeError));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    server.ws.send({ err: runtimeError, type: "error" } as any);
};

/**
 * Logs (under DEBUG only) that a solution finder threw and was skipped, so a buggy
 * user-supplied finder is diagnosable instead of failing silently.
 * @param name Identifier of the finder that threw
 * @param finderError The error value thrown by the finder
 */
const logFinderError = (name: string, finderError: unknown): void => {
    if (!process.env.DEBUG) {
        return;
    }

    const messageText = finderError instanceof Error ? finderError.message : String(finderError);

    // eslint-disable-next-line no-console
    console.debug(`Solution finder "${name}" threw and was skipped: ${messageText}`);
};

/**
 * Finds a solution for an error by running through available solution finders.
 * @param error The extended error to find a solution for
 * @param solutionFinders User-supplied finders, tried before the built-ins
 * @param builtinFinders The plugin's own finders, built once per dev server
 * @returns A solution object if found, undefined otherwise
 */
const findSolution = async (error: ExtendedError, solutionFinders: SolutionFinder[], builtinFinders: SolutionFinder[]): Promise<Solution | undefined> => {
    let hint: Solution | undefined;

    // Merge into a fresh array — never mutate the caller-owned `solutionFinders` reference, which is
    // captured once for the whole dev session. Pushing here previously appended the three built-in
    // finders on every displayed error, so the list grew unbounded (and re-walked the project tree
    // per duplicate).
    const finders = [...solutionFinders, ...builtinFinders];

    for await (const handler of finders.toSorted((a, b) => b.priority - a.priority)) {
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

            const parsedHeader = await parse(result.header ?? "");
            const parsedBody = await parse(result.body ?? "");

            hint = {
                body: parsedBody,
                header: parsedHeader,
            };

            break;
        } catch (finderError) {
            // A buggy (often user-supplied) finder must not abort solution lookup, but it should be
            // diagnosable rather than swallowed silently.
            logFinderError(name, finderError);

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
    framework: string | undefined,
    builtinFinders: SolutionFinder[],
): Promise<VisulimaViteOverlayErrorPayload> => {
    const allErrors = getErrorCauses(rawError);

    if (allErrors.length === 0) {
        throw new Error("No errors found in the error stack");
    }

    const extendedErrors = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        allErrors.map(async (error: any, index: number) => {
            let causeViteErrorData = viteErrorData;

            if (index > 0) {
                const stackLines = error?.stack?.split("\n") || [];
                const firstStackLine = stackLines.find((line: string) => line.includes("at ") && !line.includes("node_modules"));

                if (firstStackLine && firstStackLine.length <= MAX_STACK_LINE_LENGTH) {
                    const match = firstStackLine.match(AT_PAREN_FRAME_RE) || firstStackLine.match(AT_BARE_FRAME_RE);

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

            if (index === 0 && error?.sourceFile) {
                enhancedViteErrorData = {
                    ...causeViteErrorData,

                    file: error.sourceFile,
                };
            }

            const extendedData = await buildExtendedErrorData(error, server, index, framework, enhancedViteErrorData, allErrors);

            return {
                hint: (error as ExtendedError)?.hint,
                message: error?.message || "",
                name: error?.name || DEFAULT_ERROR_NAME,
                stack: absolutizeStackUrls(cleanErrorStack(error?.stack || ""), rootPath),
                ...extendedData,
            };
        }),
    );

    const solution = await findSolution(extendedErrors[0] as ExtendedError, solutionFinders, builtinFinders);

    return {
        errors: extendedErrors,
        errorType,
        rootPath,
        solution,
    };
};

/**
 * Reconstructs an error object from cause chain data received from the client.
 * @param causeData The cause data object from the client
 * @returns A reconstructed Error object with cause chain
 */
interface CauseData {
    cause?: CauseData;
    message?: string;
    name?: string;
    stack?: string;
}

const reconstructCauseChain = (causeData: CauseData | undefined, depth = 0): Error | undefined => {
    if (!causeData || depth >= CAUSE_CHAIN_DEPTH_LIMIT) {
        return undefined;
    }

    const causeError = new Error(String(causeData.message || "Caused by error"));

    causeError.name = String(causeData.name || "Error");
    causeError.stack = String(causeData.stack || "");

    if (causeData.cause) {
        causeError.cause = reconstructCauseChain(causeData.cause, depth + 1);
    }

    return causeError;
};

/**
 * Sets up WebSocket message interception to handle error data from the client.
 * @param server The Vite dev server instance
 * @param shouldSkip Function to check if an error should be skipped
 * @param rootPath The root path of the project
 * @param solutionFinders Array of solution finder handlers
 */
const setupWebSocketInterception = (
    server: ViteDevServer,
    shouldSkip: (signature: string) => boolean,
    rootPath: string,
    solutionFinders: SolutionFinder[],
    framework: string | undefined,
    builtinFinders: SolutionFinder[],
): void => {
    const originalSend = server.ws.send.bind(server.ws);

    // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-explicit-any, sonarjs/cognitive-complexity
    server.ws.send = async (data: any, client?: any): Promise<void> => {
        try {
            if (data && typeof data === "object" && data.type === "error" && data.err) {
                const { err } = data;
                const rawSig = createErrorSignature(err);

                if (shouldSkip(rawSig)) {
                    return;
                }

                if (err.message?.includes("Failed to resolve import")) {
                    const match = err.message.match(FAILED_RESOLVE_IMPORT_RE);

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
                            framework,
                            builtinFinders,
                        );

                        // eslint-disable-next-line no-param-reassign
                        data.err = extensionPayload;
                    }
                } else {
                    const name = String(err?.name || "Error");
                    const message = String(err.message);
                    const rawStack = String(err.stack);

                    const syntheticError = new Error(message);

                    syntheticError.name = name;
                    syntheticError.stack = `${name}: ${message}\n${absolutizeStackUrls(rawStack, rootPath)}`;

                    if (err.cause) {
                        syntheticError.cause = reconstructCauseChain(err.cause as CauseData);
                    }

                    const viteErrorData = err.sourceFile
                        ? {
                            column: err.column,
                            file: err.sourceFile,
                            line: err.line,
                            plugin: err.plugin,
                        }
                        : undefined;

                    const extensionPayload = await buildExtendedError(
                        syntheticError,
                        server,
                        rootPath,
                        viteErrorData,
                        "server",
                        solutionFinders,
                        framework,
                        builtinFinders,
                    );

                    // eslint-disable-next-line no-param-reassign
                    data.err = extensionPayload;
                }
            }

            originalSend(data, client);
        } catch (error) {
            logError(server, "[visulima:vite-overlay:server] ws.send intercept failed", error);

            if (client && typeof client.send === "function") {
                client.send(data, client);
            } else {
                originalSend(data, client);
            }
        }
    };
};

/**
 * Sets up HMR (Hot Module Replacement) handler for client-side error messages.
 * @param server The Vite dev server instance
 * @param developmentLogger The development logger to use
 * @param shouldSkip Function to check if an error should be skipped
 * @param rootPath The root path of the project
 * @param solutionFinders Array of solution finder handlers
 * @param forwardConsole Whether to log/display runtime errors
 */
const setupHMRHandler = (
    server: ViteDevServer,
    developmentLogger: DevelopmentLogger,
    shouldSkip: (signature: string) => boolean,
    rootPath: string,
    solutionFinders: SolutionFinder[],
    forwardConsole: boolean,
    framework: string | undefined,
    builtinFinders: SolutionFinder[],
): void => {
    server.ws.on(MESSAGE_TYPE, async (data: unknown, client: WebSocketClient) => {
        // Skip processing client runtime errors if forwardConsole is disabled
        if (!forwardConsole) {
            return;
        }

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

        const syntheticError = new Error(message);

        syntheticError.name = name;
        syntheticError.stack = `${name}: ${message}\n${absolutizeStackUrls(rawStack, rootPath)}`;

        if (raw.cause) {
            syntheticError.cause = reconstructCauseChain(raw.cause as CauseData);
        }

        try {
            const extensionPayload = await buildExtendedError(
                syntheticError,
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
                framework,
                builtinFinders,
            );

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const payload: any = { err: { ...extensionPayload }, type: "error" };

            if (extensionPayload.solution) {
                payload.solution = extensionPayload.solution;
            }

            const errors = [...extensionPayload.errors];
            const mainError = errors.shift();

            if (!mainError) {
                await developmentLogger.error("No error information available");
                client.send(payload);

                return;
            }

            const consoleMessage = [
                `${styleText("red", "[client]")} ${mainError.name}: ${mainError.message}`,
                ...mainError.originalFilePath.includes("-extension://")
                    ? []
                    : [
                        "",
                        styleText("blue", `${mainError.originalFilePath}:${mainError.originalFileLine}:${mainError.originalFileColumn}`),
                        "",
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        await codeToANSI(mainError.originalSnippet, findLanguageBasedOnExtension(mainError.originalFilePath) as any, "nord"),
                        "",
                        "Raw stack trace:",
                        "",
                        mainError.originalStack,
                    ],
            ];

            // add error cause
            errors.forEach((error, index) => {
                const spacer = " ".repeat(2 * index);

                consoleMessage.push(
                    "",
                    `${spacer}Caused by: `,
                    "",
                    `${spacer}${error.name}: ${error.message}`,
                    `${spacer}at ${error.originalFilePath}:${error.originalFileLine}:${error.originalFileColumn}`,
                );
            });

            await developmentLogger.error(consoleMessage.join("\n"));

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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);
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
                    || (plugin as Plugin).name === "vite:react-swc"
                    || (plugin as Plugin).name === "vite:react-refresh"
                    || (plugin as Plugin).name === "vite:react-babel"
                    || (plugin as Plugin).name === "@vitejs/plugin-react"
                    || (typeof plugin === "function" && (plugin as unknown as Plugin).name?.includes("react"))
                    || ((plugin as Plugin).constructor && (plugin as Plugin).constructor.name?.includes("React"))),
        );

/**
 * Checks if the Vite configuration includes a Vue plugin.
 * @param plugins Array of Vite plugins to check
 * @param vuePluginName Optional custom Vue plugin name to look for
 * @returns True if a Vue plugin is found
 */
const hasVuePlugin = (plugins: PluginOption[], vuePluginName?: string): boolean =>
    plugins
        .flat()
        .some(
            (plugin) =>
                plugin
                && ((vuePluginName && (plugin as Plugin).name === vuePluginName)
                    || (plugin as Plugin).name === "vite:vue"
                    || (plugin as Plugin).name === "@vitejs/plugin-vue"
                    || (typeof plugin === "function" && (plugin as unknown as Plugin).name?.includes("vue"))
                    || ((plugin as Plugin).constructor && (plugin as Plugin).constructor.name?.includes("Vue"))),
        );

/**
 * Checks if the Vite configuration includes a Svelte plugin (`@sveltejs/vite-plugin-svelte`).
 * @param plugins Array of Vite plugins to check
 * @param sveltePluginName Optional custom Svelte plugin name to look for
 * @returns True if a Svelte plugin is found
 */
const hasSveltePlugin = (plugins: PluginOption[], sveltePluginName?: string): boolean =>
    plugins
        .flat()
        .some(
            (plugin) =>
                plugin
                && ((sveltePluginName && (plugin as Plugin).name === sveltePluginName)
                    || (plugin as Plugin).name === "vite-plugin-svelte"
                    || (plugin as Plugin).name === "@sveltejs/vite-plugin-svelte"
                    || (typeof plugin === "function" && (plugin as unknown as Plugin).name?.includes("svelte"))
                    || ((plugin as Plugin).constructor && (plugin as Plugin).constructor.name?.includes("Svelte"))),
        );

/**
 * Checks if the Vite configuration includes a Preact plugin (`@preact/preset-vite`).
 * @param plugins Array of Vite plugins to check
 * @param preactPluginName Optional custom Preact plugin name to look for
 * @returns True if a Preact plugin is found
 */
const hasPreactPlugin = (plugins: PluginOption[], preactPluginName?: string): boolean =>
    plugins
        .flat()
        .some(
            (plugin) =>
                plugin
                && ((preactPluginName && (plugin as Plugin).name === preactPluginName)
                    || (plugin as Plugin).name === "preact:config"
                    || (plugin as Plugin).name === "vite:preact-jsx"
                    || (plugin as Plugin).name === "@preact/preset-vite"
                    || (typeof plugin === "function" && (plugin as unknown as Plugin).name?.includes("preact"))
                    || ((plugin as Plugin).constructor && (plugin as Plugin).constructor.name?.includes("Preact"))),
        );

/**
 * Checks if the Vite configuration includes a Solid plugin (`vite-plugin-solid`).
 * @param plugins Array of Vite plugins to check
 * @param solidPluginName Optional custom Solid plugin name to look for
 * @returns True if a Solid plugin is found
 */
const hasSolidPlugin = (plugins: PluginOption[], solidPluginName?: string): boolean =>
    plugins
        .flat()
        .some(
            (plugin) =>
                plugin
                && ((solidPluginName && (plugin as Plugin).name === solidPluginName)
                    || (plugin as Plugin).name === "solid"
                    || (plugin as Plugin).name === "vite-plugin-solid"
                    || (typeof plugin === "function" && (plugin as unknown as Plugin).name?.includes("solid"))
                    || ((plugin as Plugin).constructor && (plugin as Plugin).constructor.name?.includes("Solid"))),
        );

/**
 * Main Vite plugin for error overlay functionality.
 * Intercepts runtime errors and displays them in a user-friendly overlay.
 * @param options Plugin configuration options
 * @param options.forwardConsole Whether to log client runtime errors (optional)
 * @param options.forwardedConsoleMethods Array of console method names to forward (optional)
 * @param [options.logClientRuntimeError] [deprecated] Use forwardConsole instead
 * @param options.reactPluginName Custom React plugin name (optional)
 * @param options.solutionFinders Custom solution finders (optional)
 * @param options.vuePluginName Custom Vue plugin name (optional)
 * @param options.sveltePluginName Custom Svelte plugin name (optional)
 * @param options.preactPluginName Custom Preact plugin name (optional)
 * @param options.solidPluginName Custom Solid plugin name (optional)
 * @param options.framework Explicit framework override; skips auto-detection (optional)
 * @param options.interceptUnhandledRejection Capture process-wide unhandled rejections (optional, default true)
 * @param options.showBalloonButton Whether to show the balloon button (optional)
 * @param options.showBallonButton [deprecated] Misspelling of showBalloonButton
 * @param options.overlay Overlay configuration (optional)
 * @returns The Vite plugin configuration
 */
const errorOverlayPlugin = (options: VisulimaViteOverlayOptions = {}): Plugin => {
    let mode: string;
    let isReactProject: boolean;
    let isVueProject: boolean;
    let isSvelteProject: boolean;
    let isPreactProject: boolean;
    let isSolidProject: boolean;

    // Handle deprecated option for backward compatibility
    const forwardConsole = (options.logClientRuntimeError === undefined ? options.forwardConsole : options.logClientRuntimeError) ?? true;
    const forwardedConsoleMethods = options.forwardedConsoleMethods ?? ["error"];
    const interceptUnhandledRejection = options.interceptUnhandledRejection ?? true;

    // Warn about deprecated option
    if (options.logClientRuntimeError !== undefined) {
        // eslint-disable-next-line no-console
        console.warn("[vite-overlay] The 'logClientRuntimeError' option is deprecated. Please use 'forwardConsole' instead.");
    }

    if (options.showBallonButton !== undefined) {
        // eslint-disable-next-line no-console
        console.warn("[vite-overlay] The 'showBallonButton' option is misspelled and deprecated. Please use 'showBalloonButton' instead.");
    }

    if (forwardedConsoleMethods.length === 0) {
        throw new Error("forwardedConsoleMethods must be an array of console method names");
    }

    return {
        apply: "serve",

        config(config, environment) {
            if (config.plugins) {
                isReactProject = hasReactPlugin(config.plugins, options?.reactPluginName);
                isVueProject = hasVuePlugin(config.plugins, options?.vuePluginName);
                isSvelteProject = hasSveltePlugin(config.plugins, options?.sveltePluginName);
                isPreactProject = hasPreactPlugin(config.plugins, options?.preactPluginName);
                isSolidProject = hasSolidPlugin(config.plugins, options?.solidPluginName);
            }

            mode = environment.mode || "development";

            return config;
        },

        configureServer(server) {
            const rootPath = server.config.root || process.cwd();

            const developmentLogger = createDevelopmentLogger(server);
            const { shouldSkip } = createRecentErrorTracker();

            const originalTransformRequest = server.transformRequest.bind(server);

            // eslint-disable-next-line no-param-reassign
            server.transformRequest = async (url: string, transformOptions?: TransformOptions) => {
                try {
                    return await originalTransformRequest(url, transformOptions);
                } catch (error: unknown) {
                    if ((error as { message?: string })?.message?.includes("Failed to resolve import")) {
                        const match = (error as { message: string }).message.match(FAILED_RESOLVE_IMPORT_RE);

                        if (match) {
                            const [, importPath, sourceFile] = match;

                            (error as Record<string, unknown>).sourceFile = sourceFile;
                            (error as Record<string, unknown>).importPath = importPath;
                        }
                    }

                    throw error;
                }
            };

            let framework: string | undefined = options?.framework;

            if (framework === undefined) {
                if (isReactProject) {
                    framework = "react";
                } else if (isVueProject) {
                    framework = "vue";
                } else if (isSvelteProject) {
                    framework = "svelte";
                } else if (isPreactProject) {
                    framework = "preact";
                } else if (isSolidProject) {
                    framework = "solid";
                }
            }

            // Build the built-in finders once per dev server (not once per error). Each invocation
            // of createViteSolutionFinder owns a directory-listing cache, so reusing one instance
            // keeps the cache warm across errors.
            const builtinFinders: SolutionFinder[] = [errorHintFinder, createViteSolutionFinder(rootPath), ruleBasedFinder];

            setupWebSocketInterception(server, shouldSkip, rootPath, options?.solutionFinders ?? [], framework, builtinFinders);

            setupHMRHandler(server, developmentLogger, shouldSkip, rootPath, options?.solutionFinders ?? [], forwardConsole, framework, builtinFinders);

            if (interceptUnhandledRejection) {
                const handleUnhandledRejection = createUnhandledRejectionHandler(server, rootPath, developmentLogger);

                process.on("unhandledRejection", handleUnhandledRejection);
                server.httpServer?.on("close", () => {
                    process.off("unhandledRejection", handleUnhandledRejection);
                });
            }
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

            // Resolve balloon visibility. Precedence: correctly-spelled `showBalloonButton`, then the
            // deprecated misspelling `showBallonButton`, then `overlay.balloon.enabled`, default true.
            const balloonEnabled = options?.showBalloonButton ?? options?.showBallonButton ?? options?.overlay?.balloon?.enabled ?? true;

            return patchOverlay(code, balloonEnabled, options?.overlay?.balloon, options?.overlay?.customCSS);
        },

        transformIndexHtml(): IndexHtmlTransformResult {
            return {
                html: "",
                tags: [
                    {
                        attrs: { type: "module" },
                        children: generateClientScript(mode, forwardedConsoleMethods, options?.overlay?.balloon),
                        injectTo: "head" as const,
                        tag: "script",
                    },
                ],
            };
        },
    };
};

/**
 * Default export of the Vite error overlay plugin.
 * Use this plugin to enable error overlay functionality in your Vite project.
 */
export default errorOverlayPlugin;

export type {
    BalloonConfig,
    BalloonPosition,
    BalloonStyle,
    Framework,
    OverlayConfig,
    Solution,
    SolutionFinder,
    VisulimaViteOverlayOptions,
} from "./types";
export { default as createViteSolutionFinder } from "./utils/create-vite-solution-finder";
