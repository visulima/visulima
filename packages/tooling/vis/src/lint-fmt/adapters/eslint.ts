import { createHash } from "node:crypto";

import { TOOL_SIGNATURES } from "../../util/tool-signatures";
import type { AdapterRunOptions, Finding, FindingSeverity, ToolAdapter } from "../config-types";
import { declaredVersion, findFirstConfig } from "../detect";

/**
 * ESLint adapter. Invokes the workspace-local `eslint` binary via
 * `pnpm exec`, asks for the JSON reporter, and translates each
 * Message into the shared `Finding` shape.
 *
 * Detection prefers a flat config (`eslint.config.{js,mjs,cjs,ts}`)
 * but falls back to the legacy formats so the adapter is useful in
 * older workspaces too. If `package.json` declares eslint we still
 * surface presence even without a config file — eslint's own
 * "no config" error then surfaces at run time with a clear message.
 */

const SEVERITY_MAP: Record<number, FindingSeverity> = {
    1: "warning",
    2: "error",
};

interface EslintMessage {
    column?: number;
    endColumn?: number;
    endLine?: number;
    fatal?: boolean;
    fix?: unknown;
    line?: number;
    message: string;
    ruleId?: string | null;
    severity: number;
    suggestions?: unknown[];
}

interface EslintFileReport {
    filePath: string;
    messages: ReadonlyArray<EslintMessage>;
}

export const eslintAdapter: ToolAdapter = {
    argsCheck: (files, options) => buildArgs(files, options, false),
    argsFix: (files, options) => buildArgs(files, options, true),

    bin: () => ["pnpm", "exec", "eslint"],

    cacheKey: (presence, options) => {
        const parts = [
            "eslint",
            presence.declaredVersion ?? "unknown",
            presence.configFile ?? "no-config",
            options.maxWarnings === undefined ? "" : `mw=${options.maxWarnings}`,
            options.quiet ? "q" : "",
            ...(options.extraArgs ?? []),
        ];

        return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
    },

    detect: (root, packageJson) => {
        const declared = declaredVersion(packageJson, TOOL_SIGNATURES.eslint.packageNames[0]);
        const configFile = findFirstConfig(root, TOOL_SIGNATURES.eslint.configFiles);

        if (!declared && !configFile) {
            return undefined;
        }

        return {
            adapter: "eslint",
            configFile,
            declared: Boolean(declared),
            declaredVersion: declared,
            root,
        };
    },

    extensions: ["cjs", "cts", "js", "jsx", "mjs", "mts", "ts", "tsx", "vue"],
    id: "eslint",
    kind: "lint",

    parse: (result, presence) => {
        if (!result.stdout.trim()) {
            return [];
        }

        let reports: ReadonlyArray<EslintFileReport>;

        try {
            reports = JSON.parse(result.stdout) as ReadonlyArray<EslintFileReport>;
        } catch {
            // Fall back to a single synthetic finding describing the parse
            // failure — preferable to silently dropping output.
            return [
                {
                    adapter: "eslint",
                    file: presence.root,
                    fixable: false,
                    message: `eslint output was not valid JSON (exit ${result.exitCode})`,
                    severity: "error",
                },
            ];
        }

        const findings: Finding[] = [];

        for (const report of reports) {
            for (const message of report.messages) {
                findings.push({
                    adapter: "eslint",
                    column: message.column,
                    endColumn: message.endColumn,
                    endLine: message.endLine,
                    file: report.filePath,
                    fixable: Boolean(message.fix),
                    line: message.line,
                    message: message.message,
                    ruleId: message.ruleId ?? undefined,
                    severity: message.fatal ? "error" : (SEVERITY_MAP[message.severity] ?? "warning"),
                });
            }
        }

        return findings;
    },
};

const buildArgs = (files: ReadonlyArray<string>, options: AdapterRunOptions, fix: boolean): string[] => {
    const args = ["--format", "json", "--no-error-on-unmatched-pattern"];

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
