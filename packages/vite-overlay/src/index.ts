import { styleText } from "node:util";

import { codeToANSI } from "@shikijs/cli";
import { getErrorCauses, renderError } from "@visulima/error/error";
import type { Solution, SolutionFinder } from "@visulima/error/solution";
import { errorHintFinder, ruleBasedFinder } from "@visulima/error/solution";
// eslint-disable-next-line import/no-extraneous-dependencies
import { parse } from "marked";
import type { IndexHtmlTransformResult, Plugin, PluginOption, TransformOptions, ViteDevServer, WebSocketClient } from "vite";

import findLanguageBasedOnExtension from "../../../shared/utils/find-language-based-on-extension";
import { DEFAULT_ERROR_MESSAGE, DEFAULT_ERROR_NAME, MESSAGE_TYPE, PLUGIN_NAME, RECENT_ERROR_TTL_MS } from "./constants";
import { patchOverlay } from "./overlay/patch-overlay";
import type { BalloonConfig, DevelopmentLogger, ExtendedError, RawErrorData, RecentErrorTracker, VisulimaViteOverlayErrorPayload, ViteErrorData } from "./types";
import createViteSolutionFinder from "./utils/create-vite-solution-finder";
import buildExtendedErrorData from "./utils/error-processing";
import generateClientScript from "./utils/generate-client-script";
import enhanceViteSsrError from "./utils/ssr-error-enhancer";
import { absolutizeStackUrls, cleanErrorStack } from "./utils/stack-trace";

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
 * Creates a handler for unhandled promise rejections.
 * @param server The Vite dev server instance
 * @param rootPath The root path of the project
 * @param developmentLogger The development logger to use
 * @returns A function that handles unhandled rejections
 */
const createUnhandledRejectionHandler = (server: ViteDevServer, rootPath: string, developmentLogger: DevelopmentLogger) => async (reason: unknown) => {
    const runtimeError = reason instanceof Error ? reason : new Error(String((reason as any)?.stack || reason));

    try {
        server.ssrFixStacktrace(runtimeError as Error);
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
    framework: string | undefined,
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

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (index === 0 && (error as any)?.sourceFile) {
                enhancedViteErrorData = {
                    ...causeViteErrorData,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    file: (error as any).sourceFile,
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

    const solution = await findSolution(extendedErrors[0] as ExtendedError, solutionFinders, rootPath);

    return {
        errors: extendedErrors,
        errorType,
        rootPath,
        solution,
    } as VisulimaViteOverlayErrorPayload;
};

/**
 * Reconstructs an error object from cause chain data received from the client.
 * @param causeData The cause data object from the client
 * @returns A reconstructed Error object with cause chain
 */
const reconstructCauseChain = (causeData: any): Error | null => {
    if (!causeData) {
        // eslint-disable-next-line unicorn/no-null
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
    framework: string | undefined,
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
                            framework,
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

                    const extensionPayload = await buildExtendedError(syntaicError, server, rootPath, viteErrorData, "server", solutionFinders, framework);

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
 * @param forwardConsole Whether to log/display runtime errors
 */
const setupHMRHandler = (
    server: ViteDevServer,
    developmentLogger: DevelopmentLogger,
    shouldSkip: (signature: string) => boolean,
    recentErrors: Map<string, number>,
    rootPath: string,
    solutionFinders: SolutionFinder[],
    forwardConsole: boolean,
    framework: string | undefined,
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

        const syntaicError = new Error(message);

        syntaicError.name = name;
        syntaicError.stack = `${name}: ${message}\n${absolutizeStackUrls(rawStack, rootPath)}`;

        if (raw.cause) {
            syntaicError.cause = reconstructCauseChain(raw.cause);
        }

        try {
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
                framework,
            );

            recentErrors.set(JSON.stringify(extensionPayload), Date.now());

            const payload: any = { err: { ...extensionPayload }, type: "error" };

            if (extensionPayload.solution) {
                payload.solutions = extensionPayload.solution;
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
                        await codeToANSI(mainError.originalSnippet, (findLanguageBasedOnExtension(mainError.originalFilePath) || "text") as any, "nord"),
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
                    || (plugin as Plugin).name === "vite:react-swc"
                    || (plugin as Plugin).name === "vite:react-refresh"
                    || (plugin as Plugin).name === "vite:react-babel"
                    || (plugin as Plugin).name === "@vitejs/plugin-react"
                    || (typeof plugin === "function" && (plugin as Plugin).name?.includes("react"))
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
                    || (typeof plugin === "function" && (plugin as Plugin).name?.includes("vue"))
                    || ((plugin as Plugin).constructor && (plugin as Plugin).constructor.name?.includes("Vue"))),
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
 * @param options.showBallonButton Whether to show the balloon button (optional, deprecated - use overlay.balloon.enabled)
 * @param options.overlay Balloon overlay configuration (optional)
 * @param options.overlay.balloon Balloon trigger configuration (optional)
 * @returns The Vite plugin configuration
 */
const errorOverlayPlugin = (
    options: {
        forwardConsole?: boolean;
        forwardedConsoleMethods?: string[];
        // @deprecated Please use the new forwardConsole option
        logClientRuntimeError?: boolean;
        overlay?: {
            balloon?: BalloonConfig;
        };
        reactPluginName?: string;
        showBallonButton?: boolean;
        solutionFinders?: SolutionFinder[];
        vuePluginName?: string;
    } = {},
): Plugin => {
    let mode: string;
    let isReactProject: boolean;
    let isVueProject: boolean;

    // Handle deprecated option for backward compatibility
    const forwardConsole = (options.logClientRuntimeError === undefined ? options.forwardConsole : options.logClientRuntimeError) ?? true;
    const forwardedConsoleMethods = options.forwardedConsoleMethods ?? ["error"];

    // Warn about deprecated option
    if (options.logClientRuntimeError !== undefined) {
        // eslint-disable-next-line no-console
        console.warn("[vite-overlay] The 'logClientRuntimeError' option is deprecated. Please use 'forwardConsole' instead.");
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

                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            (error as any).sourceFile = sourceFile;
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            (error as any).importPath = importPath;
                        }
                    }

                    throw error;
                }
            };

            let framework: string | undefined;

            if (isReactProject) {
                framework = "react";
            } else if (isVueProject) {
                framework = "vue";
            }

            setupWebSocketInterception(server, shouldSkip, recentErrors, rootPath, options?.solutionFinders ?? [], framework);

            setupHMRHandler(server, developmentLogger, shouldSkip, recentErrors, rootPath, options?.solutionFinders ?? [], forwardConsole, framework);

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

            // Backward compatibility: showBallonButton takes precedence over overlay.balloon.enabled
            const balloonEnabled = options?.showBallonButton !== undefined
                ? options.showBallonButton
                : (options?.overlay?.balloon?.enabled ?? true);

            return patchOverlay(code, balloonEnabled, options?.overlay?.balloon);
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
