import { createHash } from "node:crypto";

import { join } from "@visulima/path";

import { TOOL_SIGNATURES } from "../../util/tool-signatures";
import type { AdapterRunOptions, Finding, FindingSeverity, ToolAdapter } from "../config-types";
import { declaredVersion, findFirstConfig } from "../detect";

/**
 * Biome adapter. Single Rust-native tool that covers both linting
 * and formatting; we orchestrate it through `biome check` so both
 * passes happen in one process. `kind: "both"` means biome shows up
 * in `vis lint` (lint diagnostics) and `vis fmt` (format diagnostics)
 * — the registry routes by file extension and the parser tags each
 * finding with the right severity, so the user sees coherent output
 * in either command.
 *
 * The JSON reporter is marked unstable upstream; the shape has been
 * stable enough across 1.x → 2.x for our needs but we treat parse
 * failures as a single synthetic error rather than crashing.
 */

const SEVERITY_MAP: Record<string, FindingSeverity> = {
    error: "error",
    info: "info",
    information: "info",
    warning: "warning",
};

interface BiomePosition {
    column?: number;
    line?: number;
}

interface BiomeLocation {
    end?: BiomePosition;
    path?: string | { file?: string };
    start?: BiomePosition;
}

interface BiomeDiagnostic {
    category?: string;
    location?: BiomeLocation;
    message?: string;
    severity?: string;
}

interface BiomeReport {
    diagnostics?: ReadonlyArray<BiomeDiagnostic>;
}

export const biomeAdapter: ToolAdapter = {
    argsCheck: (files, options) => buildArgs(files, options, false),
    argsFix: (files, options) => buildArgs(files, options, true),

    bin: () => ["pnpm", "exec", "biome"],

    cacheKey: (presence, options) => {
        const parts = [
            "biome",
            presence.declaredVersion ?? "unknown",
            presence.configFile ?? "no-config",
            options.maxWarnings === undefined ? "" : `mw=${options.maxWarnings}`,
            options.quiet ? "q" : "",
            ...(options.extraArgs ?? []),
        ];

        return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
    },

    detect: (root, packageJson) => {
        const declared = declaredVersion(packageJson, TOOL_SIGNATURES.biome.packageNames[0]);
        const configFile = findFirstConfig(root, TOOL_SIGNATURES.biome.configFiles);

        if (!declared && !configFile) {
            return undefined;
        }

        return {
            adapter: "biome",
            configFile,
            declared: Boolean(declared),
            declaredVersion: declared,
            root,
        };
    },

    extensions: ["astro", "cjs", "css", "cts", "js", "json", "jsonc", "jsx", "mjs", "mts", "svelte", "ts", "tsx", "vue"],
    id: "biome",
    kind: "both",

    parse: (result, presence) => {
        if (!result.stdout.trim()) {
            return [];
        }

        let report: BiomeReport;

        try {
            report = JSON.parse(result.stdout) as BiomeReport;
        } catch {
            return [
                {
                    adapter: "biome",
                    file: presence.root,
                    fixable: false,
                    message: `biome output was not valid JSON (exit ${result.exitCode})`,
                    severity: "error",
                },
            ];
        }

        const findings: Finding[] = [];

        for (const diagnostic of report.diagnostics ?? []) {
            const start = diagnostic.location?.start;
            const end = diagnostic.location?.end;
            const path = resolvePath(presence.root, diagnostic.location?.path);
            const category = diagnostic.category ?? "";
            const isFormat = category === "format" || category.startsWith("format/");

            findings.push({
                adapter: "biome",
                column: start?.column && start.column > 0 ? start.column : undefined,
                endColumn: end?.column && end.column > 0 ? end.column : undefined,
                endLine: end?.line && end.line > 0 ? end.line : undefined,
                file: path,
                fixable: true,
                line: start?.line && start.line > 0 ? start.line : undefined,
                message: isFormat ? "Code style issues would be auto-fixed" : diagnostic.message ?? "",
                ruleId: category || undefined,
                severity: SEVERITY_MAP[diagnostic.severity ?? ""] ?? "warning",
            });
        }

        return findings;
    },
};

const buildArgs = (files: ReadonlyArray<string>, options: AdapterRunOptions, fix: boolean): string[] => {
    const args = ["check", "--reporter=json"];

    if (fix) {
        args.push("--write");
    }

    if (typeof options.maxWarnings === "number") {
        args.push(`--max-diagnostics=${String(options.maxWarnings)}`);
    }

    if (options.extraArgs?.length) {
        args.push(...options.extraArgs);
    }

    args.push(...files);

    return args;
};

const resolvePath = (root: string, path: BiomeLocation["path"]): string => {
    const raw = typeof path === "string" ? path : path?.file;

    if (!raw) {
        return root;
    }

    if (raw.startsWith("/") || /^[a-z]:[\\/]/i.test(raw)) {
        return raw;
    }

    return join(root, raw);
};
