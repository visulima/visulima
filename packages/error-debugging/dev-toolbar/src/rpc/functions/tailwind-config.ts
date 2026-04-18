import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import type { ViteDevServer } from "vite";

interface TailwindConfigResult {
    /** CSS files that \@import tailwindcss */
    cssFiles: string[];
    /** User-defined \@theme overrides/extensions */
    customTheme: Record<string, string>;
    /** Full default Tailwind theme tokens */
    defaultTheme: Record<string, string>;
    /** Detected Tailwind version */
    version: "v3" | "v4" | "unknown";
}

// ─── CSS @theme block parser ──────────────────────────────────────────────────

const CSS_COMMENT_REGEX = /\/\*[\s\S]*?\*\//g;
const WHITESPACE_REGEX = /\s+/g;
const STRIP_DEFAULT_THEME_REGEX = /@theme\s+default[^{]*\{[\s\S]*?\}/g;

/**
 * Extract CSS custom properties from \@theme blocks.
 * Handles multi-line values (e.g. font stacks) and nested parentheses.
 */
// eslint-disable-next-line sonarjs/slow-regex, regexp/no-super-linear-backtracking
const VARIABLE_REGEX = /(--[\w-]+)\s*:\s*([\s\S]*?);/g;

const parseThemeVariables = (css: string): Record<string, string> => {
    const variables: Record<string, string> = {};

    // Strip CSS comments
    const stripped = css.replaceAll(CSS_COMMENT_REGEX, "");

    let i = 0;

    while (i < stripped.length) {
        const atTheme = stripped.indexOf("@theme", i);

        if (atTheme === -1) {
            break;
        }

        const openBrace = stripped.indexOf("{", atTheme);

        if (openBrace === -1) {
            break;
        }

        // Walk forward counting braces to find the matching close
        let depth = 1;
        let j = openBrace + 1;

        while (j < stripped.length && depth > 0) {
            if (stripped[j] === "{") {
                depth += 1;
            } else if (stripped[j] === "}") {
                depth -= 1;
            }

            j += 1;
        }

        const blockContent = stripped.slice(openBrace + 1, j - 1);

        VARIABLE_REGEX.lastIndex = 0;
        let m: RegExpExecArray | null = VARIABLE_REGEX.exec(blockContent);

        while (m !== null) {
            const value = (m[2] as string).replaceAll(WHITESPACE_REGEX, " ").trim();

            // First occurrence wins — main block takes priority over deprecated aliases
            if (value && !variables[m[1] as string]) {
                variables[m[1] as string] = value;
            }

            m = VARIABLE_REGEX.exec(blockContent);
        }

        i = j;
    }

    return variables;
};

// ─── Find CSS files that import Tailwind ──────────────────────────────────────

const findTailwindCSSFiles = async (root: string): Promise<string[]> => {
    const results: string[] = [];

    const walk = async (directory: string, depth: number): Promise<void> => {
        if (depth > 4) {
            return;
        }

        let entries: Dirent[];

        try {
            entries = await fs.readdir(directory, { encoding: "utf8", withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            const fullPath = path.join(directory, entry.name);

            if (entry.isDirectory()) {
                if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") {
                    continue;
                }

                // eslint-disable-next-line no-await-in-loop
                await walk(fullPath, depth + 1);
            } else if (entry.name.endsWith(".css")) {
                try {
                    // eslint-disable-next-line no-await-in-loop
                    const content = await fs.readFile(fullPath, "utf8");

                    if (content.includes("@import") && (content.includes("\"tailwindcss\"") || content.includes("'tailwindcss'"))) {
                        results.push(fullPath);
                    }
                } catch {
                    // skip unreadable files
                }
            }
        }
    };

    await walk(root, 0);

    return results;
};

// ─── Extract user @theme overrides ───────────────────────────────────────────

const extractUserTheme = async (cssFiles: string[]): Promise<Record<string, string>> => {
    const variables: Record<string, string> = {};

    for (const file of cssFiles) {
        try {
            // eslint-disable-next-line no-await-in-loop
            const content = await fs.readFile(file, "utf8");

            // Strip @theme default blocks so we only capture the user's own overrides
            STRIP_DEFAULT_THEME_REGEX.lastIndex = 0;
            const userThemeContent = content.replaceAll(STRIP_DEFAULT_THEME_REGEX, "");
            const fileVariables = parseThemeVariables(userThemeContent);

            Object.assign(variables, fileVariables);
        } catch {
            // skip
        }
    }

    return variables;
};

// ─── Main RPC function ────────────────────────────────────────────────────────

const getTailwindConfig = async (server: ViteDevServer): Promise<TailwindConfigResult> => {
    const { root } = server.config;

    let version: TailwindConfigResult["version"] = "unknown";
    let defaultTheme: Record<string, string> = {};

    // Detect Tailwind v3 by presence of tailwind.config.* in project root
    const v3Configs = ["tailwind.config.js", "tailwind.config.ts", "tailwind.config.mjs", "tailwind.config.cjs"];

    for (const f of v3Configs) {
        try {
            // eslint-disable-next-line no-await-in-loop
            await fs.access(path.join(root, f));
            version = "v3";
            break;
        } catch {
            // not found — try next
        }
    }

    // Read the full Tailwind v4 default theme from the installed package
    try {
        const request = createRequire(import.meta.url);
        const themeCssPath = request.resolve("tailwindcss/theme.css");

        const themeCss = await fs.readFile(themeCssPath, "utf8");

        defaultTheme = parseThemeVariables(themeCss);

        if (Object.keys(defaultTheme).length > 0 && version !== "v3") {
            version = "v4";
        }
    } catch {
        // tailwindcss not installed or path differs
    }

    const cssFiles = await findTailwindCSSFiles(root);
    const customTheme = await extractUserTheme(cssFiles);

    return {
        cssFiles: cssFiles.map((f) => path.relative(root, f)),
        customTheme,
        defaultTheme,
        version,
    };
};

export type { TailwindConfigResult };
export { getTailwindConfig };
export default getTailwindConfig;
