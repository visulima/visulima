// Core Vite and error handling imports
import { getErrorCauses } from "@visulima/error/error";
import { parseStacktrace } from "@visulima/error/stacktrace";
import type { ErrorPayload, IndexHtmlTransformResult, Plugin, WebSocketClient } from "vite";

// Internal imports - organized by category
import { terminalOutput } from "../../../shared/utils/cli-error-builder";
// Constants
import { DEFAULT_ERROR_MESSAGE, DEFAULT_ERROR_NAME, MESSAGE_TYPE, PLUGIN_NAME, RECENT_ERROR_TTL_MS } from "./constants";
// Overlay components
import { patchOverlay } from "./overlay/patch-overlay";
// Types
import type { DevelopmentLogger, ExtendedErrorPayload, RawErrorData, RecentErrorTracker, ViteServer } from "./types";
// Utilities
import buildExtendedErrorData from "./utils/error-processing";
import enhanceViteSsrError from "./utils/ssr-error-enhancer";
import { absolutizeStackUrls, cleanErrorStack } from "./utils/stack-trace-utils";

const logError = (server: ViteServer, prefix: string, error: unknown): void => {
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
const createDevelopmentLogger = (server: ViteServer): DevelopmentLogger => {
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

// Creates a detailed signature for processed errors
const createExtendedErrorSignature = (extension: ExtendedErrorPayload): string => {
    const primaryCause = extension.causes?.[0];

    return `${extension.name}|${extension.message}|${primaryCause?.originalFilePath || ""}|${primaryCause?.originalFileLine || 0}`;
};

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

const createUnhandledRejectionHandler = (server: ViteServer, rootPath: string, developmentLogger: DevelopmentLogger) => async (reason: unknown) => {
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

const buildExtendedError = async (rawError: ErrorPayload["err"] | Error, server: ViteServer, rootPath: string): Promise<ExtendedErrorPayload> => {
    try {
        const cleanedRawStack = absolutizeStackUrls(cleanErrorStack(rawError?.stack ?? ""), rootPath);

        const allCauses = getErrorCauses(rawError);

        if (allCauses.length === 0) {
            throw new Error("No errors found in the error stack");
        }

        // Build extended data for all causes (main cause + all nested causes)
        const extendedCauses = await Promise.all(
            allCauses.map(async (cause, index) => {
                // Pass the raw error for the first cause (main error) to get rich location data
                const rawErrorForCause = index === 0 && rawError && typeof rawError === "object" && "loc" in rawError ? rawError : undefined;
                const errorCause = cause instanceof Error ? cause : new Error(String((cause as any)?.message || "Unknown error"));
                const extendedData = await buildExtendedErrorData(errorCause, server, rawErrorForCause as any);

                return {
                    message: String((cause as any)?.message || ""),
                    name: String((cause as any)?.name || DEFAULT_ERROR_NAME),
                    stack: absolutizeStackUrls(cleanErrorStack(String((cause as any)?.stack || "")), rootPath),
                    ...extendedData,
                };
            }),
        );

        const payload: ExtendedErrorPayload = {
            causes: extendedCauses,
            isServerError: false,
            message: rawError?.message ?? "",
            name: rawError?.name ?? "",
            stack: cleanedRawStack,
        };

        return payload;
    } catch (error) {
        logError(server, "[visulima:vite-overlay:server] buildExtendedError failure", error);

        return {
            causes: [],
            message: rawError?.message ?? "",
            name: rawError?.name ?? "",
            stack: absolutizeStackUrls(cleanErrorStack(rawError?.stack ?? ""), rootPath),
        };
    }
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


    hot.send('${MESSAGE_TYPE}', {
        message: error.message,
        stack: error.stack,
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

/**
 * Sets up WebSocket interception to enhance error payloads before sending.
 */
const setupWebSocketInterception = (
    server: ViteServer,
    shouldSkip: (signature: string) => boolean,
    recentErrors: Map<string, number>,
    rootPath: string,
): void => {
    const origSend = server.ws.send.bind(server.ws);

    // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-explicit-any
    server.ws.send = async (payload: any, client?: any): Promise<void> => {
        try {
            if (payload && typeof payload === "object" && payload.type === "error" && payload.err) {
                const rawSig = createErrorSignature(payload.err);

                if (shouldSkip(rawSig)) {
                    return; // drop duplicate
                }

                const extension = await buildExtendedError(payload.err as ErrorPayload["err"], server, rootPath);

                // Debug: Log what we're sending back to client via WebSocket interception
                console.log("[flame:server:ws:debug] Sending extended error via WebSocket:", {
                    causesCount: extension.causes.length,
                    firstCauseHasOriginalPath: extension.causes[0] ? !!extension.causes[0].originalFilePath : false,
                    firstCauseOriginalPath: extension.causes[0]?.originalFilePath,
                    firstCauseStack: extension.causes[0] ? `${String(extension.causes[0].stack || "").slice(0, 100)}...` : "no causes",
                    hasStack: !!extension.stack,
                    message: extension.message,
                    name: extension.name,
                    stackContainsTsx: String(extension.stack || "").includes(".tsx:") || String(extension.stack || "").includes(".jsx:"),
                    stackContainsUnknown: String(extension.stack || "").includes("<unknown>"),
                    stackLength: String(extension.stack || "").length,
                    stackPreview: `${String(extension.stack || "").slice(0, 200)}...`,
                });

                // eslint-disable-next-line no-param-reassign
                payload.err = extension as ErrorPayload["err"];

                const extensionSig = createExtendedErrorSignature(extension);

                recentErrors.set(extensionSig, Date.now());
            }
        } catch (error) {
            logError(server, "[visulima:vite-overlay:server] ws.send intercept failed", error);
        }

        origSend(payload, client);
    };
};

/**
 * Sets up HMR handler for client-reported runtime errors
 */
const setupHMRHandler = (
    server: ViteServer,
    developmentLogger: DevelopmentLogger,
    shouldSkip: (signature: string) => boolean,
    recentErrors: Map<string, number>,
    rootPath: string,
): void => {
    server.ws.on(MESSAGE_TYPE, async (data: unknown, client: WebSocketClient) => {
        const raw = (data && typeof data === "object" ? (data as Record<string, unknown>) : {}) as RawErrorData;

        const rawSig = createErrorSignature(raw);

        if (shouldSkip(rawSig)) {
            return; // duplicate runtime error
        }

        const syntaicError = new Error(String(raw.message || DEFAULT_ERROR_MESSAGE));

        syntaicError.stack = String(raw.stack || "");

        try {
            // Process the runtime error using shared logic
            await processRuntimeError(syntaicError, rootPath, developmentLogger);

            const extensionPayload = await buildExtendedError(syntaicError, server, rootPath);

            // Debug: Log what we're sending back to client via HMR
            console.log("[flame:server:hmr:debug] Sending extended error via HMR:", {
                causesCount: extensionPayload.causes.length,
                firstCauseHasOriginalPath: extensionPayload.causes[0] ? !!extensionPayload.causes[0].originalFilePath : false,
                firstCauseOriginalPath: extensionPayload.causes[0]?.originalFilePath,
                firstCauseStack: extensionPayload.causes[0] ? `${String(extensionPayload.causes[0].stack || "").slice(0, 100)}...` : "no causes",
                hasStack: !!extensionPayload.stack,
                message: extensionPayload.message,
                name: extensionPayload.name,
                stackContainsTsx: String(extensionPayload.stack || "").includes(".tsx:") || String(extensionPayload.stack || "").includes(".jsx:"),
                stackContainsUnknown: String(extensionPayload.stack || "").includes("<unknown>"),
                stackLength: String(extensionPayload.stack || "").length,
                stackPreview: `${String(extensionPayload.stack || "").slice(0, 200)}...`,
            });

            recentErrors.set(createExtendedErrorSignature(extensionPayload), Date.now());

            client.send({ err: extensionPayload as any, type: "error" });
        } catch (error) {
            logError(server, "[visulima:vite-overlay:server] failed to build extended client error", error);

            client.send({
                err: {
                    message: String(runtimeError.message || DEFAULT_ERROR_MESSAGE),
                    name: String(runtimeError.name || DEFAULT_ERROR_NAME),
                    stack: String(runtimeError.stack || ""),
                } as any,
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

            // Intercept any error payload Vite sends and replace with our extended payload
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
