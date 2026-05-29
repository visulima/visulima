import { readJsonSync, writeJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { resolveIndentForExistingFile } from "../util/editorconfig";
import { readPkg } from "../util/workspace-deps";

/**
 * Root `package.json` is missing `"private": true`.
 *
 * In a workspace the root is never publishable — it carries dev tools,
 * scripts, catalogs, and the `workspaces` field. Without `private: true`
 * a stray `npm publish` (or a misconfigured release pipeline) can push
 * it to the registry by accident.
 */
export interface RootPrivateIssue {
    packageJsonPath: string;
    /** Verbatim value of `private` if it was set to a non-`true` value. */
    rawValue: unknown;
}

/**
 * Decide whether a root package.json needs the `private: true` flag.
 *
 * Only fires when the root looks like a workspace root — i.e. it
 * declares a `workspaces` field or a `pnpm-workspace.yaml` is present.
 * That avoids false positives in single-package repos where vis is
 * occasionally used.
 */
export const lintRootPrivate = (workspaceRoot: string, hasWorkspaceConfig: boolean): RootPrivateIssue[] => {
    if (!hasWorkspaceConfig) {
        return [];
    }

    const packageJsonPath = join(workspaceRoot, "package.json");
    const pkg = readPkg(packageJsonPath);

    if (!pkg) {
        return [];
    }

    if (pkg.private === true) {
        return [];
    }

    return [
        {
            packageJsonPath,
            rawValue: pkg.private,
        },
    ];
};

export interface ApplyRootPrivateFixesOptions {
    useEditorconfig?: boolean;
}

/**
 * Set `"private": true` on the root package.json.
 *
 * Inserts the field before `dependencies`/`devDependencies` so the
 * publish-blocking flag is visible at the top of the file rather than
 * getting buried after deps. If the field exists with a falsy value,
 * its position is preserved — only the value is replaced.
 */
export const applyRootPrivateFixes = (issues: RootPrivateIssue[], options: ApplyRootPrivateFixesOptions = {}): string[] => {
    const { useEditorconfig } = options;
    const written: string[] = [];

    for (const issue of issues) {
        const pkg = readJsonSync(issue.packageJsonPath) as Record<string, unknown>;
        let toWrite: Record<string, unknown> = pkg;

        if ("private" in pkg) {
            pkg.private = true;
        } else {
            // Rebuild the object so `private` lands near the top — name,
            // version, private, then everything else. sort-package-json
            // would normalize this later anyway, but a sensible insertion
            // order keeps post-fix diffs minimal.
            const { name, version, ...rest } = pkg as { [key: string]: unknown; name?: unknown; version?: unknown };
            const rebuilt: Record<string, unknown> = {};

            if (name !== undefined) {
                rebuilt.name = name;
            }

            if (version !== undefined) {
                rebuilt.version = version;
            }

            rebuilt.private = true;

            for (const [key, value] of Object.entries(rest)) {
                rebuilt[key] = value;
            }

            toWrite = rebuilt;
        }

        writeJsonSync(issue.packageJsonPath, toWrite, { indent: resolveIndentForExistingFile(issue.packageJsonPath, { useEditorconfig }), overwrite: true });
        written.push(issue.packageJsonPath);
    }

    return written;
};
