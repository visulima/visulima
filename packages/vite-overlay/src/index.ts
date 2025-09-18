import { getErrorCauses } from "@visulima/error/error";
import type { IndexHtmlTransformResult, Plugin, ViteDevServer, WebSocketClient } from "vite";

import { terminalOutput } from "../../../shared/utils/cli-error-builder";
import { DEFAULT_ERROR_MESSAGE, DEFAULT_ERROR_NAME, MESSAGE_TYPE, PLUGIN_NAME, RECENT_ERROR_TTL_MS } from "./constants";
import { patchOverlay } from "./overlay/patch-overlay";
import type { DevelopmentLogger, RawErrorData, RecentErrorTracker, VisulimaViteOverlayErrorPayload, ViteErrorData } from "./types";
import buildExtendedErrorData from "./utils/error-processing";
import enhanceViteSsrError from "./utils/ssr-error-enhancer";
import { absolutizeStackUrls, cleanErrorStack } from "./utils/stack-trace-utils";

const logError = (server: ViteDevServer, prefix: string, error: unknown): void => {
    try {
        const message = error instanceof Error ? error.message : String(error);

        server.config.logger.error(`${prefix}: ${message}`, { clear: true, timestamp: true });
    } catch {
        // Silent fallback if logging fails
    }
};

// Based on
// https://github.com/hi-ogawa/unocss-preset-antd/tree/main/packages/vite-runtime-error-overlay

// based on the idea in
// https://github.com/vitejs/vite/pull/6274#issuecomment-1087749460
// https://github.com/vitejs/vite/issues/2076

// frame generation logic is based on
// https://github.com/vitejs/vite/blob/a073ac4493e54a2204b5b816fbc7d600df3b34ce/packages/vite/src/node/ssr/ssrStacktrace.ts#L23
// https://github.com/vitejs/vite/blob/0a76652c335e7c0bd8d223186b5533c0e10cac90/packages/vite/src/node/server/middlewares/error.ts#L45
// https://github.com/vitejs/vite/blob/29a260cb16025408defc2e8186d1fbf17ee099ac/packages/vite/src/node/utils.ts#L486

// Creates a development logger that integrates with Vite's logging system
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

// Creates a tracker for recent errors to prevent spam
const createRecentErrorTracker = (): RecentErrorTracker => {
    const recentErrors = new Map<string, number>();

    const shouldSkip = (signature: string): boolean => {
        const now = Date.now();
        const lastOccurrence = recentErrors.get(signature) || 0;

        if (now - lastOccurrence < RECENT_ERROR_TTL_MS) {
            return true; // Skip this duplicate error
        }

        recentErrors.set(signature, now);

        return false; // Process this new error
    };

    return { recentErrors, shouldSkip };
};

// Generates a unique signature for error deduplication
const createErrorSignature = (raw: Error | RawErrorData): string => `${String(raw?.message || "")}\n${String(raw?.stack || "")}`;

/**
 * Common error processing logic shared between HMR handler and unhandled rejection handler
 */
const processRuntimeError = async (runtimeError: Error, rootPath: string, developmentLogger: DevelopmentLogger): Promise<void> => {
    // For client-side runtime errors, just clean the stack trace
    // SSR processing is not appropriate for client-side errors
    try {
        // eslint-disable-next-line no-param-reassign
        runtimeError.stack = absolutizeStackUrls(cleanErrorStack(String(runtimeError.stack || "")), rootPath);
    } catch {
        // Ignore stack cleaning errors
    }

    // Pretty dev-server logs using cli-handler (ANSI formatted + optional solutions)
    await terminalOutput(runtimeError, { logger: developmentLogger });
};

const createUnhandledRejectionHandler = (server: ViteDevServer, rootPath: string, developmentLogger: DevelopmentLogger) => async (reason: unknown) => {
    const runtimeError = reason instanceof Error ? reason : new Error(String((reason as any)?.stack || reason));

    // For unhandled rejections (can be server or client), apply SSR processing
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

    // Clean the stack trace
    try {
        runtimeError.stack = absolutizeStackUrls(cleanErrorStack(String(runtimeError.stack || "")), rootPath);
    } catch {
        // Ignore stack cleaning errors
    }

    await terminalOutput(runtimeError, { logger: developmentLogger });

    // Let our ws interceptor normalize to extended payload
    server.ws.send({ err: runtimeError, type: "error" } as any);
};

const buildExtendedError = async (
    rawError: Error,
    server: ViteDevServer,
    rootPath: string,
    viteErrorData?: ViteErrorData,
    errorType: "client" | "server" = "client",
): Promise<VisulimaViteOverlayErrorPayload> => {
    const allErrors = getErrorCauses(rawError);

    if (allErrors.length === 0) {
        throw new Error("No errors found in the error stack");
    }

    // Build extended data for all causes (main cause + all nested causes)
    // Pass viteErrorData to all errors in the chain, not just the first one
    const extendedErrors = await Promise.all(
        allErrors.map(async (error, index) => {
            // For cause errors, try to extract location info from their stack trace
            let causeViteErrorData = viteErrorData;

            if (index > 0) {
                // For cause errors, try to extract location from their stack trace
                const stackLines = error?.stack?.split("\n") || [];
                const firstStackLine = stackLines.find((line) => line.includes("at ") && !line.includes("node_modules"));

                if (firstStackLine) {
                    // Try to extract file, line, column from stack trace
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

            // For import resolution errors, try to use the sourceFile we extracted
            let enhancedViteErrorData = causeViteErrorData;

            if (index === 0 && (error as any)?.sourceFile) {
                enhancedViteErrorData = {
                    ...causeViteErrorData,
                    file: (error as any).sourceFile,
                };
            }

            const extendedData = await buildExtendedErrorData(error, server, enhancedViteErrorData, allErrors, index);

            return {
                message: error?.message || "",
                name: error?.name || DEFAULT_ERROR_NAME,
                stack: absolutizeStackUrls(cleanErrorStack(error?.stack || ""), rootPath),
                ...extendedData,
            };
        }),
    );

    return {
        errors: extendedErrors,
        errorType,
        rootPath,
    } as VisulimaViteOverlayErrorPayload;
};

/**
 * Generates the client-side script that forwards runtime errors to the dev server
 */
const generateClientScript = (): string => String.raw`
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


    // Recursively extract full cause chain as nested structure
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

        // Build nested structure by traversing the chain
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

window.addEventListener('react-error-boundary', async function(e) {
    var detail = e.detail;

    if (detail && detail.error) {
        sendError(detail.error);
    }
});

// Expose sendError globally for direct error reporting (used by tests)
window.__flameSendError = sendError;

// Simple console.error override to catch React error boundary logs
var orig = console.error;

console.error = function() {
    try {
        var args = Array.prototype.slice.call(arguments);
        var err = args.find((a) => a instanceof Error);
        
        if (err) {
            // Send React-enhanced errors from console.error (like from error boundaries)
            sendError(err);
        }
    } catch {}

    return orig.apply(console, arguments);
}`;

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
 * Sets up WebSocket interception to enhance error payloads before sending.
 */
const setupWebSocketInterception = (
    server: ViteDevServer,
    shouldSkip: (signature: string) => boolean,
    recentErrors: Map<string, number>,
    rootPath: string,
): void => {
    // Enhanced WebSocket interception for all errors
    const originalSend = server.ws.send.bind(server.ws);

    // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-explicit-any
    server.ws.send = async (data: any, client?: any): Promise<void> => {
        try {
            // Check if this is an error payload from Vite
            if (data && typeof data === "object" && data.type === "error" && data.err) {
                const { err } = data;
                const rawSig = createErrorSignature(err);

                if (shouldSkip(rawSig)) {
                    return; // drop duplicate
                }

                // Special handling for import resolution errors
                if (err.message?.includes("Failed to resolve import")) {
                    // Extract file path from error message for better module resolution
                    const match = err.message.match(/Failed to resolve import ["']([^"']+)["'] from ["']([^"']+)["']/);

                    if (match) {
                        const sourceFile = match[2];
                        // Create our custom error payload for import errors
                        const importError = new Error(err.message);

                        importError.name = "ImportResolutionError";
                        importError.stack = err.stack;

                        // Build extended error data
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
                        );

                        data.err = extensionPayload;
                        recentErrors.set(JSON.stringify(extensionPayload), Date.now());
                    }
                } else {
                    // Handle other types of errors (runtime errors, etc.)
                    const name = String(err?.name || "Error");
                    const message = String(err.message);
                    const rawStack = String(err.stack);

                    // Reconstruct the error with proper cause chain
                    const syntaicError = new Error(message);

                    syntaicError.name = name;
                    syntaicError.stack = `${name}: ${message}\n${absolutizeStackUrls(rawStack, rootPath)}`;

                    // If there's a nested cause structure, reconstruct it recursively
                    if (err.cause) {
                        syntaicError.cause = reconstructCauseChain(err.cause);
                    }

                    // Build extended error data for non-import errors
                    const viteErrorData = err.sourceFile
                        ? {
                            column: err.column,
                            file: err.sourceFile,
                            line: err.line,
                            plugin: err.plugin,
                        }
                        : undefined;

                    const extensionPayload = await buildExtendedError(syntaicError, server, rootPath, viteErrorData, "server");

                    recentErrors.set(JSON.stringify(extensionPayload), Date.now());

                    data.err = extensionPayload;
                }
            }

            // For non-error payloads, send as-is
            originalSend(data, client);
        } catch (error) {
            logError(server, "[visulima:vite-overlay:server] ws.send intercept failed", error);

            client.send(data, client);
        }
    };
};

/**
 * Sets up HMR handler for client-reported runtime errors
 */
const setupHMRHandler = (
    server: ViteDevServer,
    developmentLogger: DevelopmentLogger,
    shouldSkip: (signature: string) => boolean,
    recentErrors: Map<string, number>,
    rootPath: string,
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
            return; // duplicate runtime error
        }

        const name = String(raw?.name || "Error");
        const message = String(raw.message);
        const rawStack = String(raw.stack);

        // Reconstruct the error with proper cause chain
        const syntaicError = new Error(message);

        syntaicError.name = name;
        syntaicError.stack = `${name}: ${message}\n${absolutizeStackUrls(rawStack, rootPath)}`;

        // If there's a nested cause structure, reconstruct it recursively
        if (raw.cause) {
            syntaicError.cause = reconstructCauseChain(raw.cause);
        }

        try {
            // Process the runtime error using shared logic
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
            );

            recentErrors.set(JSON.stringify(extensionPayload), Date.now());

            client.send({ err: extensionPayload as any, type: "error" });
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

const errorOverlayPlugin = (): Plugin => {
    return {
        apply: "serve",
        // Receive client-reported runtime errors and forward as Vite error payloads
        configureServer(server) {
            const rootPath = server.config.root || process.cwd();

            const developmentLogger = createDevelopmentLogger(server);
            const { recentErrors, shouldSkip } = createRecentErrorTracker();

            // Simple transformRequest interception to catch import errors early
            const originalTransformRequest = server.transformRequest.bind(server);

            server.transformRequest = async (url: string, options?: any) => {
                try {
                    return await originalTransformRequest(url, options);
                } catch (error: any) {
                    // Check if this is an import resolution error
                    if (error?.message?.includes("Failed to resolve import")) {
                        // Extract source file info and store it for WebSocket interception
                        const match = error.message.match(/Failed to resolve import ["']([^"']+)["'] from ["']([^"']+)["']/);

                        if (match) {
                            const [, importPath, sourceFile] = match;

                            // Store the source file info on the error for later use
                            (error as any).sourceFile = sourceFile;
                            (error as any).importPath = importPath;
                        }
                    }

                    throw error;
                }
            };

            setupWebSocketInterception(server, shouldSkip, recentErrors, rootPath);

            // Handle client-reported errors via HMR
            setupHMRHandler(server, developmentLogger, shouldSkip, recentErrors, rootPath);

            // Capture unhandled rejections on the dev server process and surface them in the overlay
            const handleUnhandledRejection = createUnhandledRejectionHandler(server, rootPath, developmentLogger);

            process.on("unhandledRejection", handleUnhandledRejection);
            server.httpServer?.on("close", () => {
                process.off("unhandledRejection", handleUnhandledRejection);
            });
        },
        enforce: "pre",

        name: PLUGIN_NAME,

        // Replace Vite's overlay class with our custom overlay (Astro-style patch)
        transform(code, id, options): string | null {
            if (options?.ssr) {
                // eslint-disable-next-line unicorn/no-null
                return null;
            }

            if (!(id.includes("vite/dist/client/client.mjs") || id.includes("/@vite/client"))) {
                // eslint-disable-next-line unicorn/no-null
                return null;
            }

            return patchOverlay(code);
        },

        // Inject a tiny bridge that forwards runtime errors to the dev server over HMR
        transformIndexHtml(): IndexHtmlTransformResult {
            return {
                html: "",
                tags: [{ attrs: { type: "module" }, children: generateClientScript(), injectTo: "head" as const, tag: "script" }],
            };
        },
    };
};

export default errorOverlayPlugin;
