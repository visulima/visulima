import { createHash } from "node:crypto";

import { TOOL_SIGNATURES } from "../../util/tool-signatures";
import type { AdapterRunOptions, Finding, ToolAdapter } from "../config-types";
import { declaredVersion, findFirstConfig } from "../detect";
import { resolveFile } from "../paths";

/**
 * Prettier adapter.
 *
 * Prettier doesn't ship a structured reporter, so we parse the
 * text output of `--list-different` (check) / `--write` (fix). Each
 * line in `--list-different` is a relative path that would change;
 * we turn each into a single file-level `info` finding because
 * "this file would be reformatted" isn't an error in itself — it
 * becomes one only at the orchestrator level when running in check
 * mode.
 *
 * Detection looks at `package.json` plus the standard config /
 * ignore file names. The adapter only opts in if at least one of
 * those is present.
 */

export const prettierAdapter: ToolAdapter = {
    argsCheck: (files, options) => buildArgs(files, options, "check"),
    argsFix: (files, options) => buildArgs(files, options, "fix"),

    bin: () => ["pnpm", "exec", "prettier"],

    cacheKey: (presence, options) => {
        const parts = [
            "prettier",
            presence.declaredVersion ?? "unknown",
            presence.configFile ?? "no-config",
            options.quiet ? "q" : "",
            ...(options.extraArgs ?? []),
        ];

        return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
    },

    detect: (root, packageJson) => {
        const declared = declaredVersion(packageJson, TOOL_SIGNATURES.prettier.packageNames[0]);
        const configFile = findFirstConfig(root, TOOL_SIGNATURES.prettier.configFiles);

        if (!declared && !configFile) {
            return undefined;
        }

        return {
            adapter: "prettier",
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
        "html",
        "js",
        "json",
        "jsx",
        "less",
        "md",
        "mdx",
        "mjs",
        "mts",
        "scss",
        "ts",
        "tsx",
        "vue",
        "yaml",
        "yml",
    ],
    id: "prettier",
    kind: "fmt",

    parse: (result, presence) => {
        // Fix mode writes files and emits a per-file `<name> Xms` log.
        // Those aren't findings — the runner doesn't need to know what
        // changed at parse time, only that it succeeded.
        if (result.exitCode === 0) {
            return [];
        }

        const findings: Finding[] = [];

        for (const rawLine of result.stdout.split(/\r?\n/)) {
            const line = rawLine.trim();

            if (!line) {
                continue;
            }

            // Prettier emits `[warn] Code style issues found...` summary lines
            // we skip — only file paths are actionable findings.
            if (line.startsWith("[")) {
                continue;
            }

            findings.push({
                adapter: "prettier",
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

    if (options.quiet) {
        args.push("--log-level", "warn");
    }

    if (options.extraArgs?.length) {
        args.push(...options.extraArgs);
    }

    args.push(...files);

    return args;
};
