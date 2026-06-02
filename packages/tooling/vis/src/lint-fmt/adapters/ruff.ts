import { createHash } from "node:crypto";

import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { TOOL_SIGNATURES } from "../../util/tool-signatures";
import type { AdapterRunOptions, Finding, ToolAdapter, ToolPresence } from "../config-types";
import { declaredVersion, findFirstConfig } from "../detect";

/**
 * Ruff adapter pair. Ruff is a Rust-native Python linter +
 * formatter that mirrors `deno`'s split surface: two subcommands
 * (`ruff check` and `ruff format`) with different output shapes,
 * so we register two adapters that share detection.
 *
 *   - `ruffCheckAdapter` → `ruff check --output-format=json`
 *   - `ruffFmtAdapter`   → `ruff format --check` / `ruff format`
 *
 * Detection accepts any of:
 *   - `ruff.toml` / `.ruff.toml`
 *   - `pyproject.toml` containing a `[tool.ruff]` table
 *   - `ruff` (or `@astral-sh/ruff`) declared in `package.json`
 *
 * The `pyproject.toml` check reads the file's bytes and looks for
 * `[tool.ruff` (open bracket, no closing bracket — `[tool.ruff]`
 * and `[tool.ruff.lint]` both qualify). A full TOML parser would
 * be overkill for a presence check.
 */

const PYPROJECT_FILE = "pyproject.toml";
const PYPROJECT_RUFF_PATTERN = /^\[tool\.ruff(?:\.[\w-]+)*\]\s*$/m;
const WOULD_REFORMAT_PATTERN = /^Would reformat:?\s+(.+)$/;

const pyprojectMentionsRuff = (root: string): boolean => {
    const pyprojectPath = join(root, PYPROJECT_FILE);

    if (!isAccessibleSync(pyprojectPath)) {
        return false;
    }

    try {
        const content = readFileSync(pyprojectPath);

        return PYPROJECT_RUFF_PATTERN.test(content);
    } catch {
        return false;
    }
};

const detectRuff = (id: "ruff-check" | "ruff-fmt") => (root: string, packageJson: Record<string, unknown>): ToolPresence | undefined => {
    const declared = TOOL_SIGNATURES.ruff.packageNames
        .map((name) => declaredVersion(packageJson, name))
        .find((version) => version !== undefined);
    const configFile = findFirstConfig(root, TOOL_SIGNATURES.ruff.configFiles);
    const pyprojectHit = configFile ? undefined : pyprojectMentionsRuff(root) ? join(root, PYPROJECT_FILE) : undefined;
    const resolvedConfig = configFile ?? pyprojectHit;

    if (!declared && !resolvedConfig) {
        return undefined;
    }

    return {
        adapter: id,
        configFile: resolvedConfig,
        declared: Boolean(declared),
        declaredVersion: declared,
        root,
    };
};

const isAbsolutePath = (raw: string): boolean => raw.startsWith("/") || /^[a-z]:[\\/]/i.test(raw);

const resolveFilename = (filename: string | undefined, root: string): string => {
    if (!filename) {
        return root;
    }

    return isAbsolutePath(filename) ? filename : join(root, filename);
};

const matchReformatLine = (line: string): string | undefined => {
    const matched = WOULD_REFORMAT_PATTERN.exec(line);

    return matched?.[1]?.trim();
};

interface RuffLocation {
    column?: number;
    row?: number;
}

interface RuffFix {
    applicability?: string;
}

interface RuffDiagnostic {
    code?: string;
    end_location?: RuffLocation;
    filename?: string;
    fix?: RuffFix | null;
    location?: RuffLocation;
    message?: string;
}

export const ruffCheckAdapter: ToolAdapter = {
    argsCheck: (files, options) => buildCheckArgs(files, options, false),
    argsFix: (files, options) => buildCheckArgs(files, options, true),

    bin: () => ["ruff", "check"],

    cacheKey: (presence, options) => {
        const parts = [
            "ruff-check",
            presence.declaredVersion ?? "unknown",
            presence.configFile ?? "no-config",
            options.maxWarnings === undefined ? "" : `mw=${options.maxWarnings}`,
            options.quiet ? "q" : "",
            ...(options.extraArgs ?? []),
        ];

        return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
    },

    detect: detectRuff("ruff-check"),

    extensions: ["py", "pyi"],
    id: "ruff-check",
    kind: "lint",

    parse: (result, presence) => {
        if (!result.stdout.trim()) {
            return [];
        }

        let report: ReadonlyArray<RuffDiagnostic>;

        try {
            report = JSON.parse(result.stdout) as ReadonlyArray<RuffDiagnostic>;
        } catch {
            return [
                {
                    adapter: "ruff-check",
                    file: presence.root,
                    fixable: false,
                    message: `ruff check output was not valid JSON (exit ${result.exitCode})`,
                    severity: "error",
                },
            ];
        }

        const findings: Finding[] = [];

        for (const diagnostic of report) {
            const start = diagnostic.location;
            const end = diagnostic.end_location;

            findings.push({
                adapter: "ruff-check",
                column: start?.column,
                endColumn: end?.column,
                endLine: end?.row,
                file: resolveFilename(diagnostic.filename, presence.root),
                fixable: Boolean(diagnostic.fix),
                line: start?.row,
                message: diagnostic.message ?? "",
                ruleId: diagnostic.code,
                severity: "warning",
            });
        }

        return findings;
    },
};

export const ruffFmtAdapter: ToolAdapter = {
    argsCheck: (files, options) => buildFmtArgs(files, options, false),
    argsFix: (files, options) => buildFmtArgs(files, options, true),

    bin: () => ["ruff", "format"],

    cacheKey: (presence, options) => {
        const parts = [
            "ruff-fmt",
            presence.declaredVersion ?? "unknown",
            presence.configFile ?? "no-config",
            options.quiet ? "q" : "",
            ...(options.extraArgs ?? []),
        ];

        return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
    },

    detect: detectRuff("ruff-fmt"),

    extensions: ["py", "pyi"],
    id: "ruff-fmt",
    kind: "fmt",

    parse: (result, presence) => {
        if (result.exitCode === 0) {
            return [];
        }

        const findings: Finding[] = [];
        const seen = new Set<string>();

        for (const rawLine of result.stdout.split(/\r?\n/)) {
            const file = matchReformatLine(rawLine);

            if (!file || seen.has(file)) {
                continue;
            }

            seen.add(file);
            findings.push({
                adapter: "ruff-fmt",
                file: resolveFilename(file, presence.root),
                fixable: true,
                message: "Code style issues would be auto-fixed",
                severity: "info",
            });
        }

        return findings;
    },
};

const buildCheckArgs = (files: ReadonlyArray<string>, options: AdapterRunOptions, fix: boolean): string[] => {
    const args = ["--output-format=json"];

    if (fix) {
        args.push("--fix");
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
