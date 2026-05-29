import { createHash } from "node:crypto";

import type { AdapterRunOptions, Finding, ToolAdapter } from "../config-types";
import { declaredVersion, findFirstConfig } from "../detect";

/**
 * Oxfmt adapter. Rust-native Prettier-compatible formatter. Shape
 * mirrors the prettier adapter: detect on `.oxfmtrc.*` or the
 * `oxfmt` dep, run with `--list-different` for check / `--write`
 * for fix, parse each emitted line into a file-level `info`
 * finding.
 *
 * Oxfmt picks up `.gitignore` and `.prettierignore` by default,
 * so we don't pass `--ignore-path` ourselves — the orchestrator's
 * vis-level ignore set layers on top of that.
 */

const CONFIG_CANDIDATES = [
    ".oxfmtrc",
    ".oxfmtrc.json",
    ".oxfmtrc.jsonc",
    ".oxfmtrc.ts",
    ".oxfmtrc.mts",
    ".oxfmtrc.cts",
    ".oxfmtrc.js",
    ".oxfmtrc.mjs",
    ".oxfmtrc.cjs",
    "oxfmt.config.ts",
    "oxfmt.config.mts",
    "oxfmt.config.js",
    "oxfmt.config.mjs",
];

export const oxfmtAdapter: ToolAdapter = {
    argsCheck: (files, options) => buildArgs(files, options, "check"),
    argsFix: (files, options) => buildArgs(files, options, "fix"),

    bin: () => ["pnpm", "exec", "oxfmt"],

    cacheKey: (presence, options) => {
        const parts = [
            "oxfmt",
            presence.declaredVersion ?? "unknown",
            presence.configFile ?? "no-config",
            options.quiet ? "q" : "",
            ...(options.extraArgs ?? []),
        ];

        return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
    },

    detect: (root, packageJson) => {
        const declared = declaredVersion(packageJson, "oxfmt");
        const configFile = findFirstConfig(root, CONFIG_CANDIDATES);

        if (!declared && !configFile) {
            return undefined;
        }

        return {
            adapter: "oxfmt",
            configFile,
            declared: Boolean(declared),
            declaredVersion: declared,
            root,
        };
    },

    extensions: ["cjs", "cts", "js", "json", "jsonc", "jsx", "mjs", "mts", "ts", "tsx"],
    id: "oxfmt",
    kind: "fmt",

    parse: (result, presence) => {
        if (result.exitCode === 0) {
            return [];
        }

        const findings: Finding[] = [];

        for (const rawLine of result.stdout.split(/\r?\n/)) {
            const line = rawLine.trim();

            if (!line || line.startsWith("[")) {
                continue;
            }

            findings.push({
                adapter: "oxfmt",
                file: resolveFile(presence.root, line),
                fixable: true,
                message: "Code style issues would be auto-fixed",
                severity: "info",
            });
        }

        return findings;
    },
};

const buildArgs = (files: ReadonlyArray<string>, options: AdapterRunOptions, mode: "check" | "fix"): string[] => {
    const args = mode === "fix" ? ["--write"] : ["--list-different"];

    if (options.extraArgs?.length) {
        args.push(...options.extraArgs);
    }

    args.push(...files);

    return args;
};

const resolveFile = (root: string, line: string): string => {
    if (line.startsWith("/")) {
        return line;
    }

    return `${root}/${line}`;
};
