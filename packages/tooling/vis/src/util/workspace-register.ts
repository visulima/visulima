import { isAccessibleSync, readFileSync, readJsonSync, writeFileSync, writeJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";

import type { PackageJson } from "../config/workspace";
import { readWorkspacePatterns, resolveWorkspacePatterns } from "../config/workspace";
import { normalizeWorkspacePath } from "./utils";

/**
 * Wires a freshly imported package into the workspace config so it
 * becomes a real workspace member, instead of leaving the user to edit
 * `pnpm-workspace.yaml` / `package.json#workspaces` by hand.
 *
 * Idempotent: the common case (the import prefix already falls under an
 * existing glob such as `packages/**`) makes no edit at all.
 */

/** YAML config names in the same precedence pnpm/aube use. */
const WORKSPACE_YAML_NAMES = ["aube-workspace.yaml", "pnpm-workspace.yaml"] as const;

export type WorkspaceRegisterStatus = "added" | "already-covered" | "no-config";

export interface EnsureWorkspaceMembershipInput {
    /** When true, compute the intended edit but write nothing. */
    dryRun?: boolean;
    /** Workspace-relative directory of the imported package (POSIX). */
    prefix: string;
    workspaceRoot: string;
}

export interface EnsureWorkspaceMembershipResult {
    /** The pattern that was (or would be) added. */
    entry?: string;
    /** Config file that was (or would be) edited, relative to the root. */
    file?: string;
    status: WorkspaceRegisterStatus;
}

const PACKAGES_HEADER_RE = /^\s*packages\s*:\s*$/;
const LIST_ITEM_RE = /^(\s*)-\s/;

/**
 * Insert a positive list item for the prefix as the first item under
 * the `packages:` block. First position keeps it ahead of any
 * `!`-prefixed exclusions (pnpm unions all positive globs regardless of
 * order, but leading placement avoids reading as part of a negation
 * group).
 *
 * Returns the rewritten file, or `undefined` when no `packages:` block
 * exists (caller falls back to package.json).
 */
const insertYamlPattern = (content: string, entry: string): string | undefined => {
    // Preserve the file's existing line endings (a CRLF file on Windows
    // must not be silently rewritten as LF).
    const eol = content.includes("\r\n") ? "\r\n" : "\n";
    const lines = content.split(/\r?\n/);
    const headerIndex = lines.findIndex((line) => PACKAGES_HEADER_RE.test(line));

    if (headerIndex === -1) {
        return undefined;
    }

    // Match the indentation of the first existing list item so the
    // inserted line lines up with the block; default to two spaces.
    let indent = "  ";

    for (let index = headerIndex + 1; index < lines.length; index++) {
        const match = LIST_ITEM_RE.exec(lines[index] as string);

        if (match) {
            indent = match[1] as string;

            break;
        }

        // Stop scanning once the block ends (a non-empty, non-item line).
        if ((lines[index] as string).trim().length > 0) {
            break;
        }
    }

    lines.splice(headerIndex + 1, 0, `${indent}- "${entry}"`);

    return lines.join(eol);
};

const addToPackageJson = (workspaceRoot: string, entry: string, dryRun: boolean): boolean => {
    const packageJsonPath = join(workspaceRoot, "package.json");
    const packageJson = readJsonSync(packageJsonPath) as PackageJson;
    const { workspaces } = packageJson;

    if (Array.isArray(workspaces)) {
        if (workspaces.includes(entry)) {
            return false;
        }

        if (!dryRun) {
            writeJsonSync(packageJsonPath, { ...packageJson, workspaces: [...workspaces, entry] }, { detectIndent: true });
        }

        return true;
    }

    if (workspaces && typeof workspaces === "object" && Array.isArray(workspaces.packages)) {
        if (workspaces.packages.includes(entry)) {
            return false;
        }

        if (!dryRun) {
            writeJsonSync(
                packageJsonPath,
                { ...packageJson, workspaces: { ...workspaces, packages: [...workspaces.packages, entry] } },
                { detectIndent: true },
            );
        }

        return true;
    }

    return false;
};

export const ensureWorkspaceMembership = ({ dryRun = false, prefix, workspaceRoot }: EnsureWorkspaceMembershipInput): EnsureWorkspaceMembershipResult => {
    const entry = normalizeWorkspacePath(prefix);

    const patterns = readWorkspacePatterns(workspaceRoot);

    if (!patterns) {
        return { status: "no-config" };
    }

    // The imported package carries its own package.json, so it resolves
    // here iff an existing glob already covers it — the common case.
    const covered = resolveWorkspacePatterns(workspaceRoot, patterns).some((directory) => normalizeWorkspacePath(directory) === entry);

    if (covered) {
        return { status: "already-covered" };
    }

    // Prefer the YAML file (pnpm/aube precedence) when it carries the
    // `packages:` block; otherwise fall back to package.json#workspaces.
    for (const fileName of WORKSPACE_YAML_NAMES) {
        const yamlPath = join(workspaceRoot, fileName);

        if (!isAccessibleSync(yamlPath)) {
            continue;
        }

        const rewritten = insertYamlPattern(readFileSync(yamlPath), entry);

        if (rewritten === undefined) {
            continue;
        }

        if (!dryRun) {
            writeFileSync(yamlPath, rewritten);
        }

        return { entry, file: fileName, status: "added" };
    }

    if (addToPackageJson(workspaceRoot, entry, dryRun)) {
        return { entry, file: "package.json", status: "added" };
    }

    return { status: "no-config" };
};
