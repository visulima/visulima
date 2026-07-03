import { readJsonSync, writeJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { resolveIndentForExistingFile } from "../util/editorconfig";
import { collectWorkspaceDirectories, readPkg } from "../util/workspace-deps";

/**
 * One occurrence of an empty `*Dependencies` object in a workspace package.json.
 *
 * Empty blocks (`"dependencies": {}`) are noise: they survive package
 * installs even after the last dep was removed and tools that diff
 * package.jsons (semantic-release, syncpack) flag them as drift. The
 * fix is to drop the key entirely.
 */
export interface EmptyDepsIssue {
    /** Which `*Dependencies` block was empty. */
    depType: EmptyDepType;
    packageDir: string;
    packageJsonPath: string;
    packageName: string | undefined;
}

export type EmptyDepType = "dependencies" | "devDependencies" | "optionalDependencies" | "peerDependencies";

const TRACKED_BLOCKS: EmptyDepType[] = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

export interface EmptyDepsLintOptions {
    /** Block names that should be ignored (exact match). */
    ignoreBlocks?: EmptyDepType[];
}

/**
 * Find every empty `*Dependencies` block across the workspace.
 *
 * The iterator skips packages without a readable `package.json` — those
 * are surfaced by the `missing-package-json` lint, not this one.
 */
export const lintEmptyDeps = (workspaceRoot: string, options: EmptyDepsLintOptions = {}): EmptyDepsIssue[] => {
    const ignored = new Set(options.ignoreBlocks);
    const directories = collectWorkspaceDirectories(workspaceRoot);
    const issues: EmptyDepsIssue[] = [];

    for (const directory of directories) {
        const packageJsonPath = join(workspaceRoot, directory, "package.json");
        const pkg = readPkg(packageJsonPath);

        if (!pkg) {
            continue;
        }

        const packageName = typeof pkg.name === "string" ? pkg.name : undefined;

        for (const depType of TRACKED_BLOCKS) {
            if (ignored.has(depType)) {
                continue;
            }

            const block = pkg[depType];

            // Only an *existing* empty object counts. `undefined` means
            // "field absent" which is fine; a non-object means malformed
            // and surfacing it here would shadow the JSON-shape error.
            if (typeof block === "object" && block !== null && !Array.isArray(block) && Object.keys(block).length === 0) {
                issues.push({
                    depType,
                    packageDir: directory,
                    packageJsonPath,
                    packageName,
                });
            }
        }
    }

    return issues;
};

export interface ApplyEmptyDepsFixesOptions {
    /** Disable `.editorconfig` indent discovery; falls back to file-content sniffing. */
    useEditorconfig?: boolean;
}

/**
 * Drop every empty `*Dependencies` block. Issues are grouped per file so
 * each affected package.json is rewritten at most once.
 */
export const applyEmptyDepsFixes = (issues: EmptyDepsIssue[], options: ApplyEmptyDepsFixesOptions = {}): string[] => {
    const { useEditorconfig } = options;
    const byFile = new Map<string, EmptyDepsIssue[]>();

    for (const issue of issues) {
        const list = byFile.get(issue.packageJsonPath);

        if (list) {
            list.push(issue);
        } else {
            byFile.set(issue.packageJsonPath, [issue]);
        }
    }

    const written: string[] = [];

    for (const [filePath, fileIssues] of byFile) {
        const pkg = readJsonSync(filePath) as Record<string, unknown>;

        for (const issue of fileIssues) {
            // Re-check before deletion — defensive in case something
            // mutated the file between lint and fix passes.
            const block = pkg[issue.depType];

            if (typeof block === "object" && block !== null && !Array.isArray(block) && Object.keys(block).length === 0) {
                Reflect.deleteProperty(pkg, issue.depType);
            }
        }

        writeJsonSync(filePath, pkg, { indent: resolveIndentForExistingFile(filePath, { useEditorconfig }), overwrite: true });
        written.push(filePath);
    }

    return written;
};
