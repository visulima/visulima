// Core Vite and error handling imports
import { getErrorCauses } from "@visulima/error/error";
import type { ErrorPayload, IndexHtmlTransformResult, Plugin, WebSocketClient } from "vite";

// Internal imports - organized by category
import { terminalOutput } from "../../../shared/utils/cli-error-builder";
// Constants
import { CAUSE_CHAIN_DEPTH_LIMIT, DEFAULT_ERROR_MESSAGE, DEFAULT_ERROR_NAME, MESSAGE_TYPE, PLUGIN_NAME, RECENT_ERROR_TTL_MS } from "./constants";
// Overlay components
import { patchOverlay } from "./overlay/patch-overlay";
// Types
import type { DevelopmentLogger, ExtendedErrorPayload, RawErrorData, RecentErrorTracker, ViteServer } from "./types";
// Utilities
import buildExtendedErrorData from "./utils/error-processing";
import { extractErrorInfo, logError } from "./utils/error-utils";
import enhanceViteSsrError from "./utils/ssr-error-enhancer";
import { absolutizeStackUrls, cleanErrorStack } from "./utils/stack-trace-utils";

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
        const { message, name, stack: rawStack } = extractErrorInfo(rawError);
        const cleanedRawStack = absolutizeStackUrls(cleanErrorStack(rawStack), rootPath);

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
            message,
            name,
            stack: cleanedRawStack,
        };

        return payload;
    } catch (error) {
        logError(server, "[visulima:vite-overlay:server] buildExtendedError failure", error);

        return {
            causes: [],
            ...extractErrorInfo(rawError),
            stack: absolutizeStackUrls(cleanErrorStack(extractErrorInfo(rawError).stack), rootPath),
        };
    }
};

/**
 * Generates the client-side script that forwards runtime errors to the dev server
 */
const generateClientScript = (): string => String.raw`
import { createHotContext } from '/@vite/client';
const hot = createHotContext('/@visulima/vite-overlay');

       const send = async (error, loc) => {
         try {
           if (!(error instanceof Error)) error = new Error(String(error ?? '(unknown runtime error)'));

           let ownerStack = null;
           try {
             const mod = await import('react');
             if (mod && typeof mod.captureOwnerStack === 'function') ownerStack = mod.captureOwnerStack();
           } catch {}

           const collectCauses = function(err) {
             const out = [];
             try {
               // Include the top-level error first
               out.push({ name: String((err && err.name) || '${DEFAULT_ERROR_NAME}'), message: String((err && err.message) || ''), stack: String((err && err.stack) || '') });
               // Traverse Error.cause chain (depth-limited)
               var cur = err && err.cause;
               var guard = 0;
               while (cur && guard < ${CAUSE_CHAIN_DEPTH_LIMIT}) {
                 out.push({ name: String((cur && cur.name) || '${DEFAULT_ERROR_NAME}'), message: String((cur && cur.message) || ''), stack: String((cur && cur.stack) || '') });
                 cur = cur && cur.cause;
                 guard++;
               }
               // If AggregateError, append nested errors
               if (Array.isArray(err && err.errors)) {
                 for (var i = 0; i < err.errors.length; i++) {
                   var sub = err.errors[i];
                   if (!sub) continue;
                   out.push({ name: String((sub && sub.name) || '${DEFAULT_ERROR_NAME}'), message: String((sub && sub.message) || ''), stack: String((sub && sub.stack) || '') });
                 }
               }
             } catch (error) {}
             return out;
           };
           const payload = { message: String(error.message || '${DEFAULT_ERROR_MESSAGE}'), stack: String(error.stack || ''), ownerStack, file: loc?.filename || null, line: loc?.lineno || null, column: loc?.colno || null, causes: collectCauses(error) };

           // Debug: Log what we're sending to server
           console.log('[flame:client:debug] Sending error payload to server:', {
             message: payload.message,
             hasStack: !!payload.stack,
             stackLength: payload.stack.length,
             stackPreview: payload.stack.slice(0, 200) + '...',
             stackContainsUnknown: payload.stack.includes('<unknown>'),
             stackContainsTsx: payload.stack.includes('.tsx:') || payload.stack.includes('.jsx:'),
             file: payload.file,
             line: payload.line,
             column: payload.column,
             causesCount: payload.causes.length,
             firstCauseStack: payload.causes[0] ? payload.causes[0].stack.slice(0, 100) + '...' : 'no causes',
           });

           hot.send('${MESSAGE_TYPE}', payload);
         } catch {}
       };
       window.addEventListener('error', (e) => { try { send(e.error, { filename: e.filename, lineno: e.lineno, colno: e.colno }); } catch {} });
       window.addEventListener('unhandledrejection', (e) => { try { send(e.reason); } catch {} });

       // Listen for React error boundary events
       window.addEventListener('react-error-boundary', function(e) {
         try {
           var detail = e.detail;
           if (detail && detail.error) {
             send(detail.error);
           }
         } catch (error) {}
       });

       // Simple console.error override to catch React error boundary logs
       (function(){
         const orig = console.error;
         console.error = function() {
           try {
             const args = Array.prototype.slice.call(arguments);
             const err = args.find((a) => a instanceof Error);

             if (err) {
               // Debug: Log what we're capturing from console.error
               console.log('[flame:client:console:debug] Capturing error from console.error:', {
                 message: err.message,
                 hasStack: !!err.stack,
                 stackLength: String(err.stack || '').length,
                 stackPreview: String(err.stack || '').slice(0, 200) + '...',
                 stackContainsUnknown: String(err.stack || '').includes('<unknown>'),
                 stackContainsTsx: String(err.stack || '').includes('.tsx:') || String(err.stack || '').includes('.jsx:'),
                 name: err.name,
               });

               // Send React-enhanced errors from console.error (like from error boundaries)
               send(err);
             }
           } catch {}
           return orig.apply(console, arguments);
         }
       })();
`;

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

        // Debug: Log what we received from client
        console.log("[flame:server:debug] Received raw error from client:", {
            causesCount: (raw as any).causes ? (raw as any).causes.length : 0,
            column: raw.column,
            file: raw.file,
            hasCauses: !!(raw as any).causes && (raw as any).causes.length > 0,
            hasStack: !!raw.stack,
            line: raw.line,
            message: raw.message,
            stackContainsTsx: String(raw.stack || "").includes(".tsx:") || String(raw.stack || "").includes(".jsx:"),
            stackContainsUnknown: String(raw.stack || "").includes("<unknown>"),
            stackLength: String(raw.stack || "").length,
            stackPreview: `${String(raw.stack || "").slice(0, 200)}...`,
        });

        const rawSig = createErrorSignature(raw);

        if (shouldSkip(rawSig)) {
            return; // duplicate runtime error
        }

        // Create an Error instance so downstream parsers work consistently
        const runtimeError = Object.assign(new Error(String(raw.message || DEFAULT_ERROR_MESSAGE)), raw);

        try {
            // Process the runtime error using shared logic
            await processRuntimeError(runtimeError, rootPath, developmentLogger);

            const extensionPayload = await buildExtendedError(runtimeError, server, rootPath);

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
