import { createHash } from "node:crypto";

import { TOOL_SIGNATURES } from "../../util/tool-signatures";
import type { AdapterRunOptions, Finding, FindingSeverity, ToolAdapter } from "../config-types";
import { declaredVersion, findFirstConfig } from "../detect";

/**
 * shellcheck adapter. shellcheck is a system binary (not npm), so
 * detection only fires when either a `.shellcheckrc` is present or a
 * `shellcheck` wrapper package is declared in `package.json`. The
 * adapter shells out to the `shellcheck` binary directly — no `pnpm
 * exec` indirection — and asks for the `json1` reporter which emits a
 * stable `{ comments: [...] }` envelope.
 *
 * shellcheck has no fix mode of its own, so `argsFix` collapses to the
 * same argv as `argsCheck`. We expose findings as `error` / `warning`
 * / `info` (mapping shellcheck's `style` level to `info`).
 */

const SEVERITY_MAP: Record<string, FindingSeverity> = {
    error: "error",
    info: "info",
    style: "info",
    warning: "warning",
};

interface ShellcheckComment {
    code?: number;
    column?: number;
    endColumn?: number;
    endLine?: number;
    file?: string;
    fix?: unknown;
    level?: string;
    line?: number;
    message?: string;
}

interface ShellcheckReport {
    comments?: ReadonlyArray<ShellcheckComment>;
}

const isAbsolutePath = (raw: string): boolean => raw.startsWith("/") || /^[a-z]:[\\/]/i.test(raw);

const resolveFilename = (filename: string | undefined, root: string): string => {
    if (!filename) {
        return root;
    }

    return isAbsolutePath(filename) ? filename : `${root}/${filename}`;
};

export const shellcheckAdapter: ToolAdapter = {
    argsCheck: (files, options) => buildArgs(files, options),
    argsFix: (files, options) => buildArgs(files, options),

    bin: () => ["shellcheck"],

    cacheKey: (presence, options) => {
        const parts = [
            "shellcheck",
            presence.declaredVersion ?? "unknown",
            presence.configFile ?? "no-config",
            options.quiet ? "q" : "",
            ...(options.extraArgs ?? []),
        ];

        return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
    },

    detect: (root, packageJson) => {
        const declared = declaredVersion(packageJson, TOOL_SIGNATURES.shellcheck.packageNames[0]);
        const configFile = findFirstConfig(root, TOOL_SIGNATURES.shellcheck.configFiles);

        if (!declared && !configFile) {
            return undefined;
        }

        return {
            adapter: "shellcheck",
            configFile,
            declared: Boolean(declared),
            declaredVersion: declared,
            root,
        };
    },

    extensions: ["bash", "ksh", "sh"],
    id: "shellcheck",
    kind: "lint",

    parse: (result, presence) => {
        if (!result.stdout.trim()) {
            return [];
        }

        let report: ShellcheckReport;

        try {
            report = JSON.parse(result.stdout) as ShellcheckReport;
        } catch {
            return [
                {
                    adapter: "shellcheck",
                    file: presence.root,
                    fixable: false,
                    message: `shellcheck output was not valid JSON (exit ${result.exitCode})`,
                    severity: "error",
                },
            ];
        }

        const findings: Finding[] = [];

        for (const comment of report.comments ?? []) {
            findings.push({
                adapter: "shellcheck",
                column: comment.column,
                endColumn: comment.endColumn,
                endLine: comment.endLine,
                file: resolveFilename(comment.file, presence.root),
                fixable: Boolean(comment.fix),
                line: comment.line,
                message: comment.message ?? "",
                ruleId: comment.code === undefined ? undefined : `SC${String(comment.code)}`,
                severity: SEVERITY_MAP[comment.level ?? ""] ?? "warning",
            });
        }

        return findings;
    },
};

const buildArgs = (files: ReadonlyArray<string>, options: AdapterRunOptions): string[] => {
    const args = ["--format=json1"];

    if (options.extraArgs?.length) {
        args.push(...options.extraArgs);
    }

    args.push(...files);

    return args;
};
