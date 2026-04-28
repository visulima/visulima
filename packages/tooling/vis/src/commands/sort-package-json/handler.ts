import { writeFileSync } from "node:fs";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { join, resolve } from "@visulima/path";
import { sortPackageJsonStringWithOptions } from "#native";

import { failure, info, success, warn } from "../../output";
import { errorMessage } from "../../utils";
import { readPnpmWorkspacePatterns, resolveWorkspacePatterns } from "../../workspace";
import type { SortPackageJsonOptions } from "./index";

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

    // Root package.json
    addFile(join(root, "package.json"));

    // Use workspace patterns to discover project package.json files
    const pnpmPatterns = readPnpmWorkspacePatterns(root);

    if (pnpmPatterns) {
        const projectDirectories = resolveWorkspacePatterns(root, pnpmPatterns);

        for (const dir of projectDirectories) {
            addFile(join(root, dir, "package.json"));
        }
    } else {
        // Fallback: read workspaces from root package.json
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

    if (raw === "tab" || raw === "\\t") {
        return "\t";
    }

    if (/^\d+$/.test(raw)) {
        return " ".repeat(Number.parseInt(raw, 10));
    }

    return raw;
};

/**
 * Sorts a package.json string using the native Rust binding for key
 * ordering, then re-serializes with `JSON.stringify` to apply the
 * caller's indent. Going through `pretty: false` + `JSON.parse` keeps
 * us decoupled from the Rust crate's hardcoded two-space pretty
 * output.
 */
const sortContents = (contents: string, sortScripts: boolean, indent: string): string => {
    const compact = sortPackageJsonStringWithOptions(contents, {
        pretty: false,
        sortScripts,
    });

    return JSON.stringify(JSON.parse(compact) as unknown, null, indent);
};

const execute = async ({ options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, SortPackageJsonOptions>): Promise<void> => {
    const cwd = wsRoot ?? process.cwd();
    const config = (visConfig as Record<string, unknown> | undefined)?.["sortPackageJson"] as { indent?: string; sortScripts?: boolean } | undefined;
    const check = options.check || false;
    const sortScripts = options.sortScripts || config?.sortScripts || false;
    const indentOverride = resolveIndentOverride(options.indent ?? config?.indent);
    const files = findPackageJsonFiles(cwd);

    if (files.length === 0) {
        info("No package.json files found.");

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
                const indent = indentOverride ?? detectIndent(contents);

                sorted = sortContents(contents, sortScripts, indent);
            } catch (error: unknown) {
                failure(`${filePath}: ${errorMessage(error)}`);
                errorCount++;
                continue;
            }

            // Normalize: ensure trailing newline for comparison
            const normalizedContents = contents.endsWith("\n") ? contents : `${contents}\n`;
            const normalizedSorted = sorted.endsWith("\n") ? sorted : `${sorted}\n`;

            if (normalizedContents === normalizedSorted) {
                sortedCount++;
                continue;
            }

            unsortedCount++;

            if (check) {
                warn(`${filePath} is not sorted`);
            } else {
                writeFileSync(filePath, normalizedSorted, "utf8");
                success(`Sorted ${filePath}`);
            }
        } catch (error: unknown) {
            failure(`${filePath}: ${errorMessage(error)}`);
            errorCount++;
        }
    }

    if (check) {
        if (unsortedCount > 0) {
            info(`${unsortedCount} file${unsortedCount === 1 ? "" : "s"} not sorted, ${sortedCount} already sorted`);
            process.exitCode = 1;
        } else {
            info(`All ${sortedCount} package.json file${sortedCount === 1 ? " is" : "s are"} sorted`);
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

        info(parts.join(", "));
    }

    if (errorCount > 0) {
        process.exitCode = 1;
    }
};

export default execute as CommandExecute<Toolbox>;
