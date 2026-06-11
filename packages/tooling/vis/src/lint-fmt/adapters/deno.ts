import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import { TOOL_SIGNATURES } from "../../util/tool-signatures";
import type { AdapterRunOptions, Finding, ToolAdapter, ToolPresence } from "../config-types";
import { findFirstConfig } from "../detect";

/**
 * Deno adapter pair. Deno is a runtime, not an npm package, so
 * detection skips `package.json` entirely and looks only for
 * `deno.json` / `deno.jsonc`. The `lint` and `fmt` subcommands are
 * separate invocations with separate output shapes, so we split them
 * into two adapters that share detection:
 *
 *   - `denoLintAdapter`  → `deno lint --json` (parses JSON diagnostics)
 *   - `denoFmtAdapter`   → `deno fmt --check` / `deno fmt`
 *
 * Both call the `deno` binary directly — no `pnpm` indirection since
 * deno isn't an npm package.
 */

const detectDeno
    = (id: "deno-fmt" | "deno-lint") =>
        (root: string): ToolPresence | undefined => {
            const configFile = findFirstConfig(root, TOOL_SIGNATURES.deno.configFiles);

            if (!configFile) {
                return undefined;
            }

            return {
                adapter: id,
                configFile,
                declared: false,
                root,
            };
        };

const isAbsolutePath = (raw: string): boolean => raw.startsWith("/") || /^[a-z]:[\\/]/i.test(raw);

interface DenoLintRange {
    end?: { col?: number; line?: number };
    start?: { col?: number; line?: number };
}

interface DenoLintDiagnostic {
    code?: string;
    filename?: string;
    message?: string;
    range?: DenoLintRange;
}

interface DenoLintReport {
    diagnostics?: ReadonlyArray<DenoLintDiagnostic>;
}

export const denoLintAdapter: ToolAdapter = {
    argsCheck: (files, options) => buildLintArgs(files, options, false),
    argsFix: (files, options) => buildLintArgs(files, options, true),

    bin: () => ["deno", "lint"],

    cacheKey: (presence, options) => {
        const parts = ["deno-lint", presence.configFile ?? "no-config", options.quiet ? "q" : "", ...(options.extraArgs ?? [])];

        return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
    },

    detect: detectDeno("deno-lint"),

    extensions: ["js", "jsx", "mjs", "mts", "ts", "tsx"],
    id: "deno-lint",
    kind: "lint",

    parse: (result, presence) => {
        if (!result.stdout.trim()) {
            return [];
        }

        let report: DenoLintReport;

        try {
            report = JSON.parse(result.stdout) as DenoLintReport;
        } catch {
            return [
                {
                    adapter: "deno-lint",
                    file: presence.root,
                    fixable: false,
                    message: `deno lint output was not valid JSON (exit ${result.exitCode})`,
                    severity: "error",
                },
            ];
        }

        const findings: Finding[] = [];

        for (const diagnostic of report.diagnostics ?? []) {
            // `deno lint` reports 0-based line/col; bump to the 1-based
            // convention the orchestrator uses everywhere else.
            const start = diagnostic.range?.start;
            const end = diagnostic.range?.end;

            findings.push({
                adapter: "deno-lint",
                column: start?.col === undefined ? undefined : start.col + 1,
                endColumn: end?.col === undefined ? undefined : end.col + 1,
                endLine: end?.line === undefined ? undefined : end.line + 1,
                file: resolveFilename(diagnostic.filename ?? presence.root, presence.root),
                fixable: false,
                line: start?.line === undefined ? undefined : start.line + 1,
                message: diagnostic.message ?? "",
                ruleId: diagnostic.code,
                severity: "warning",
            });
        }

        return findings;
    },
};

export const denoFmtAdapter: ToolAdapter = {
    argsCheck: (files, options) => buildFmtArgs(files, options, false),
    argsFix: (files, options) => buildFmtArgs(files, options, true),

    bin: () => ["deno", "fmt"],

    cacheKey: (presence, options) => {
        const parts = ["deno-fmt", presence.configFile ?? "no-config", options.quiet ? "q" : "", ...(options.extraArgs ?? [])];

        return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
    },

    detect: detectDeno("deno-fmt"),

    extensions: [
        "astro",
        "cjs",
        "css",
        "cts",
        "html",
        "ipynb",
        "js",
        "json",
        "jsonc",
        "jsx",
        "less",
        "md",
        "mjs",
        "mts",
        "sass",
        "scss",
        "sql",
        "svelte",
        "ts",
        "tsx",
        "vue",
        "yaml",
        "yml",
    ],
    id: "deno-fmt",
    kind: "fmt",

    parse: (result, presence) => {
        if (result.exitCode === 0) {
            return [];
        }

        // `deno fmt --check` writes a diff to stdout with a "from
        // /path/to/file:" header above each block. We extract just the
        // file paths so the user sees one finding per file, matching
        // the prettier / oxfmt / dprint shape.
        const findings: Finding[] = [];
        const seen = new Set<string>();

        for (const rawLine of result.stdout.split(/\r?\n/)) {
            const match = /^from (.+):$/.exec(rawLine);

            if (!match) {
                continue;
            }

            const file = match[1]!;

            if (seen.has(file)) {
                continue;
            }

            seen.add(file);
            findings.push({
                adapter: "deno-fmt",
                file: isAbsolutePath(file) ? file : `${presence.root}/${file}`,
                fixable: true,
                message: "Code style issues would be auto-fixed",
                severity: "info",
            });
        }

        return findings;
    },
};

const buildLintArgs = (files: ReadonlyArray<string>, options: AdapterRunOptions, fix: boolean): string[] => {
    const args = ["--json"];

    if (fix) {
        args.push("--fix");
    }

    if (options.extraArgs?.length) {
        args.push(...options.extraArgs);
    }

    args.push(...files);

    return args;
};

const buildFmtArgs = (files: ReadonlyArray<string>, options: AdapterRunOptions, fix: boolean): string[] => {
    const args: string[] = [];

    if (!fix) {
        args.push("--check");
    }

    if (options.quiet) {
        args.push("--quiet");
    }

    if (options.extraArgs?.length) {
        args.push(...options.extraArgs);
    }

    args.push(...files);

    return args;
};

const resolveFilename = (filename: string, root: string): string => {
    if (filename.startsWith("file://")) {
        return fileURLToPath(filename);
    }

    if (isAbsolutePath(filename)) {
        return filename;
    }

    return `${root}/${filename}`;
};
