import { readJsonSync, writeJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { resolveIndentForExistingFile } from "../util/editorconfig";
import { readPkg } from "../util/workspace-deps";

/**
 * Root `package.json` is missing the `packageManager` field.
 *
 * `packageManager` is what corepack (and increasingly Node itself)
 * reads to decide which package manager + version to use. Without it,
 * a contributor's local pnpm/npm/yarn version can drift from CI's,
 * which silently breaks lockfile integrity.
 *
 * The `runtime-check` subsystem already validates the field's *value*
 * when present — this lint catches its absence.
 */
export interface RootPackageManagerIssue {
    packageJsonPath: string;
    /** Suggested specifier (`pnpm@10.0.0`) when policy gives one. `undefined` means report-only. */
    suggested: string | undefined;
}

export interface RootPackageManagerLintOptions {
    /**
     * Optional canonical specifier (e.g. `pnpm@10.32.1`). Used as the
     * `--fix` payload. With no specifier, the rule is detection-only —
     * vis can't pick a manager / version on the user's behalf.
     */
    suggested?: string;
}

const PACKAGE_MANAGER_REGEX = /^[a-z][\w-]*@\S+$/i;

/**
 * Detect missing or malformed `packageManager` field on the root.
 *
 * Only fires on workspace roots. Malformed values (`pnpm` without
 * `@version`, an array, etc.) are reported as if absent — corepack
 * rejects them anyway.
 */
export const lintRootPackageManager = (workspaceRoot: string, hasWorkspaceConfig: boolean, options: RootPackageManagerLintOptions = {}): RootPackageManagerIssue[] => {
    if (!hasWorkspaceConfig) {
        return [];
    }

    const packageJsonPath = join(workspaceRoot, "package.json");
    const pkg = readPkg(packageJsonPath);

    if (!pkg) {
        return [];
    }

    const value = pkg.packageManager;

    if (typeof value === "string" && PACKAGE_MANAGER_REGEX.test(value)) {
        return [];
    }

    return [
        {
            packageJsonPath,
            suggested: options.suggested,
        },
    ];
};

export interface ApplyRootPackageManagerFixesOptions {
    useEditorconfig?: boolean;
}

/**
 * Write `packageManager: &lt;suggested>` to the root package.json.
 *
 * Skips issues without a suggested specifier — we never invent a
 * version, since picking the wrong one would silently shift CI to a
 * different toolchain. The lint reports those as unfixable so the
 * user can plug in `policy.rootPackageManager.suggested` (or pass it
 * explicitly) and re-run.
 */
export const applyRootPackageManagerFixes = (
    issues: RootPackageManagerIssue[],
    options: ApplyRootPackageManagerFixesOptions = {},
): string[] => {
    const { useEditorconfig } = options;
    const written: string[] = [];

    for (const issue of issues) {
        if (!issue.suggested) {
            continue;
        }

        const pkg = readJsonSync(issue.packageJsonPath) as Record<string, unknown>;

        pkg.packageManager = issue.suggested;

        writeJsonSync(issue.packageJsonPath, pkg, {
            indent: resolveIndentForExistingFile(issue.packageJsonPath, { useEditorconfig }),
            overwrite: true,
        });
        written.push(issue.packageJsonPath);
    }

    return written;
};
