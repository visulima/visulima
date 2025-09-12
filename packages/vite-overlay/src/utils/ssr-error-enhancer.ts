import { readFile } from "node:fs/promises";

import { parseStacktrace } from "@visulima/error";
import type { ViteDevServer } from "vite";

/**
 * Enhances SSR errors with better stack traces and contextual hints.
 * - Fixes stack traces via Vite's SSR helper
 * - Detects common SSR failure patterns and enriches message/loc
 */
export const enhanceViteSsrError = async (rawError: unknown, server: ViteDevServer): Promise<Error> => {
    const error = (rawError instanceof Error ? rawError : new Error(String(rawError))) as Error & {
        hint?: string;
        id?: string;
        loc?: { column?: number; file?: string; line?: number };
        message: string;
        name: string;
        stack?: string;
        title?: string;
    };

    // Let Vite improve stack traces (source maps etc.)
    try {
        await server.ssrFixStacktrace(error as any);
    } catch {}

    // Best-effort: derive top frame file path from stack
    let topFile: string | undefined;

    try {
        const traces = parseStacktrace(error, { frameLimit: 1 });
        const top = traces?.[0] as any;

        topFile = String(top?.file || error?.loc?.file || error?.id || "");
    } catch {}

    // Load file contents to compute better loc for certain patterns
    let fileContents: string | undefined;

    if (topFile) {
        try {
            fileContents = await readFile(topFile, "utf8");
        } catch {}
    }

    // 1) Enhance Vite SSR loader message: "Failed to load url ... (resolved id: ...)"
    const failedMatch = /Failed to load url\s+(.*?)\s+\(resolved id:/i.exec(error.message);
    const importName = failedMatch?.[1];

    if (importName) {
        (error as any).title = "Failed to Load Module (SSR)";
        error.name = "FailedToLoadModuleSSR";
        error.message = `Failed to load module: ${importName}`;
        (error as any).hint = "Verify import path, ensure a plugin handles this file type during SSR, and check for typos or missing files.";

        if (fileContents && topFile) {
            const fileLines = fileContents.split("\n");
            const lineIndex = fileLines.findIndex((ln) => ln.includes(importName || ""));

            if (lineIndex !== -1) {
                const lineText = fileLines[lineIndex] ?? "";
                const col = Math.max(0, lineText.indexOf(importName || ""));

                (error as any).loc = { column: col + 1, file: topFile, line: lineIndex + 1 };
            }
        }
    }

    // 2) MDX without integration (common SSR parse error)
    const fileId = (error as any).id || (error as any).loc?.file || topFile;

    if (fileId && /\.mdx$/i.test(String(fileId)) && /syntax error/i.test(error.message)) {
        (error as any).hint
            = (error as any).hint || "MDX detected without an appropriate integration. Install and configure the MDX plugin for Vite/your framework.";
    }

    // 3) Invalid glob pattern (improve message and location)
    const globMatch = /glob:\s*"(.+)"\s*\(/i.exec(error.message);
    const globPattern = globMatch?.[1];

    if (globPattern) {
        (error as any).name = "InvalidGlob";
        (error as any).title = "Invalid Glob Pattern";
        error.message = `Invalid glob pattern: ${globPattern}`;
        (error as any).hint
            = (error as any).hint || "Ensure your glob follows the expected syntax and matches existing files. Avoid unintended special characters.";

        if (fileContents && topFile) {
            const fileLines = fileContents.split("\n");
            const lineIndex = fileLines.findIndex((ln) => ln.includes(globPattern || ""));

            if (lineIndex !== -1) {
                const lineText = fileLines[lineIndex] ?? "";
                const col = Math.max(0, lineText.indexOf(globPattern || ""));

                (error as any).loc = { column: col + 1, file: topFile, line: lineIndex + 1 };
            }
        }
    }

    return error;
};
