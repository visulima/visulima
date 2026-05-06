import { readJsonSync, writeJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { resolveIndentForExistingFile } from "../util/editorconfig";
import { readPkg } from "../util/workspace-deps";

/**
 * Root `package.json` declares runtime `dependencies`.
 *
 * In a private workspace root those don't get installed for any
 * consumer — root is never published. They typically belong in
 * `devDependencies` (build / orchestration tooling) or in the
 * specific child package that actually imports them.
 *
 * `peerDependencies` and `optionalDependencies` are out of scope
 * here — those are unusual but legitimate at the root for some
 * release setups. Use the standard `redefine-root` lint to catch
 * duplication into children.
 */
export interface RootDepsIssue {
    /** Dep names found under root `dependencies`. */
    depNames: string[];
    packageJsonPath: string;
}

/**
 * Flag any non-empty `dependencies` block on a private workspace root.
 *
 * Public roots (no `private: true`) are skipped — that case is rare
 * but valid for repos that publish a meta-package; users opting into
 * that pattern shouldn't be nagged.
 */
export const lintRootDeps = (workspaceRoot: string, hasWorkspaceConfig: boolean): RootDepsIssue[] => {
    if (!hasWorkspaceConfig) {
        return [];
    }

    const packageJsonPath = join(workspaceRoot, "package.json");
    const pkg = readPkg(packageJsonPath);

    if (!pkg) {
        return [];
    }

    if (pkg.private !== true) {
        return [];
    }

    const block = pkg.dependencies;

    if (typeof block !== "object" || block === null || Array.isArray(block)) {
        return [];
    }

    const depNames = Object.keys(block);

    if (depNames.length === 0) {
        return [];
    }

    return [{ depNames, packageJsonPath }];
};

export interface ApplyRootDepsFixesOptions {
    useEditorconfig?: boolean;
}

/**
 * Move every entry from `dependencies` to `devDependencies` on the root.
 *
 * Safer than dropping the deps outright — they were declared for a reason
 * (build scripts, codegen, etc.) and the dev block is the right home.
 * Existing devDependencies entries win on conflict; we don't overwrite a
 * specific dev pin with a broader root one.
 */
export const applyRootDepsFixes = (issues: RootDepsIssue[], options: ApplyRootDepsFixesOptions = {}): string[] => {
    const { useEditorconfig } = options;
    const written: string[] = [];

    for (const issue of issues) {
        const pkg = readJsonSync(issue.packageJsonPath) as Record<string, unknown>;
        const deps = pkg.dependencies;

        if (typeof deps !== "object" || deps === null) {
            continue;
        }

        const depsRecord = deps as Record<string, string>;

        pkg.devDependencies ??= {};

        const devBlock = pkg.devDependencies as Record<string, string>;

        for (const name of issue.depNames) {
            const specifier = depsRecord[name];

            if (typeof specifier !== "string") {
                continue;
            }

            // Don't clobber a dev pin that's already pointing somewhere
            // specific. The drift gets surfaced by `workspace-versions`
            // / `redefine-root` rather than silently overwritten here.
            if (!(name in devBlock)) {
                devBlock[name] = specifier;
            }

            Reflect.deleteProperty(depsRecord, name);
        }

        if (Object.keys(depsRecord).length === 0) {
            Reflect.deleteProperty(pkg, "dependencies");
        }

        writeJsonSync(issue.packageJsonPath, pkg, {
            indent: resolveIndentForExistingFile(issue.packageJsonPath, { useEditorconfig }),
            overwrite: true,
        });
        written.push(issue.packageJsonPath);
    }

    return written;
};
