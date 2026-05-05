import { readJsonSync, writeJsonSync } from "@visulima/fs";

import type { DepInstance, DepType } from "./workspace-deps";

/**
 * One violation of the workspace-protocol policy.
 *
 * A workspace dep must be referenced via the `workspace:` protocol (`workspace:*`,
 * `workspace:^`, `workspace:~`, or `workspace:&lt;range>`). Any other specifier — a
 * concrete version, `npm:`, `file:`, `link:`, etc. — is treated as a violation.
 */
export interface WorkspaceProtocolIssue {
    depName: string;
    depType: DepType;
    /** What `vis lint --fix` will rewrite the specifier to. Defaults to `workspace:*`. */
    fix: string;
    packageDir: string;
    packageJsonPath: string;
    packageName: string | undefined;
    specifier: string;
}

export interface WorkspaceProtocolLintOptions {
    /**
     * Specifier used by `--fix`. Pin-style (`workspace:^`) preserves the
     * caret/tilde signal at publish time; the wildcard (`workspace:*`) is the
     * loosest form and the most common default in pnpm/bun/yarn-berry repos.
     * @default "workspace:*"
     */
    fixSpecifier?: string;
}

const isWorkspaceSpecifier = (specifier: string): boolean => specifier.startsWith("workspace:");

/**
 * Find every internal dep that does *not* use the `workspace:` protocol.
 *
 * Pure function over the iterator output so it stays trivially testable —
 * the command handler does the IO, this returns the punch list.
 */
export const lintWorkspaceProtocol = (instances: DepInstance[], options: WorkspaceProtocolLintOptions = {}): WorkspaceProtocolIssue[] => {
    const fix = options.fixSpecifier ?? "workspace:*";
    const issues: WorkspaceProtocolIssue[] = [];

    for (const instance of instances) {
        if (!instance.isInternal) {
            continue;
        }

        if (isWorkspaceSpecifier(instance.specifier)) {
            continue;
        }

        issues.push({
            depName: instance.depName,
            depType: instance.depType,
            fix,
            packageDir: instance.packageDir,
            packageJsonPath: instance.packageJsonPath,
            packageName: instance.packageName,
            specifier: instance.specifier,
        });
    }

    return issues;
};

const setNestedField = (object: Record<string, unknown>, dotPath: string, key: string, value: string): void => {
    const parts = dotPath.split(".");
    let current = object;

    for (let index = 0; index < parts.length - 1; index += 1) {
        const part = parts[index] as string;
        const next = current[part];

        if (typeof next !== "object" || next === null) {
            current[part] = {};
        }

        current = current[part] as Record<string, unknown>;
    }

    const lastPart = parts.at(-1) as string;
    let block = current[lastPart];

    if (typeof block !== "object" || block === null) {
        block = {};
        current[lastPart] = block;
    }

    (block as Record<string, string>)[key] = value;
};

/**
 * Apply every issue in-place to the affected package.json files. Issues are
 * grouped per file so we open + parse + write each file at most once.
 *
 * Indent is preserved via `@visulima/fs#writeJsonSync`'s `detectIndent: true`.
 */
export const applyWorkspaceProtocolFixes = (issues: WorkspaceProtocolIssue[]): string[] => {
    const byFile = new Map<string, WorkspaceProtocolIssue[]>();

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
            if (issue.depType.includes(".")) {
                setNestedField(pkg, issue.depType, issue.depName, issue.fix);
            } else {
                const block = pkg[issue.depType];

                if (typeof block === "object" && block !== null) {
                    (block as Record<string, string>)[issue.depName] = issue.fix;
                }
            }
        }

        writeJsonSync(filePath, pkg, { detectIndent: true, overwrite: true });
        written.push(filePath);
    }

    return written;
};
