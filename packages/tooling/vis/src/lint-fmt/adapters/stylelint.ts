import { createHash } from "node:crypto";

import type { AdapterRunOptions, Finding, FindingSeverity, ToolAdapter } from "../config-types";
import { declaredVersion, findFirstConfig } from "../detect";

/**
 * Stylelint adapter. CSS-only linter — runs alongside eslint/oxlint/
 * biome rather than competing with them. The orchestrator advertises
 * a CSS-specific extension list so the fmt extension router won't
 * accidentally route `.css` files to a JS-oriented formatter when
 * stylelint is the only one present.
 *
 * Detection prefers `stylelint.config.{ts,js,mjs,cjs}` but falls
 * back to the legacy `.stylelintrc[.{json,js,cjs,yml,yaml}]` forms
 * since real-world projects still ship those.
 */

const CONFIG_CANDIDATES = [
    "stylelint.config.ts",
    "stylelint.config.js",
    "stylelint.config.mjs",
    "stylelint.config.cjs",
    ".stylelintrc",
    ".stylelintrc.json",
    ".stylelintrc.js",
    ".stylelintrc.cjs",
    ".stylelintrc.yml",
    ".stylelintrc.yaml",
];

const SEVERITY_MAP: Record<string, FindingSeverity> = {
    error: "error",
    warning: "warning",
};

interface StylelintWarning {
    column?: number;
    endColumn?: number;
    endLine?: number;
    line?: number;
    rule?: string;
    severity?: string;
    text?: string;
}

interface StylelintFileReport {
    source: string;
    warnings?: ReadonlyArray<StylelintWarning>;
}

export const stylelintAdapter: ToolAdapter = {
    argsCheck: (files, options) => buildArgs(files, options, false),
    argsFix: (files, options) => buildArgs(files, options, true),

    bin: () => ["pnpm", "exec", "stylelint"],

    cacheKey: (presence, options) => {
        const parts = [
            "stylelint",
            presence.declaredVersion ?? "unknown",
            presence.configFile ?? "no-config",
            options.maxWarnings === undefined ? "" : `mw=${options.maxWarnings}`,
            options.quiet ? "q" : "",
            ...(options.extraArgs ?? []),
        ];

        return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
    },

    detect: (root, packageJson) => {
        const declared = declaredVersion(packageJson, "stylelint");
        const configFile = findFirstConfig(root, CONFIG_CANDIDATES);

        if (!declared && !configFile) {
            return undefined;
        }

        return {
            adapter: "stylelint",
            configFile,
            declared: Boolean(declared),
            declaredVersion: declared,
            root,
        };
    },

    extensions: ["astro", "css", "less", "sass", "scss", "svelte", "vue"],
    id: "stylelint",
    kind: "lint",

    parse: (result, presence) => {
        if (!result.stdout.trim()) {
            return [];
        }

        let reports: ReadonlyArray<StylelintFileReport>;

        try {
            reports = JSON.parse(result.stdout) as ReadonlyArray<StylelintFileReport>;
        } catch {
            return [
                {
                    adapter: "stylelint",
                    file: presence.root,
                    fixable: false,
                    message: `stylelint output was not valid JSON (exit ${result.exitCode})`,
                    severity: "error",
                },
            ];
        }

        const findings: Finding[] = [];

        for (const report of reports) {
            for (const warning of report.warnings ?? []) {
                findings.push({
                    adapter: "stylelint",
                    column: warning.column,
                    endColumn: warning.endColumn,
                    endLine: warning.endLine,
                    file: report.source,
                    fixable: false,
                    line: warning.line,
                    message: warning.text ?? "",
                    ruleId: warning.rule,
                    severity: SEVERITY_MAP[warning.severity ?? ""] ?? "warning",
                });
            }
        }

        return findings;
    },
};

const buildArgs = (files: ReadonlyArray<string>, options: AdapterRunOptions, fix: boolean): string[] => {
    const args = ["--formatter", "json"];

    if (fix) {
        args.push("--fix");
    }

    if (options.quiet) {
        args.push("--quiet");
    }

    if (typeof options.maxWarnings === "number") {
        args.push("--max-warnings", String(options.maxWarnings));
    }

    if (options.extraArgs?.length) {
        args.push(...options.extraArgs);
    }

    args.push(...files);

    return args;
};
