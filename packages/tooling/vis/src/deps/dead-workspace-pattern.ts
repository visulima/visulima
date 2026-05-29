import { isAccessibleSync, readFileSync, readJsonSync, writeFileSync, writeJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { readPnpmWorkspacePatterns, resolveWorkspacePatterns } from "../config/workspace";
import { resolveIndentForExistingFile } from "../util/editorconfig";

/**
 * A workspace pattern that doesn't match any directory.
 *
 * Common after a sub-tree was deleted but `pnpm-workspace.yaml`
 * (or `package.json#workspaces`) wasn't pruned. Dead patterns waste
 * traversal time on every install and confuse newcomers reading the
 * config.
 */
export interface DeadWorkspacePatternIssue {
    /** The verbatim pattern that resolved to zero directories. */
    pattern: string;
    /** Where the pattern lives — drives which file `--fix` rewrites. */
    source: "package.json" | "pnpm-workspace.yaml";
    /** Absolute path of the source file. */
    sourcePath: string;
}

/**
 * Read raw workspace patterns from `pnpm-workspace.yaml` first, then
 * `package.json#workspaces`. Each is checked individually against the
 * filesystem; patterns matching zero dirs are reported.
 *
 * Excludes (`!pattern`) are intentionally not validated — a "dead"
 * exclude is harmless noise, not a misconfiguration.
 */
export const lintDeadWorkspacePatterns = (workspaceRoot: string): DeadWorkspacePatternIssue[] => {
    const issues: DeadWorkspacePatternIssue[] = [];

    const pnpmPatterns = readPnpmWorkspacePatterns(workspaceRoot);

    if (pnpmPatterns) {
        const sourcePath = join(workspaceRoot, "pnpm-workspace.yaml");

        for (const pattern of pnpmPatterns) {
            if (pattern.startsWith("!")) {
                continue;
            }

            if (resolveWorkspacePatterns(workspaceRoot, [pattern]).length === 0) {
                issues.push({ pattern, source: "pnpm-workspace.yaml", sourcePath });
            }
        }
    }

    // Even when pnpm-workspace.yaml exists we still scan package.json#workspaces
    // — multi-tool repos (npm + pnpm) sometimes carry both, and dead
    // patterns can rot in either.
    const rootPkgPath = join(workspaceRoot, "package.json");

    if (isAccessibleSync(rootPkgPath)) {
        const rootPkg = readJsonSync(rootPkgPath) as { workspaces?: string[] | { packages?: string[] } };
        const raw = rootPkg.workspaces;
        const patterns = Array.isArray(raw) ? raw : raw?.packages;

        if (patterns) {
            for (const pattern of patterns) {
                if (typeof pattern !== "string" || pattern.startsWith("!")) {
                    continue;
                }

                if (resolveWorkspacePatterns(workspaceRoot, [pattern]).length === 0) {
                    issues.push({ pattern, source: "package.json", sourcePath: rootPkgPath });
                }
            }
        }
    }

    return issues;
};

export interface ApplyDeadWorkspacePatternFixesOptions {
    useEditorconfig?: boolean;
}

/**
 * Strip every dead pattern from its source file. Issues are grouped by
 * source so each file is read + rewritten once.
 *
 * For `pnpm-workspace.yaml` we do a line-level edit rather than a YAML
 * round-trip — that preserves comments / aliases that a parse-and-emit
 * cycle would normalize away. The matcher is conservative: it only
 * deletes lines whose value (after trimming `- ` and surrounding
 * quotes) exactly matches a dead pattern.
 */
export const applyDeadWorkspacePatternFixes = (issues: DeadWorkspacePatternIssue[], options: ApplyDeadWorkspacePatternFixesOptions = {}): string[] => {
    const { useEditorconfig } = options;
    const bySource = new Map<string, DeadWorkspacePatternIssue[]>();

    for (const issue of issues) {
        const list = bySource.get(issue.sourcePath);

        if (list) {
            list.push(issue);
        } else {
            bySource.set(issue.sourcePath, [issue]);
        }
    }

    const written: string[] = [];

    for (const [filePath, fileIssues] of bySource) {
        const dead = new Set(fileIssues.map((issue) => issue.pattern));
        const isYaml = filePath.endsWith(".yaml") || filePath.endsWith(".yml");

        if (isYaml) {
            const original = readFileSync(filePath);
            const out = original
                .split("\n")
                .filter((line) => {
                    const trimmed = line.trim();

                    if (!trimmed.startsWith("- ")) {
                        return true;
                    }

                    const value = trimmed.slice(2).replaceAll(/^['"]|['"]$/g, "");

                    return !dead.has(value);
                })
                .join("\n");

            writeFileSync(filePath, out, { overwrite: true });
            written.push(filePath);

            continue;
        }

        const pkg = readJsonSync(filePath) as { workspaces?: string[] | { packages?: string[] } };
        const raw = pkg.workspaces;

        if (Array.isArray(raw)) {
            pkg.workspaces = raw.filter((pattern) => typeof pattern !== "string" || !dead.has(pattern));
        } else if (raw && Array.isArray(raw.packages)) {
            raw.packages = raw.packages.filter((pattern) => typeof pattern !== "string" || !dead.has(pattern));
        }

        writeJsonSync(filePath, pkg, { indent: resolveIndentForExistingFile(filePath, { useEditorconfig }), overwrite: true });
        written.push(filePath);
    }

    return written;
};
