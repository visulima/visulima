import { readJsonSync, writeJsonSync } from "@visulima/fs";

import { resolveIndentForExistingFile } from "../util/editorconfig";
import type { DepInstance } from "../util/workspace-deps";

/**
 * `@types/*` declared under `dependencies` in a private package.
 *
 * Type-only deps don't ship at runtime, so a private (non-published)
 * package that puts them in `dependencies` is just adding noise to
 * `npm install` consumers — and forcing them into the production
 * resolution graph for no reason. Public packages that ship `.d.ts`
 * files referencing those types may legitimately need them in
 * `dependencies` (TypeScript "isolated declarations" or DefinitelyTyped
 * peers), so we only flag private packages.
 */
export interface TypesInDepsIssue {
    /** Verbatim specifier we'd move (preserves caret/tilde/range). */
    childSpecifier: string;
    depName: string;
    packageDir: string;
    packageJsonPath: string;
    packageName: string | undefined;
}

export interface TypesInDepsLintOptions {
    /** Dep names exempt from the rule (exact match). */
    ignoreDeps?: string[];
}

const isTypesPackage = (depName: string): boolean => depName.startsWith("@types/");

/**
 * Find every `@types/*` placed in `dependencies` of a private package.
 *
 * The lint reads `private` from the same package.json the dep instance
 * points at — `iterateWorkspaceDeps` does not surface it directly, so
 * we group instances by file first and fetch the `private` flag once
 * per package.json.
 *
 * Public packages and entries already in `devDependencies` /
 * `peerDependencies` are skipped — only the misplacement on a private
 * package is wrong. Workspace-internal types packages (rare) are
 * included; the check is structural, not registry-based.
 */
export const lintTypesInDeps = (instances: DepInstance[], options: TypesInDepsLintOptions = {}): TypesInDepsIssue[] => {
    const ignored = new Set(options.ignoreDeps);
    const privateByPath = new Map<string, boolean>();

    const isPrivate = (path: string): boolean => {
        const cached = privateByPath.get(path);

        if (cached !== undefined) {
            return cached;
        }

        try {
            const pkg = readJsonSync(path) as { private?: unknown };
            const result = pkg.private === true;

            privateByPath.set(path, result);

            return result;
        } catch {
            // Unreadable package.json — bail out conservatively. The
            // missing-package-json / shape-of-json lints will surface
            // the underlying problem.
            privateByPath.set(path, false);

            return false;
        }
    };

    const issues: TypesInDepsIssue[] = [];

    for (const instance of instances) {
        if (instance.depType !== "dependencies") {
            continue;
        }

        if (!isTypesPackage(instance.depName)) {
            continue;
        }

        if (ignored.has(instance.depName)) {
            continue;
        }

        if (!isPrivate(instance.packageJsonPath)) {
            continue;
        }

        issues.push({
            childSpecifier: instance.specifier,
            depName: instance.depName,
            packageDir: instance.packageDir,
            packageJsonPath: instance.packageJsonPath,
            packageName: instance.packageName,
        });
    }

    return issues;
};

export interface ApplyTypesInDepsFixesOptions {
    useEditorconfig?: boolean;
}

/**
 * Move every flagged `@types/*` from `dependencies` to `devDependencies`.
 *
 * On conflict (same name already in `devDependencies` at a different
 * specifier) we preserve the existing dev pin — the dev block is
 * authoritative for tooling, and overwriting it could silently shift
 * the type-checking version. Drop the dep from `dependencies` either way.
 */
export const applyTypesInDepsFixes = (issues: TypesInDepsIssue[], options: ApplyTypesInDepsFixesOptions = {}): string[] => {
    const { useEditorconfig } = options;
    const byFile = new Map<string, TypesInDepsIssue[]>();

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
        const deps = pkg.dependencies;

        if (typeof deps !== "object" || deps === null) {
            continue;
        }

        const depsRecord = deps as Record<string, string>;

        pkg.devDependencies ??= {};

        const devBlock = pkg.devDependencies as Record<string, string>;

        for (const issue of fileIssues) {
            const specifier = depsRecord[issue.depName];

            if (typeof specifier !== "string") {
                continue;
            }

            if (!(issue.depName in devBlock)) {
                devBlock[issue.depName] = specifier;
            }

            Reflect.deleteProperty(depsRecord, issue.depName);
        }

        if (Object.keys(depsRecord).length === 0) {
            Reflect.deleteProperty(pkg, "dependencies");
        }

        writeJsonSync(filePath, pkg, { indent: resolveIndentForExistingFile(filePath, { useEditorconfig }), overwrite: true });
        written.push(filePath);
    }

    return written;
};
