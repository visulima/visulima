import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Command } from "@visulima/cerebro";
import { isAccessibleSync, walkSync } from "@visulima/fs";
import { resolve } from "@visulima/path";

import { loadNativeBindings } from "../native-binding";
import { failure, info, success, warn } from "../output";
import { errorMessage } from "../utils";
import { readPnpmWorkspacePatterns, resolveWorkspacePatterns } from "../workspace";

const NODE_MODULES_RE = /node_modules/;
const DOT_GIT_RE = /\.git/;
const FIXTURES_RE = /__fixtures__/;

/**
 * Finds all package.json files in the monorepo workspace.
 *
 * Uses workspace patterns (from pnpm-workspace.yaml or package.json workspaces)
 * to discover project directories, then collects every package.json in those
 * directories (including nested ones). Also includes the root package.json
 * and walks apps/ and packages/ to catch any package.json files that workspace
 * patterns might not cover (e.g. examples, shared configs).
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

    // 1. Root package.json
    addFile(join(root, "package.json"));

    // 2. Use workspace patterns to discover project package.json files
    try {
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
    } catch {
        // Workspace detection failed, fall through to walk
    }

    // 3. Walk the entire tree to catch anything the workspace patterns missed
    //    (shared configs, examples, tooling dirs, etc.)
    for (const entry of walkSync(root, {
        includeDirs: false,
        includeSymlinks: false,
        skip: [NODE_MODULES_RE, DOT_GIT_RE, FIXTURES_RE],
    })) {
        if (entry.name === "package.json") {
            addFile(entry.path);
        }
    }

    return results;
};

/**
 * Sorts a package.json string using the native Rust binding or a JS fallback.
 * Returns the sorted string.
 */
const sortContents = (contents: string, sortScripts: boolean): string => {
    const native = loadNativeBindings();

    if (native) {
        return native.sortPackageJsonStringWithOptions(contents, {
            pretty: true,
            sort_scripts: sortScripts,
        });
    }

    // JS fallback: parse, sort keys manually with sort-package-json npm package
    // We dynamically import to avoid bundling it when native is available
    throw new Error("Native bindings not available and JS fallback not bundled. Install the native bindings or use the standalone sort-package-json package.");
};

const sortPackageJson: Command = {
    description: "Sort package.json files across the workspace using the oxc Rust sorter",
    examples: [
        ["vis sort-package-json", "Sort all package.json files in the workspace"],
        ["vis sort-package-json --check", "Check if files are already sorted (exit 1 if not)"],
        ["vis sort-package-json --sort-scripts", "Also sort the scripts field alphabetically"],
        ["vis sort-package-json src/package.json", "Sort specific file(s)"],
    ],
    execute: async ({ argument, logger, options, workspaceRoot: wsRoot }) => {
        const cwd = wsRoot ?? process.cwd();
        const check = (options.check as boolean) || false;
        const sortScripts = (options["sort-scripts"] as boolean) || false;

        let files: string[];

        if (argument && argument.length > 0) {
            // Sort specific files passed as arguments
            files = argument.map((f: string) => (f.startsWith("/") ? f : join(cwd, f)));
        } else {
            files = findPackageJsonFiles(cwd);
        }

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
