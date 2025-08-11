import { readFileSync } from "node:fs";

import type { SourceMap } from "@jridgewell/trace-mapping";
import { originalPositionFor, TraceMap } from "@jridgewell/trace-mapping";
import { codeFrame } from "@visulima/error";
import type { ErrorPayload, IndexHtmlTransformResult, Plugin, WebSocketClient } from "vite";
import renderTemplate from "../template";

import { patchOverlay } from "./overlay/patch-overlay";

// Based on
// https://github.com/hi-ogawa/unocss-preset-antd/tree/main/packages/vite-runtime-error-overlay

// based on the idea in
// https://github.com/vitejs/vite/pull/6274#issuecomment-1087749460
// https://github.com/vitejs/vite/issues/2076

// frame generation logic is based on
// https://github.com/vitejs/vite/blob/a073ac4493e54a2204b5b816fbc7d600df3b34ce/packages/vite/src/node/ssr/ssrStacktrace.ts#L23
// https://github.com/vitejs/vite/blob/0a76652c335e7c0bd8d223186b5533c0e10cac90/packages/vite/src/node/server/middlewares/error.ts#L45
// https://github.com/vitejs/vite/blob/29a260cb16025408defc2e8186d1fbf17ee099ac/packages/vite/src/node/utils.ts#L486

const cleanStack = (stack: string) =>
    stack
        .split(/\n/g)
        .filter((l) => /^\s*at/.test(l))
        .join("\n");

const rewriteStacktrace = (stack: string, moduleGraph: import("vite").ModuleGraph): { loc?: { column: number; file: string; line: number }; stack: string } => {
    let loc: { column: number; file: string; line: number } | undefined;

    const rewrittenStack = stack
        .split("\n")
        .map((line) =>
            line.replace(
                /^ {4}at (?:(\S+) )?\(?(?:https|http):\/\/[^/]+(\/[^^\s?]+).*:(\d+):(\d+)\)?$/,
                (input, variableName: string, url: string, lineString: string, columnString: string) => {
                    if (!url) {
                        return input;
                    }

                    // eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
                    const module_ = moduleGraph.urlToModuleMap.get(url);

                    if (!module_) {
                        return input;
                    }

                    let lineNumber = Number(lineString);
                    let colNumber = Number(columnString);

                    const rawMap = module_.transformResult?.map as SourceMap | undefined;

                    if (rawMap) {
                        try {
                            const traced = new TraceMap(rawMap as any);
                            const pos = originalPositionFor(traced, {
                                column: colNumber - 1,
                                line: lineNumber,
                            });

                            if (pos.source && pos.line !== undefined && pos.column !== undefined && pos.line >= 0 && pos.column >= 0) {
                                lineNumber = pos.line;
                                colNumber = pos.column + 1;
                            }
                        } catch {}
                    }

                    const trimmedVariable = variableName ? String(variableName).trim() : "";
                    const sourceFile = module_.file || url;
                    const source = `${sourceFile}:${lineNumber}:${colNumber}`;

                    if (!loc) {
                        loc = { column: Number(colNumber), file: sourceFile, line: Number(lineNumber) };
                    }

                    return !trimmedVariable || trimmedVariable === "eval" ? `    at ${source}` : `    at ${trimmedVariable} (${source})`;
                },
            ),
        )
        .join("\n");

    return { loc, stack: rewrittenStack };
};

const buildErrorMessage = (error: ErrorPayload["err"], lines: string[]): string =>
    [...lines, error.id ? `at ${error.id}${error.loc ? `:${error.loc.line}:${error.loc.column}` : ""}` : undefined, error.frame, error.stack]
        .filter(Boolean)
        .join("\n");

const errorOverlayPlugin = (): Plugin => {
    return {
        apply: "serve",
        // Receive client-reported runtime errors and forward as Vite error payloads
        configureServer(server) {
            const MESSAGE_TYPE = "visulima:flame:error";

            server.ws.on(MESSAGE_TYPE, async (data: unknown, client: WebSocketClient) => {
                const raw = (data && typeof data === "object" ? (data as Record<string, unknown>) : {}) as {
                    message?: string;
                    name?: string;
                    ownerStack?: string | null;
                    stack?: string;
                };

                const runtimeError = Object.assign(new Error(), raw);

                const cleaned = cleanStack(String(runtimeError.stack || ""));
                const { loc, stack } = rewriteStacktrace(cleaned, server.moduleGraph);
                const combinedStack = raw.ownerStack ? `Owner Stack:\n${String(raw.ownerStack)}\n\n${stack}` : stack;
                const source = loc?.file ? readFileSync(loc.file, { encoding: "utf8", flag: "r" }) : undefined;

                // Build a synthetic Error instance for template rendering with sourcemapped stack
                const errorForTemplate = new Error(String(runtimeError.message || "Runtime error"));
                try {
                    (errorForTemplate as any).name = String(runtimeError.name || "Error");
                } catch {}
                try {
                    (errorForTemplate as any).stack = combinedStack;
                } catch {}

                // Render template (full HTML), then extract inline CSS and body content for embedding into overlay
                let flameHtml: string | undefined;
                let flameCss: string | undefined;
                try {
                    const fullHtml = await renderTemplate(errorForTemplate as any, []);
                    const cssMatch = /<style>([\s\S]*?)<\/style>/i.exec(fullHtml);
                    const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(fullHtml);
                    flameCss = cssMatch ? cssMatch[1] : undefined;
                    flameHtml = bodyMatch ? bodyMatch[1] : undefined;
                } catch {}

                const error: ErrorPayload["err"] = {
                    frame:
                        loc && source
                            ? codeFrame(source, { start: { column: loc.column - 1, line: loc.line } }, { linesAbove: 2, linesBelow: 2, showGutter: false })
                            : undefined,
                    id: loc?.file,
                    loc,
                    message: String(runtimeError.message || "Runtime error"),
                    name: String(runtimeError.name || "Error"),
                    plugin: "@visulima/flame",
                    /* custom extension for our overlay */
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    flameHtml,
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    flameCss,
                    stack: combinedStack,
                };

                const message = buildErrorMessage(error, [`Client error: ${error.message}`]);

                server.config.logger.error(message, {
                    clear: true,
                    error: error as any,
                    timestamp: true,
                });

                client.send({ err: error, type: "error" });
            });
        },
        enforce: "pre",

        name: "flame-error-overlay",

        // Replace Vite's overlay class with our custom overlay (Astro-style patch)
        transform(code, id, options) {
            if (options?.ssr) {
                return;
            }

            if (!id.includes("vite/dist/client/client.mjs")) {
                return;
            }

            return patchOverlay(code);
        },

        // Inject a tiny bridge that forwards runtime errors to the dev server over HMR
        transformIndexHtml(): IndexHtmlTransformResult {
            const CLIENT = String.raw`
import { createHotContext } from '/@vite/client';
const hot = createHotContext('/@visulima/flame');
async function send(error) {
  try {
    if (!(error instanceof Error)) error = new Error(String(error ?? '(unknown runtime error)'));
    let ownerStack = null;
    try {
      const mod = await import('react');
      if (mod && typeof mod.captureOwnerStack === 'function') ownerStack = mod.captureOwnerStack();
    } catch {}
    const payload = { message: String(error.message || 'Runtime error'), stack: String(error.stack || ''), ownerStack };
    hot.send('visulima:flame:error', payload);
  } catch {}
}
window.addEventListener('error', (e) => { try { send(e.error); } catch {} });
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
