import { createHash } from "node:crypto";

import { TOOL_SIGNATURES } from "../../util/tool-signatures";
import type { AdapterRunOptions, Finding, ToolAdapter } from "../config-types";
import { declaredVersion, findFirstConfig } from "../detect";
import { resolveFile } from "../paths";

/**
 * Dprint adapter. Pluggable Rust-native formatter; the user picks
 * which languages to handle via plugins in `dprint.json`. We treat
 * it like prettier/oxfmt: `check --list-different` for the dry-run,
 * `fmt` for write mode, and each emitted line becomes a file-level
 * `info` finding.
 *
 * Dprint discovers config from the nearest `dprint.json[c]` /
 * `.dprint.json[c]` and respects `.gitignore` by default, so we
 * don't forward an `--ignore-path` ourselves.
 *
 * The advertised extension set is broad to match dprint's plugin
 * ecosystem (TS/JS, JSON, Markdown, TOML, YAML, dockerfile, …);
 * actual handling is gated by the user's installed plugins so
 * extras don't cause harm.
 */

export const dprintAdapter: ToolAdapter = {
    argsCheck: (files, options) => buildArgs(files, options, "check"),
    argsFix: (files, options) => buildArgs(files, options, "fix"),

    bin: () => ["pnpm", "exec", "dprint"],

    cacheKey: (presence, options) => {
        const parts = [
            "dprint",
            presence.declaredVersion ?? "unknown",
            presence.configFile ?? "no-config",
            options.quiet ? "q" : "",
            ...(options.extraArgs ?? []),
        ];

        return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
    },

    detect: (root, packageJson) => {
        const declared = declaredVersion(packageJson, TOOL_SIGNATURES.dprint.packageNames[0]);
        const configFile = findFirstConfig(root, TOOL_SIGNATURES.dprint.configFiles);

        if (!declared && !configFile) {
            return undefined;
        }

        return {
            adapter: "dprint",
            configFile,
            declared: Boolean(declared),
            declaredVersion: declared,
            root,
        };
    },

    extensions: [
        "cjs",
        "css",
        "cts",
        "dockerfile",
        "html",
        "js",
        "json",
        "jsonc",
        "jsx",
        "md",
        "mdx",
        "mjs",
        "mts",
        "toml",
        "ts",
        "tsx",
        "yaml",
        "yml",
    ],
    id: "dprint",
    kind: "fmt",

    parse: (result, presence) => {
        if (result.exitCode === 0) {
            return [];
        }

        const findings: Finding[] = [];

        for (const rawLine of result.stdout.split(/\r?\n/)) {
            const line = rawLine.trim();

            if (!line || line.startsWith("[") || line.startsWith("Checked ") || line.startsWith("Error:")) {
                continue;
            }

            findings.push({
                adapter: "dprint",
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
    const args = mode === "fix" ? ["fmt"] : ["check", "--list-different"];

    if (options.extraArgs?.length) {
        args.push(...options.extraArgs);
    }

    args.push(...files);

    return args;
};
