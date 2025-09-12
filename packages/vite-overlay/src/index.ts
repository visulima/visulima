import { getErrorCauses } from "@visulima/error/error";
import { terminalOutput } from "../../../shared/utils/cli-error-builder";
import { parseStacktrace, formatStacktrace } from "@visulima/error";
import type { ErrorPayload, IndexHtmlTransformResult, Plugin, WebSocketClient } from "vite";

import { patchOverlay } from "./overlay/patch-overlay";

import { buildExtendedErrorData } from "./utils/error-data-builder";
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

type ExtendedErrorPayload = {
    name: string;
    message: string;
    stack?: string;
    causes: Array<{
        name: string;
        message: string;
        stack?: string;
        filePath?: string;
        fileLine?: number;
        fileColumn?: number;
        snippet?: string;
        codeFrameContent?: string;
        originalSnippet?: string;
        compiledSnippet?: string;
        originalCodeFrameContent?: string;
        compiledCodeFrameContent?: string;
        compiledFilePath?: string;
        compiledLine?: number;
        compiledColumn?: number;
        fixPrompt?: string;
    }>;
    isServerError?: boolean;
};

const cleanStack = (stack: string) => formatStacktrace(parseStacktrace({ stack } as unknown as Error));

const errorOverlayPlugin = (): Plugin => {
    return {
        apply: "serve",
        // Receive client-reported runtime errors and forward as Vite error payloads
        configureServer(server) {
            const rootPath = server.config.root || process.cwd();

            // Pretty terminal output
            const devLogger = {
                error: (msg: unknown) => server.config.logger.error(String(msg ?? ""), { clear: true, timestamp: true }),
                log: (msg: unknown) => server.config.logger.info(String(msg ?? "")),
            };

            const RECENT_ERROR_TTL_MS = 500;
            const recentErrors = new Map<string, number>();
            const shouldSkip = (sig: string): boolean => {
                const now = Date.now();
                const last = recentErrors.get(sig) || 0;
                
                if (now - last < RECENT_ERROR_TTL_MS) {
                    return true;
                }

                recentErrors.set(sig, now);
                
                return false;
            };

            const sigFromRaw = (raw: any): string =>
                `${String(raw?.message || "")}\n${String(raw?.stack || "")}`;

            const sigFromExt = (ext: ExtendedErrorPayload): string => {
                const c0 = ext.causes?.[0];
                return `${ext.name}|${ext.message}|${c0?.filePath || ""}|${c0?.fileLine || 0}`;
            };

            

            const buildExtendedError = async (rawErr: ErrorPayload["err"] | Error): Promise<ExtendedErrorPayload> => {
                try {
                    const name = String((rawErr as any)?.name || "Error");
                    const message = String((rawErr as any)?.message || "Runtime error");
                    const rawStack = String((rawErr as any)?.stack || "");
                    const cleanedRawStack = cleanStack(absolutizeStackUrls(rawStack, rootPath));

                    // Build a synthetic error to feed the stack parser (fallback only)
                    const synthetic = new Error(message);
                    (synthetic as any).name = name;
                    (synthetic as any).stack = `${name}: ${message}\n${cleanedRawStack}`;

                    // Prefer causes provided by the client (from Error.cause / AggregateError)
                    const providedCauses = Array.isArray((rawErr as any)?.causes)
                        ? ((rawErr as any).causes as Array<{ name?: string; message?: string; stack?: string }>)
                        : undefined;

                    const allCauses: Error[] = providedCauses && providedCauses.length > 0
                        ? providedCauses.map((c) => {
                            const e = new Error(String(c?.message || ""));
                            (e as any).name = String(c?.name || "Error");
                            const st = absolutizeStackUrls(String(c?.stack || ""), rootPath);
                            (e as any).stack = st && /\S/.test(st) ? st : `${(e as any).name}: ${String(c?.message || "")}`;
                            return e;
                        })
                        : getErrorCauses(rawErr instanceof Error ? (rawErr as Error) : synthetic);
                    
                    if (allCauses.length === 0) {
                        throw new Error("No errors found in the error stack");
                    }

                    // Build extended data for all causes (main cause + all nested causes)
                    const extendedCauses = await Promise.all(
                        allCauses.map(async (cause) => {
                            const extendedData = await buildExtendedErrorData(cause as Error, server);

                            return {
                                name: String((cause as any)?.name || "Error"),
                                message: String((cause as any)?.message || ""),
                                stack: cleanStack(absolutizeStackUrls(String((cause as any)?.stack || ""), rootPath)),
                                ...extendedData
                            };
                        })
                    );

                    const payload: ExtendedErrorPayload = {
                        name,
                        message,
                        stack: cleanedRawStack,
                        causes: extendedCauses,
                        isServerError: false,
                    };

                    return payload;
                } catch (e) {
                    try {
                        server.config.logger.error(`[visulima:vite-overlay:server] buildExtendedError failure: ${String(e)}`);
                    } catch {}
                    return {
                        name: String((rawErr as any)?.name || "Error"),
                        message: String((rawErr as any)?.message || "Runtime error"),
                        stack: cleanStack(absolutizeStackUrls(String((rawErr as any)?.stack || ""), rootPath)),

                        causes: [],
                    };
                }
            };

            // Intercept any error payload Vite sends and replace with our extended payload
            const origSend = server.ws.send.bind(server.ws);
            
            (server.ws as any).send = async (payload: any, client?: any) => {
                try {
                    if (payload && typeof payload === "object" && payload.type === "error" && payload.err) {
                        const rawSig = sigFromRaw(payload.err);
                        
                        if (shouldSkip(rawSig)) {
                            return; // drop duplicate
                        }
                        
                        const ext = await buildExtendedError(payload.err as any);
                        
                        payload.err = ext as any;
                        
                        const extSig = sigFromExt(ext);

                        recentErrors.set(extSig, Date.now());
                    }
                } catch (e) {
                    server.config.logger.warn(`[visulima:vite-overlay:server] ws.send intercept failed: ${String(e)}`);
                }

                return origSend(payload, client);
            };

            const MESSAGE_TYPE = "visulima:vite-overlay:error";

            server.ws.on(MESSAGE_TYPE, async (data: unknown, client: WebSocketClient) => {
                const raw = (data && typeof data === "object" ? (data as Record<string, unknown>) : {}) as {
                    message?: string;
                    name?: string;
                    ownerStack?: string | null;
                    stack?: string;
                    file?: string | null;
                    line?: number | null;
                    column?: number | null;
                };

                // Create an Error instance so downstream parsers work consistently
                const runtimeError = Object.assign(new Error(String(raw.message || "Runtime error")), raw);

                try {
                    try { await server.ssrFixStacktrace(runtimeError as any); } catch (e) {
                        try { server.config.logger.info(`[visulima:vite-overlay:server] ssrFixStacktrace failed: ${String(e)}`); } catch {}
                    }

                    try { Object.assign(runtimeError, await enhanceViteSsrError(runtimeError, server)); } catch (e) {
                        try { server.config.logger.info(`[visulima:vite-overlay:server] enhanceViteSsrError failed: ${String(e)}`); } catch {}
                    }

                    // Ensure terminal logs show absolute filesystem paths instead of dev URLs
                    try {
                        runtimeError.stack = cleanStack(absolutizeStackUrls(String(runtimeError.stack || ""), rootPath));
                    } catch {}

                    const rawSig = sigFromRaw(raw);
                    
                    if (shouldSkip(rawSig)) {
                        return; // duplicate runtime error
                    }
                    
                    const extPayload = await buildExtendedError(runtimeError);

                    recentErrors.set(sigFromExt(extPayload), Date.now());

                    // Pretty dev-server logs using cli-handler (ANSI formatted + optional solutions)
                    await terminalOutput(runtimeError, { logger: devLogger });

                    client.send({ err: extPayload as any, type: "error" });
                } catch (e) {
                    server.config.logger.error(`[visulima:vite-overlay:server] failed to build extended client error: ${String(e)}`);
                    
                    client.send({
                        err: {
                            name: String(runtimeError.name || "Error"),
                            message: String(runtimeError.message || "Runtime error"),
                            stack: String(runtimeError.stack || ""),
                        } as any,
                        type: "error",
                    });
                }
            });

            // Capture unhandled rejections on the dev server process and surface them in the overlay
            const handleUnhandledRejection = async (reason: unknown) => {
                const runtimeError = reason instanceof Error ? reason : new Error(String((reason as any)?.stack || reason));
                
                try { 
                    await server.ssrFixStacktrace(runtimeError as any);
                } catch (e) {
                    server.config.logger.info(`[visulima:vite-overlay:server] ssrFixStacktrace failed: ${String(e)}`);
                }
                try {
                    Object.assign(runtimeError, await enhanceViteSsrError(runtimeError, server));
                } catch (e) {
                    server.config.logger.info(`[visulima:vite-overlay:server] enhanceViteSsrError failed: ${String(e)}`);
                }

                // Ensure terminal logs show absolute filesystem paths
                try {
                    runtimeError.stack = cleanStack(absolutizeStackUrls(String(runtimeError.stack || ""), rootPath));
                } catch {}

                await terminalOutput(runtimeError, { logger: devLogger });

                // Let our ws interceptor normalize to extended payload
                server.ws.send({ type: "error", err: runtimeError } as any);
            };

            try {
                process.on("unhandledRejection", handleUnhandledRejection);
                server.httpServer?.on("close", () => {
                    try { process.off("unhandledRejection", handleUnhandledRejection); } catch {}
                });
            } catch {}
        },
        enforce: "pre",

        name: "visulima-vite-overlay",

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
            const CLIENT = String.raw`
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
        out.push({ name: String(err?.name || 'Error'), message: String(err?.message || ''), stack: String(err?.stack || '') });
        // Traverse Error.cause chain (depth-limited)
        let cur = err?.cause;
        let guard = 0;
        while (cur && guard < 8) {
          out.push({ name: String(cur?.name || 'Error'), message: String(cur?.message || ''), stack: String(cur?.stack || '') });
          cur = cur?.cause;
          guard++;
        }
        // If AggregateError, append nested errors
        if (Array.isArray(err?.errors)) {
          for (const sub of err.errors) {
            if (!sub) continue;
            out.push({ name: String(sub?.name || 'Error'), message: String(sub?.message || ''), stack: String(sub?.stack || '') });
          }
        }
      } catch {}
      return out;
    };
    const payload = { message: String(error.message || 'Runtime error'), stack: String(error.stack || ''), ownerStack, file: loc?.filename || null, line: loc?.lineno || null, column: loc?.colno || null, causes: collectCauses(error) };
    hot.send('visulima:vite-overlay:error', payload);
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

            return {
                html: "",
                tags: [{ attrs: { type: "module" }, children: CLIENT, injectTo: "head" as const, tag: "script" }],
            };
        },
    };
};

export default errorOverlayPlugin;
