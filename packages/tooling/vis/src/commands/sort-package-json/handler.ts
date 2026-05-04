import { writeFileSync } from "node:fs";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { basename, join, relative, resolve } from "@visulima/path";
import zeptomatch from "zeptomatch";

import { sortPackageJsonStringWithOptions } from "#native";

import { readPnpmWorkspacePatterns, resolveWorkspacePatterns } from "../../config/workspace";
import { pail } from "../../io/logger";
import { errorMessage } from "../../util/utils";
import type { SortPackageJsonOptions } from "./index";

type LineEnding = "auto" | "crlf" | "lf";

interface SortPackageJsonConfig {
    finalNewline?: boolean;
    ignore?: string[];
    indent?: string;
    lineEnding?: LineEnding;
    sortOrder?: string[];
    sortScripts?: boolean;
    unsorted?: string[];
}

interface NormalizedConfig {
    finalNewline: boolean;
    ignore: string[];
    indent: string | undefined;
    lineEnding: LineEnding;
    sortOrder: string[];
    sortScripts: boolean;
    unsorted: string[];
}

/**
 * Finds all package.json files in the monorepo workspace.
 *
 * Uses workspace patterns (from pnpm-workspace.yaml or package.json workspaces)
 * to discover project directories. Always includes the root package.json.
 */
const findPackageJsonFiles = (root: string): string[] => {
    const seen = new Set<string>();
    const results: string[] = [];

    const addFile = (filePath: string): void => {
        const resolved = resolve(filePath);

        if (!seen.has(resolved) && isAccessibleSync(resolved)) {
            seen.add(resolved);
            results.push(resolved);
        }
    };

    addFile(join(root, "package.json"));

    const pnpmPatterns = readPnpmWorkspacePatterns(root);

    if (pnpmPatterns) {
        const projectDirectories = resolveWorkspacePatterns(root, pnpmPatterns);

        for (const dir of projectDirectories) {
            addFile(join(root, dir, "package.json"));
        }
    } else {
        const rootPkgPath = join(root, "package.json");

        if (isAccessibleSync(rootPkgPath)) {
            const rootPkg = JSON.parse(readFileSync(rootPkgPath)) as {
                workspaces?: string[] | { packages?: string[] };
            };
            const patterns = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : rootPkg.workspaces?.packages;

            if (patterns) {
                const projectDirectories = resolveWorkspacePatterns(root, patterns);

                for (const dir of projectDirectories) {
                    addFile(join(root, dir, "package.json"));
                }
            }
        }
    }

    return results;
};

/**
 * Detects the leading indent of a JSON document by sampling the
 * whitespace on the first child line. Falls back to two spaces.
 */
const detectIndent = (contents: string): string => {
    const match = /\n([ \t]+)/.exec(contents);

    return match?.[1] ?? "  ";
};

/**
 * Resolves a user-supplied indent override into a literal whitespace
 * string. Accepts:
 *   - a digit string ("2", "4") — that many spaces
 *   - "tab" or "\t" — a single tab
 *   - any literal whitespace (already-resolved value from config)
 * Returns `undefined` for empty/missing input so the caller falls back
 * to per-file detection.
 */
const resolveIndentOverride = (raw: string | undefined): string | undefined => {
    if (raw === undefined || raw === "") {
        return undefined;
    }

    if (raw === "tab" || raw === String.raw`\t`) {
        return "\t";
    }

    if (/^\d+$/.test(raw)) {
        return " ".repeat(Number.parseInt(raw, 10));
    }

    return raw;
};

/**
 * Splits a CLI-supplied list value into a clean array. Accepts both a
 * single comma-joined string ("a,b") and a repeated multi-flag form
 * (["a", "b,c"]). Empty entries are dropped.
 */
const splitList = (raw: string | string[] | undefined): string[] => {
    if (raw === undefined) {
        return [];
    }

    const items = Array.isArray(raw) ? raw : [raw];

    return items
        .flatMap((item) => item.split(","))
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
};

const detectLineEnding = (contents: string): "crlf" | "lf" => (contents.includes("\r\n") ? "crlf" : "lf");

const ALLOWED_LINE_ENDINGS = new Set<LineEnding>(["auto", "crlf", "lf"]);

// eslint-disable-next-line consistent-return
const validateLineEnding = (raw: string | undefined): LineEnding => {
    if (raw === undefined || raw === "") {
        return "auto";
    }

    if (ALLOWED_LINE_ENDINGS.has(raw as LineEnding)) {
        return raw as LineEnding;
    }

    pail.error(`--line-ending must be one of: auto, lf, crlf (got "${raw}")`);
    process.exit(2);
};

/**
 * Drops files whose path matches any of the user-supplied ignore
 * patterns. Patterns without `/` match against the basename (lint-staged
 * semantics); path-style patterns match against the workspace-relative
 * path.
 */
const filterByIgnore = (files: string[], patterns: string[], cwd: string): string[] => {
    if (patterns.length === 0) {
        return files;
    }

    return files.filter((absolute) => {
        const relPath = relative(cwd, absolute);
        const base = basename(absolute);

        return !patterns.some((pattern) => {
            const target = pattern.includes("/") ? relPath : base;

            return zeptomatch(pattern, target);
        });
    });
};

/**
 * Builds a new object that places the user-supplied keys first (in the
 * given order, when present), then keeps the remaining keys in their
 * existing order. Used to apply `sortOrder` after the native crate has
 * already produced its conventional ordering.
 */
const applySortOrder = (object: Record<string, unknown>, sortOrder: string[]): Record<string, unknown> => {
    if (sortOrder.length === 0) {
        return object;
    }

    const result: Record<string, unknown> = {};
    const consumed = new Set<string>();

    for (const key of sortOrder) {
        if (Object.hasOwn(object, key)) {
            result[key] = object[key];
            consumed.add(key);
        }
    }

    for (const key of Object.keys(object)) {
        if (!consumed.has(key)) {
            result[key] = object[key];
        }
    }

    return result;
};

/**
 * Restores the original (unsorted) values for the named top-level
 * sections, preserving the input's insertion order for those sections
 * while keeping the rest of the file sorted.
 */
const restoreUnsortedSections = (sorted: Record<string, unknown>, original: Record<string, unknown>, unsorted: string[]): Record<string, unknown> => {
    if (unsorted.length === 0) {
        return sorted;
    }

    const result: Record<string, unknown> = { ...sorted };

    for (const key of unsorted) {
        if (Object.hasOwn(original, key)) {
            result[key] = original[key];
        }
    }

    return result;
};

/**
 * Sorts a package.json string using the native Rust binding for key
 * ordering, then re-serializes with `JSON.stringify` to apply the
 * caller's indent. Going through `pretty: false` + `JSON.parse` keeps
 * us decoupled from the Rust crate's hardcoded two-space pretty
 * output and lets us layer our own post-processing (custom prefix
 * order, unsorted-section preservation, line-ending and trailing-
 * newline policy).
 */
const sortContents = (contents: string, config: NormalizedConfig): string => {
    const indent = config.indent ?? detectIndent(contents);
    const lineEnding = config.lineEnding === "auto" ? detectLineEnding(contents) : config.lineEnding;

    const compact = sortPackageJsonStringWithOptions(contents, {
        pretty: false,
        sortScripts: config.sortScripts,
    });

    let parsed = JSON.parse(compact) as Record<string, unknown>;

    if (config.unsorted.length > 0) {
        const original = JSON.parse(contents) as Record<string, unknown>;

        parsed = restoreUnsortedSections(parsed, original, config.unsorted);
    }

    parsed = applySortOrder(parsed, config.sortOrder);

    let output = JSON.stringify(parsed, null, indent);

    if (config.finalNewline) {
        output += "\n";
    }

    if (lineEnding === "crlf") {
        output = output.replaceAll("\n", "\r\n");
    }

    return output;
};

const execute = async ({ options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, SortPackageJsonOptions>): Promise<void> => {
    const cwd = wsRoot ?? process.cwd();
    const config = (visConfig as Record<string, unknown> | undefined)?.["sortPackageJson"] as SortPackageJsonConfig | undefined;
    const check = options.check || false;

    const normalized: NormalizedConfig = {
        finalNewline: options.finalNewline ?? config?.finalNewline ?? true,
        ignore: [...splitList(options.ignore), ...(config?.ignore ?? [])],
        indent: resolveIndentOverride(options.indent ?? config?.indent),
        lineEnding: validateLineEnding(options.lineEnding ?? config?.lineEnding),
        sortOrder: [...splitList(options.sortOrder), ...(config?.sortOrder ?? [])],
        sortScripts: options.sortScripts || config?.sortScripts || false,
        unsorted: [...splitList(options.unsorted), ...(config?.unsorted ?? [])],
    };

    const allFiles = findPackageJsonFiles(cwd);
    const files = filterByIgnore(allFiles, normalized.ignore, cwd);

    if (files.length === 0) {
        pail.info(allFiles.length === 0 ? "No package.json files found." : "All package.json files were excluded by --ignore.");

        return;
    }

    let unsortedCount = 0;
    let sortedCount = 0;
    let errorCount = 0;

    for (const filePath of files) {
        try {
            const contents: string = readFileSync(filePath);

            let sorted: string;

            try {
                sorted = sortContents(contents, normalized);
            } catch (error: unknown) {
                pail.error(`${filePath}: ${errorMessage(error)}`);
                errorCount++;
                continue;
            }

            if (contents === sorted) {
                sortedCount++;
                continue;
            }

            unsortedCount++;

            if (check) {
                pail.warn(`${filePath} is not sorted`);
            } else {
                writeFileSync(filePath, sorted, "utf8");
                pail.success(`Sorted ${filePath}`);
            }
        } catch (error: unknown) {
            pail.error(`${filePath}: ${errorMessage(error)}`);
            errorCount++;
        }
    }

    if (check) {
        if (unsortedCount > 0) {
            pail.info(`${unsortedCount} file${unsortedCount === 1 ? "" : "s"} not sorted, ${sortedCount} already sorted`);
            process.exitCode = 1;
        } else {
            pail.info(`All ${sortedCount} package.json file${sortedCount === 1 ? " is" : "s are"} sorted`);
        }
    } else {
        const parts: string[] = [];

        if (unsortedCount > 0) {
            parts.push(`sorted ${unsortedCount} file${unsortedCount === 1 ? "" : "s"}`);
        }

        if (sortedCount > 0) {
            parts.push(`${sortedCount} already sorted`);
        }

        if (errorCount > 0) {
            parts.push(`${errorCount} error${errorCount === 1 ? "" : "s"}`);
        }

        pail.info(parts.join(", "));
    }

    if (errorCount > 0) {
        process.exitCode = 1;
    }
};

export default execute as CommandExecute<Toolbox>;
