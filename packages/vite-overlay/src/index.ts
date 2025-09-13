// Core Vite and error handling imports
import { formatStacktrace, parseStacktrace } from "@visulima/error";
import { getErrorCauses } from "@visulima/error/error";
import type { ErrorPayload, IndexHtmlTransformResult, Plugin, WebSocketClient } from "vite";

// Internal imports - organized by category
import { terminalOutput } from "../../../shared/utils/cli-error-builder";
// Constants
import { CAUSE_CHAIN_DEPTH_LIMIT, DEFAULT_ERROR_MESSAGE, DEFAULT_ERROR_NAME, MESSAGE_TYPE, PLUGIN_NAME, RECENT_ERROR_TTL_MS } from "./constants";
// Overlay components
import { patchOverlay } from "./overlay/patch-overlay";
// Types
import type { DevelopmentLogger, ExtendedErrorPayload, ProvidedCause, RawErrorData, RecentErrorTracker, ViteServer } from "./types";
// Utilities
import buildExtendedErrorData from "./utils/error-data-builder";
import { extractErrorInfo, logError, safeAsync, safeSync } from "./utils/error-utils";
import { enhanceViteSsrError } from "./utils/ssr-error-enhancer";
import { absolutizeStackUrls } from "./utils/stack-trace-utils";

// Based on
// https://github.com/hi-ogawa/unocss-preset-antd/tree/main/packages/vite-runtime-error-overlay

// based on the idea in
// https://github.com/vitejs/vite/pull/6274#issuecomment-1087749460
// https://github.com/vitejs/vite/issues/2076

// frame generation logic is based on
// https://github.com/vitejs/vite/blob/a073ac4493e54a2204b5b816fbc7d600df3b34ce/packages/vite/src/node/ssr/ssrStacktrace.ts#L23
// https://github.com/vitejs/vite/blob/0a76652c335e7c0bd8d223186b5533c0e10cac90/packages/vite/src/node/server/middlewares/error.ts#L45
// https://github.com/vitejs/vite/blob/29a260cb16025408defc2e8186d1fbf17ee099ac/packages/vite/src/node/utils.ts#L486

// Utility function to clean and format stack traces
const cleanStack = (stack: string): string => formatStacktrace(parseStacktrace({ stack } as unknown as Error));

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

const createUnhandledRejectionHandler = (server: ViteServer, rootPath: string, developmentLogger: DevelopmentLogger) => async (reason: unknown) => {
    const runtimeError = reason instanceof Error ? reason : new Error(String((reason as any)?.stack || reason));

    safeSync(
        () => server.ssrFixStacktrace(runtimeError as any),
        undefined,
        (error) => logError(server, "[visulima:vite-overlay:server] ssrFixStacktrace failed", error),
    );

    await safeAsync(
        () =>
            enhanceViteSsrError(runtimeError, server).then((enhanced) => {
                Object.assign(runtimeError, enhanced);
            }),
        undefined,
        (error) => logError(server, "[visulima:vite-overlay:server] enhanceViteSsrError failed", error),
    );

    // Ensure terminal logs show absolute filesystem paths
    safeSync(() => {
        runtimeError.stack = cleanStack(absolutizeStackUrls(String(runtimeError.stack || ""), rootPath));
    }, undefined);

    await terminalOutput(runtimeError, { logger: developmentLogger });

    // Let our ws interceptor normalize to extended payload
    server.ws.send({ err: runtimeError, type: "error" } as any);
};

const buildExtendedError = async (rawError: ErrorPayload["err"] | Error, server: ViteServer, rootPath: string): Promise<ExtendedErrorPayload> => {
    try {
        const { message, name, stack: rawStack } = extractErrorInfo(rawError);
        const cleanedRawStack = cleanStack(absolutizeStackUrls(rawStack, rootPath));

        // Build a synthetic error to feed the stack parser (fallback only)
        const synthetic = new Error(message);

        (synthetic as any).name = name;
        (synthetic as any).stack = `${name}: ${message}\n${cleanedRawStack}`;

        // Prefer causes provided by the client (from Error.cause / AggregateError)
        const providedCauses = Array.isArray((rawError as any)?.causes) ? ((rawError as any).causes as ProvidedCause[]) : undefined;

        const allCauses: Error[]
            = providedCauses && providedCauses.length > 0
                ? providedCauses.map((c) => {
                    const e = new Error(String(c?.message || ""));

                    (e as any).name = String(c?.name || DEFAULT_ERROR_NAME);
                    const st = absolutizeStackUrls(String(c?.stack || ""), rootPath);

                    (e as any).stack = st && /\S/.test(st) ? st : `${(e as any).name}: ${String(c?.message || "")}`;

                    return e;
                })
                : getErrorCauses(rawError instanceof Error ? (rawError as Error) : synthetic);

        if (allCauses.length === 0) {
            throw new Error("No errors found in the error stack");
        }

        // Build extended data for all causes (main cause + all nested causes)
        const extendedCauses = await Promise.all(
            allCauses.map(async (cause) => {
                const extendedData = await buildExtendedErrorData(cause as Error, server);

                return {
                    message: String((cause as any)?.message || ""),
                    name: String((cause as any)?.name || DEFAULT_ERROR_NAME),
                    stack: cleanStack(absolutizeStackUrls(String((cause as any)?.stack || ""), rootPath)),
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
            stack: cleanStack(absolutizeStackUrls(extractErrorInfo(rawError).stack, rootPath)),
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
    const collectCauses = (err) => {
      const out = [];
      try {
        // Include the top-level error first
        out.push({ name: String(err?.name || '${DEFAULT_ERROR_NAME}'), message: String(err?.message || ''), stack: String(err?.stack || '') });
        // Traverse Error.cause chain (depth-limited)
        let cur = err?.cause;
        let guard = 0;
        while (cur && guard < ${CAUSE_CHAIN_DEPTH_LIMIT}) {
          out.push({ name: String(cur?.name || '${DEFAULT_ERROR_NAME}'), message: String(cur?.message || ''), stack: String(cur?.stack || '') });
          cur = cur?.cause;
          guard++;
        }
        // If AggregateError, append nested errors
        if (Array.isArray(err?.errors)) {
          for (const sub of err.errors) {
            if (!sub) continue;
            out.push({ name: String(sub?.name || '${DEFAULT_ERROR_NAME}'), message: String(sub?.message || ''), stack: String(sub?.stack || '') });
          }
        }
      } catch {}
      return out;
    };
    const payload = { message: String(error.message || '${DEFAULT_ERROR_MESSAGE}'), stack: String(error.stack || ''), ownerStack, file: loc?.filename || null, line: loc?.lineno || null, column: loc?.colno || null, causes: collectCauses(error) };
    hot.send('${MESSAGE_TYPE}', payload);
  } catch {}
};
window.addEventListener('error', (e) => { try { send(e.error, { filename: e.filename, lineno: e.lineno, colno: e.colno }); } catch {} });
window.addEventListener('unhandledrejection', (e) => { try { send(e.reason); } catch {} });
(function(){
  const orig = console.error;
  console.error = function() {
    try {
      const args = Array.prototype.slice.call(arguments);
      const err = args.find((a) => a instanceof Error);
      if (err) send(err); else {
      const joined = args.map(String).join(' ');
        const re = /(uncaught|error:|typeerror|referenceerror|syntaxerror|hydration failed|did not match)/i;
        if (re.test(joined)) send(new Error(joined));
      }
    } catch {}
    return orig.apply(console, arguments);
  }
})();
`;

/**
 * Sets up WebSocket interception to enhance error payloads before sending
 */
const setupWebSocketInterception = (
    server: ViteServer,
    shouldSkip: (signature: string) => boolean,
    recentErrors: Map<string, number>,
    rootPath: string,
): void => {
    const origSend = server.ws.send.bind(server.ws);

    (server.ws as any).send = async (payload: any, client?: any) => {
        try {
            if (payload && typeof payload === "object" && payload.type === "error" && payload.err) {
                const rawSig = createErrorSignature(payload.err);

                if (shouldSkip(rawSig)) {
                    return; // drop duplicate
                }

                const extension = await buildExtendedError(payload.err as any, server, rootPath);

                // Debug: Log what we're sending to the client
                if (extension?.causes?.[0]) {
                    const firstCause = extension.causes[0];

                    console.log("[vite-overlay:server:debug] Sending to client:", {
                        originalCodeFrameLength: firstCause.originalCodeFrameContent?.length || 0,
                        compiledFilePath: firstCause.compiledFilePath,
                        compiledSnippetLength: firstCause.compiledSnippet?.length || 0,
                        errorName: firstCause.name,
                        originalFilePath: firstCause.originalFilePath,
                        hasCodeFrame: !!firstCause.originalCodeFrameContent || !!firstCause.compiledCodeFrameContent,
                        hasCompiledCodeFrame: !!firstCause.compiledCodeFrameContent,
                        hasCompiledSnippet: !!firstCause.compiledSnippet,
                        hasOriginalCodeFrame: !!firstCause.originalCodeFrameContent,
                        hasOriginalSnippet: !!firstCause.originalSnippet,
                        originalSnippetLength: firstCause.originalSnippet?.length || 0,
                    });
                }

                payload.err = extension as any;

                const extensionSig = createExtendedErrorSignature(extension);

                recentErrors.set(extensionSig, Date.now());
            }
        } catch (error) {
            logError(server, "[visulima:vite-overlay:server] ws.send intercept failed", error);
        }

        return origSend(payload, client);
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

        // Create an Error instance so downstream parsers work consistently
        const runtimeError = Object.assign(new Error(String(raw.message || DEFAULT_ERROR_MESSAGE)), raw);

        try {
            safeSync(
                () => server.ssrFixStacktrace(runtimeError as any),
                undefined,
                (error) => logError(server, "[visulima:vite-overlay:server] ssrFixStacktrace failed", error),
            );

            await safeAsync(
                () =>
                    enhanceViteSsrError(runtimeError, server).then((enhanced) => {
                        Object.assign(runtimeError, enhanced);
                    }),
                undefined,
                (error) => logError(server, "[visulima:vite-overlay:server] enhanceViteSsrError failed", error),
            );

            // Ensure terminal logs show absolute filesystem paths instead of dev URLs
            safeSync(() => {
                runtimeError.stack = cleanStack(absolutizeStackUrls(String(runtimeError.stack || ""), rootPath));
            }, undefined);

            const rawSig = createErrorSignature(raw);

            if (shouldSkip(rawSig)) {
                return; // duplicate runtime error
            }

            const extensionPayload = await buildExtendedError(runtimeError, server, rootPath);

            recentErrors.set(createExtendedErrorSignature(extensionPayload), Date.now());

            // Pretty dev-server logs using cli-handler (ANSI formatted + optional solutions)
            await terminalOutput(runtimeError, { logger: developmentLogger });

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

            // Initialize utilities
            const developmentLogger = createDevelopmentLogger(server);
            const { recentErrors, shouldSkip } = createRecentErrorTracker();

            // Intercept any error payload Vite sends and replace with our extended payload
            setupWebSocketInterception(server, shouldSkip, recentErrors, rootPath);

            // Handle client-reported errors via HMR
            setupHMRHandler(server, developmentLogger, shouldSkip, recentErrors, rootPath);

            // Capture unhandled rejections on the dev server process and surface them in the overlay
            const handleUnhandledRejection = createUnhandledRejectionHandler(server, rootPath, developmentLogger);

            try {
                process.on("unhandledRejection", handleUnhandledRejection);
                server.httpServer?.on("close", () => {
                    try {
                        process.off("unhandledRejection", handleUnhandledRejection);
                    } catch {}
                });
            } catch {}
        },
        enforce: "pre",

        name: PLUGIN_NAME,

        // Replace Vite's overlay class with our custom overlay (Astro-style patch)
        transform(code, id, options) {
            if (options?.ssr) {
                return;
            }

            if (!(id.includes("vite/dist/client/client.mjs") || id.includes("/@vite/client"))) {
                return;
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

// Export Vue error adapter for testing
export { parseVueCompilationError };
