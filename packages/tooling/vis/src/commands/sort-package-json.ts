import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Command } from "@visulima/cerebro";
import { isAccessibleSync } from "@visulima/fs";
import { resolve } from "@visulima/path";

import { loadNativeBindings } from "../native-binding";
import { failure, info, success, warn } from "../output";
import { errorMessage } from "../utils";
import { readPnpmWorkspacePatterns, resolveWorkspacePatterns } from "../workspace";

/**
 * Finds all package.json files in the monorepo workspace.
 *
 * Uses workspace patterns (from pnpm-workspace.yaml or package.json workspaces)
 * to discover project directories. Always includes the root package.json.
 */
const findPackageJsonFiles = (root: string): string[] => {
    const results: string[] = [];

    const addFile = (filePath: string): void => {
        const resolved = resolve(filePath);

        if (isAccessibleSync(resolved)) {
            results.push(resolved);
        }
    };

    // Root package.json
    addFile(join(root, "package.json"));

    // Use workspace patterns to discover project package.json files
    const pnpmPatterns = readPnpmWorkspacePatterns(root);

    if (pnpmPatterns) {
        const projectDirs = resolveWorkspacePatterns(root, pnpmPatterns);

        for (const dir of projectDirs) {
            addFile(join(root, dir, "package.json"));
        }
    } else {
        // Fallback: read workspaces from root package.json
        const rootPkgPath = join(root, "package.json");

        if (isAccessibleSync(rootPkgPath)) {
            const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf8")) as {
                workspaces?: string[] | { packages?: string[] };
            };
            const patterns = Array.isArray(rootPkg.workspaces)
                ? rootPkg.workspaces
                : rootPkg.workspaces?.packages;

            if (patterns) {
                const projectDirs = resolveWorkspacePatterns(root, patterns);

                for (const dir of projectDirs) {
                    addFile(join(root, dir, "package.json"));
                }
            }
        }
    }

    return results;
};

/**
 * Sorts a package.json string using the native Rust binding.
 */
const sortContents = (contents: string, sortScripts: boolean): string =>
    loadNativeBindings()!.sortPackageJsonStringWithOptions(contents, {
        pretty: true,
        sort_scripts: sortScripts,
    });

const sortPackageJson: Command = {
    description: "Sort package.json files across the workspace using the oxc Rust sorter",
    examples: [
        ["vis sort-package-json", "Sort all package.json files in the workspace"],
        ["vis sort-package-json --check", "Check if files are already sorted (exit 1 if not)"],
        ["vis sort-package-json --sort-scripts", "Also sort the scripts field alphabetically"],
    ],
    execute: async ({ options, workspaceRoot: wsRoot }) => {
        const cwd = wsRoot ?? process.cwd();
        const check = (options.check as boolean) || false;
        const sortScripts = (options["sort-scripts"] as boolean) || false;
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
                const contents = readFileSync(filePath, "utf8");

                let sorted: string;

                try {
                    sorted = sortContents(contents, sortScripts);
                } catch (error: unknown) {
                    failure(`${filePath}: ${errorMessage(error)}`);
                    errorCount++;
                    continue;
                }

                // Normalize: ensure trailing newline for comparison
                const normalizedContents = contents.endsWith("\n") ? contents : contents + "\n";
                const normalizedSorted = sorted.endsWith("\n") ? sorted : sorted + "\n";

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
    },
    name: "sort-package-json",
    options: [
        {
            alias: "c",
            defaultValue: false,
            description: "Check if package.json files are sorted without writing (exits 1 if unsorted)",
            name: "check",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Also sort the scripts field alphabetically",
            name: "sort-scripts",
            type: Boolean,
        },
    ],
};

export default sortPackageJson;
