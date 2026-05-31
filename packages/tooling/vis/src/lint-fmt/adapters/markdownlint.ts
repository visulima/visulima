import { createHash } from "node:crypto";

import { TOOL_SIGNATURES } from "../../util/tool-signatures";
import type { Finding, ToolAdapter } from "../config-types";
import { declaredVersion, findFirstConfig } from "../detect";

/**
 * markdownlint adapter. Targets `markdownlint-cli2` (modern variant);
 * the older `markdownlint-cli` is recognised by detection for
 * completeness but only `markdownlint-cli2`'s argv surface is
 * supported at run time. `markdownlint-cli2` supports JSON formatters
 * only via a separate optional package (`markdownlint-cli2-formatter-json`),
 * so we lean on the default text reporter — the format is stable and
 * unambiguous.
 *
 * Output shape (one line per finding, written to stderr):
 *
 *   path:line[:col] rule/aliases description [context]
 *
 * Examples:
 *
 *   docs/a.md:1 MD041/first-line-heading first line in file should be ...
 *   docs/a.md:8:4 MD007/ul-indent unordered list indentation [Expected: 2; Actual: 4]
 */

const FINDING_PATTERN = /^([^:]+):(\d+)(?::(\d+))?\s+([\w/-]+)\s+(.+)$/;

interface ParsedFinding {
    column?: number;
    file: string;
    line: number;
    message: string;
    ruleId: string;
}

const tryParseFindingLine = (line: string): ParsedFinding | undefined => {
    const matched = FINDING_PATTERN.exec(line);

    if (!matched) {
        return undefined;
    }

    const [, file, lineNumber, columnNumber, ruleId, message] = matched;

    return {
        column: columnNumber === undefined ? undefined : Number(columnNumber),
        file: file!,
        line: Number(lineNumber),
        message: message!,
        ruleId: ruleId!,
    };
};

const isAbsolutePath = (raw: string): boolean => raw.startsWith("/") || /^[a-z]:[\\/]/i.test(raw);

export const markdownlintAdapter: ToolAdapter = {
    argsCheck: (files, options) => buildArgs(files, options, false),
    argsFix: (files, options) => buildArgs(files, options, true),

    bin: () => ["pnpm", "exec", "markdownlint-cli2"],

    cacheKey: (presence, options) => {
        const parts = [
            "markdownlint",
            presence.declaredVersion ?? "unknown",
            presence.configFile ?? "no-config",
            options.maxWarnings === undefined ? "" : `mw=${options.maxWarnings}`,
            options.quiet ? "q" : "",
            ...(options.extraArgs ?? []),
        ];

        return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
    },

    detect: (root, packageJson) => {
        const declared = TOOL_SIGNATURES.markdownlint.packageNames
            .map((name) => declaredVersion(packageJson, name))
            .find((version) => version !== undefined);
        const configFile = findFirstConfig(root, TOOL_SIGNATURES.markdownlint.configFiles);

        if (!declared && !configFile) {
            return undefined;
        }

        return {
            adapter: "markdownlint",
            configFile,
            declared: Boolean(declared),
            declaredVersion: declared,
            root,
        };
    },

    extensions: ["markdown", "md"],
    id: "markdownlint",
    kind: "lint",

    parse: (result, presence) => {
        const haystack = (result.stderr || result.stdout || "").trim();

        if (!haystack) {
            return [];
        }

        const findings: Finding[] = [];

        for (const rawLine of haystack.split(/\r?\n/)) {
            const parsed = tryParseFindingLine(rawLine.trim());

            if (!parsed) {
                continue;
            }

            findings.push({
                adapter: "markdownlint",
                column: parsed.column,
                file: isAbsolutePath(parsed.file) ? parsed.file : `${presence.root}/${parsed.file}`,
                fixable: false,
                line: parsed.line,
                message: parsed.message,
                ruleId: parsed.ruleId,
                severity: "warning",
            });
        }

        return findings;
    },
};

const buildArgs = (files: ReadonlyArray<string>, options: { extraArgs?: string[]; maxWarnings?: number; quiet?: boolean }, fix: boolean): string[] => {
    const args: string[] = [];

    if (fix) {
        args.push("--fix");
    }

    if (options.extraArgs?.length) {
        args.push(...options.extraArgs);
    }

    if (files.length === 0) {
        args.push("**/*.md");
    } else {
        args.push(...files);
    }

    return args;
};
