import { createHash } from "node:crypto";

import { relative } from "@visulima/path";
import { findTsConfigSync } from "@visulima/tsconfig";

import type { AdapterRunOptions, Finding, ToolAdapter } from "../config-types";
import { declaredVersion, readRootPackageJson } from "../detect";

/**
 * TypeScript type-check adapter (`tsc`, or `tsgo` when only
 * `@typescript/native-preview` is declared). Unlike the other lint
 * adapters it is:
 *
 * - **opt-in** (`lint.adapters.typecheck.enabled: true`): a full type check is far
 *   slower than a lint pass and can fail on code that lints clean, so detection alone
 *   never turns it on;
 * - **project-wide** (`scope: "project"`): `tsc` cannot check an arbitrary file list
 *   without ignoring the tsconfig, so file arguments are never forwarded and results
 *   are never replayed from the per-file lint cache;
 * - **fix-less**: `argsFix` is the same as `argsCheck`.
 *
 * A tsconfig with `references` (a solution-style root) is checked in build mode
 * (`tsc -b --noEmit`): plain `tsc` exits 0 on such a config without checking anything.
 * Build mode writes `.tsbuildinfo` files for composite projects.
 */

const TSGO_PACKAGE = "@typescript/native-preview";
const MAX_RAW_OUTPUT = 2000;

/** `path(line,col): error TS1234: message`. Greedy path so `app/(group)/page.tsx(3,5)` anchors on the last `(line,col):`. */
const LOCATED = /^(.*)\((\d+),(\d+)\): (error|warning) (TS\d+): (.*)$/;
/** `error TS18003: message` — config-level diagnostics have no file. */
const UNLOCATED = /^(error|warning) (TS\d+): (.*)$/;

const isAbsolutePath = (raw: string): boolean => raw.startsWith("/") || /^[a-z]:[\\/]/i.test(raw);

const resolveFilename = (filename: string, root: string): string => (isAbsolutePath(filename) ? filename : `${root}/${filename}`);

/** `findTsConfigSync` throws when nothing is found, and `detect` runs on every `vis lint`. */
const findTsConfig = (root: string): ReturnType<typeof findTsConfigSync> | undefined => {
    try {
        return findTsConfigSync(root);
    } catch {
        return undefined;
    }
};

const hasReferences = (root: string): boolean => {
    const found = findTsConfig(root);

    return Array.isArray(found?.config.references) && found.config.references.length > 0;
};

/** `tsgo` only when the native preview is the sole TypeScript the workspace declares. */
const binaryFor = (root: string): "tsc" | "tsgo" => {
    const packageJson = readRootPackageJson(root);

    return !declaredVersion(packageJson, "typescript") && declaredVersion(packageJson, TSGO_PACKAGE) ? "tsgo" : "tsc";
};

export const typecheckAdapter: ToolAdapter = {
    argsCheck: (_files, options) => buildArgs(options),
    argsFix: (_files, options) => buildArgs(options),

    // The project selection lives in the argv head because `argsCheck` does not receive the presence.
    bin: (presence) => {
        const head = ["pnpm", "exec", binaryFor(presence.root)];
        // Relative to the spawn cwd (the root): tsc prints paths relative to its own cwd, and an absolute
        // config path behind a symlinked directory makes those disagree with `presence.root`.
        const config = presence.configFile ? relative(presence.root, presence.configFile) : "tsconfig.json";

        if (presence.configFile && hasReferences(presence.root)) {
            return [...head, "-b", "--noEmit", "--pretty", "false", config];
        }

        return [...head, "-p", config, "--noEmit", "--pretty", "false"];
    },

    cacheKey: (presence, options) => {
        const parts = ["typecheck", presence.declaredVersion ?? "unknown", presence.configFile ?? "no-config", ...(options.extraArgs ?? [])];

        return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
    },

    detect: (root, packageJson) => {
        const typescript = declaredVersion(packageJson, "typescript");
        const native = declaredVersion(packageJson, TSGO_PACKAGE);
        const found = findTsConfig(root);

        // findTsConfigSync walks up; a parent directory's tsconfig is not this workspace's.
        if ((!typescript && !native) || !found?.path.startsWith(`${root}/`)) {
            return undefined;
        }

        return {
            adapter: "typecheck",
            configFile: found.path,
            declared: true,
            declaredVersion: typescript ?? native,
            root,
        };
    },

    extensions: ["cts", "mts", "ts", "tsx"],
    id: "typecheck",
    kind: "lint",
    optIn: true,

    parse: (result, presence) => {
        const findings: Finding[] = [];

        for (const line of `${result.stdout}\n${result.stderr}`.split(/\r?\n/)) {
            const located = LOCATED.exec(line);

            if (located) {
                findings.push({
                    adapter: "typecheck",
                    column: Number(located[3]),
                    file: resolveFilename(located[1] as string, presence.root),
                    fixable: false,
                    line: Number(located[2]),
                    message: located[6] as string,
                    ruleId: located[5],
                    severity: located[4] === "warning" ? "warning" : "error",
                });

                continue;
            }

            const unlocated = UNLOCATED.exec(line);

            if (unlocated) {
                findings.push({
                    adapter: "typecheck",
                    file: presence.root,
                    fixable: false,
                    message: unlocated[3] as string,
                    ruleId: unlocated[2],
                    severity: unlocated[1] === "warning" ? "warning" : "error",
                });

                continue;
            }

            // Indented continuation of the previous diagnostic.
            const previous = findings.at(-1);

            if (previous && /^\s+\S/.test(line)) {
                previous.message += `\n${line.trim()}`;
            }
        }

        // A failed run must never read as a clean one: crashes, bad flags and config
        // errors that tsc reports in a format we do not recognise still fail the lint.
        if (findings.length === 0 && result.exitCode !== 0) {
            const raw = `${result.stdout}\n${result.stderr}`.trim().slice(0, MAX_RAW_OUTPUT);

            findings.push({
                adapter: "typecheck",
                file: presence.root,
                fixable: false,
                message: result.exitCode === null ? `type-check did not complete (killed or timed out)${raw ? `:\n${raw}` : ""}` : `type-check failed (exit ${String(result.exitCode)}) with unrecognised output:\n${raw}`,
                severity: "error",
            });
        }

        return findings;
    },

    scope: "project",
};

const buildArgs = (options: AdapterRunOptions): string[] => (options.extraArgs?.length ? [...options.extraArgs] : []);
