import { createHash } from "node:crypto";

import { TOOL_SIGNATURES } from "../../util/tool-signatures";
import type { AdapterRunOptions, Finding, FindingSeverity, ToolAdapter } from "../config-types";
import { declaredVersion, findFirstConfig } from "../detect";

/**
 * Oxlint adapter. Rust-native ESLint replacement; faster, narrower
 * rule set. Run first in the default precedence as a fast
 * pre-filter — anything it catches doesn't need to wait for the
 * (much slower) ESLint pass.
 *
 * Detection looks for `.oxlintrc.json`/`.json[c]` config or an
 * `oxlint` declaration in any dep field. We do NOT look at
 * `eslint.config.*` — oxlint can technically read v8 legacy
 * configs but that's not its primary use mode and we don't want
 * to silently opt every ESLint project into oxlint.
 */

const SEVERITY_MAP: Record<string, FindingSeverity> = {
    advice: "info",
    error: "error",
    warning: "warning",
};

interface OxlintLabelSpan {
    column?: number;
    length?: number;
    line?: number;
    offset?: number;
}

interface OxlintLabel {
    label?: string;
    span?: OxlintLabelSpan;
}

interface OxlintDiagnostic {
    code?: string;
    filename?: string;
    labels?: ReadonlyArray<OxlintLabel>;
    message?: string;
    severity?: string;
}

interface OxlintReport {
    diagnostics?: ReadonlyArray<OxlintDiagnostic>;
}

export const oxlintAdapter: ToolAdapter = {
    argsCheck: (files, options) => buildArgs(files, options, false),
    argsFix: (files, options) => buildArgs(files, options, true),

    bin: () => ["pnpm", "exec", "oxlint"],

    cacheKey: (presence, options) => {
        const parts = [
            "oxlint",
            presence.declaredVersion ?? "unknown",
            presence.configFile ?? "no-config",
            options.maxWarnings === undefined ? "" : `mw=${options.maxWarnings}`,
            options.quiet ? "q" : "",
            ...(options.extraArgs ?? []),
        ];

        return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
    },

    detect: (root, packageJson) => {
        const declared = declaredVersion(packageJson, TOOL_SIGNATURES.oxlint.packageNames[0]);
        const configFile = findFirstConfig(root, TOOL_SIGNATURES.oxlint.configFiles);

        if (!declared && !configFile) {
            return undefined;
        }

        return {
            adapter: "oxlint",
            configFile,
            declared: Boolean(declared),
            declaredVersion: declared,
            root,
        };
    },

    extensions: ["astro", "cjs", "cts", "js", "jsx", "mjs", "mts", "svelte", "ts", "tsx", "vue"],
    id: "oxlint",
    kind: "lint",

    parse: (result, presence) => {
        if (!result.stdout.trim()) {
            return [];
        }

        let report: OxlintReport;

        try {
            report = JSON.parse(result.stdout) as OxlintReport;
        } catch {
            return [
                {
                    adapter: "oxlint",
                    file: presence.root,
                    fixable: false,
                    message: `oxlint output was not valid JSON (exit ${result.exitCode})`,
                    severity: "error",
                },
            ];
        }

        const findings: Finding[] = [];

        for (const diagnostic of report.diagnostics ?? []) {
            const primary = diagnostic.labels?.[0]?.span;

            findings.push({
                adapter: "oxlint",
                column: primary?.column,
                file: diagnostic.filename ?? presence.root,
                fixable: false,
                line: primary?.line,
                message: diagnostic.message ?? "",
                ruleId: diagnostic.code,
                severity: SEVERITY_MAP[diagnostic.severity ?? ""] ?? "warning",
            });
        }

        return findings;
    },
};

const buildArgs = (files: ReadonlyArray<string>, options: AdapterRunOptions, fix: boolean): string[] => {
    const args = ["--format", "json"];

    if (fix) {
        args.push("--fix");
    }

    if (options.quiet) {
        args.push("--quiet");
    }

    if (typeof options.maxWarnings === "number") {
        args.push(`--max-warnings=${String(options.maxWarnings)}`);
    }

    if (options.extraArgs?.length) {
        args.push(...options.extraArgs);
    }

    args.push(...files);

    return args;
};
