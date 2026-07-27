import { spawnSync } from "node:child_process";

import type { AffectedResult, AffectedScope, ProjectConfiguration, ProjectGraph } from "@visulima/task-runner";
import { getAffectedProjects } from "@visulima/task-runner";
import isInCi from "is-in-ci";

import { VisUserError } from "../errors/vis-user-error";
import { resolveAffectedShas } from "../runtime/affected-shas";

const VALID_SCOPES = new Set<string>(["deep", "direct", "none"]);

/**
 * The `--affected` knobs, shared verbatim by `vis affected` and
 * `vis run --affected` so the two entry points can never drift.
 */
export interface AffectedSelectionOptions {
    /** Git base ref. Auto-resolved from CI/git when omitted. */
    base?: string;

    /** How far to follow dependents of changed projects. Default `"deep"`. */
    downstream?: string;

    /** Git head ref. Auto-resolved from CI/git when omitted. */
    head?: string;

    /**
     * Whether to fold uncommitted working-tree changes into the changed-file
     * set. `undefined` means "auto": on for local runs, off in CI.
     */
    uncommitted?: boolean;

    /** How far to follow dependencies of changed projects. Default `"none"`. */
    upstream?: string;
}

export interface SelectAffectedInput {
    /** Default base branch from `vis.config.ts#defaultBase`. */
    defaultBase?: string;

    /** Injectable for tests; defaults to a real `git` invocation. */
    readWorkingTreeChanges?: (workspaceRoot: string) => string[];

    /** Injectable for tests; defaults to `is-in-ci`. */
    runningInCi?: boolean;
}

export interface SelectAffectedResult extends AffectedResult {
    /** Human-readable provenance lines describing how base/head were picked. */
    notes: string[];

    /** Number of changed files contributed by the uncommitted working tree. */
    uncommittedFileCount: number;
}

/**
 * Parse `git status --porcelain -z` into a list of workspace-relative paths.
 *
 * NUL-delimited output is used rather than the newline form because the
 * latter shell-quotes paths containing spaces or non-ASCII bytes, which
 * would then not match any project root. Rename/copy entries carry a second
 * NUL-terminated field holding the *original* path; both sides are returned
 * since a rename changes two projects.
 */
export const parsePorcelainStatus = (raw: string): string[] => {
    const files: string[] = [];
    const fields = raw.split("\0");

    for (let index = 0; index < fields.length; index++) {
        const entry = fields[index];

        // Trailing NUL yields a final empty field.
        if (!entry) {
            continue;
        }

        // Each entry is "XY <path>": two status columns, a space, then the
        // path. Anything shorter is not a status line we understand.
        if (entry.length < 4) {
            continue;
        }

        const status = entry.slice(0, 2);
        const path = entry.slice(3);

        if (path) {
            files.push(path);
        }

        // Renames and copies append the source path as its own field.
        if (status.includes("R") || status.includes("C")) {
            index += 1;

            const source = fields[index];

            if (source) {
                files.push(source);
            }
        }
    }

    return files;
};

const defaultReadWorkingTreeChanges = (workspaceRoot: string): string[] => {
    // `--porcelain` paths are repository-root relative, matching the
    // `git diff --name-only` output that task-runner maps to projects.
    const result = spawnSync("git", ["status", "--porcelain", "-z"], { cwd: workspaceRoot, encoding: "utf8" });

    if (result.error || result.status !== 0 || typeof result.stdout !== "string") {
        return [];
    }

    return parsePorcelainStatus(result.stdout);
};

/**
 * Resolve which projects are affected, applying the same base/head
 * resolution, scope validation and working-tree handling regardless of
 * whether the caller was `vis affected` or `vis run --affected`.
 *
 * Throws on an invalid `--downstream`/`--upstream` value.
 */
export const selectAffectedProjects = async (
    options: AffectedSelectionOptions,
    workspace: { projectGraph: ProjectGraph; projects: Record<string, ProjectConfiguration>; workspaceRoot: string },
    input: SelectAffectedInput = {},
): Promise<SelectAffectedResult> => {
    const downstreamValue = options.downstream ?? "deep";
    const upstreamValue = options.upstream ?? "none";

    if (!VALID_SCOPES.has(downstreamValue)) {
        throw new VisUserError(`Invalid --downstream value: "${downstreamValue}". Must be "none", "direct", or "deep".`);
    }

    if (!VALID_SCOPES.has(upstreamValue)) {
        throw new VisUserError(`Invalid --upstream value: "${upstreamValue}". Must be "none", "direct", or "deep".`);
    }

    const { projectGraph, projects, workspaceRoot } = workspace;
    const notes: string[] = [];

    let { base } = options;
    let { head } = options;

    if (!base || !head) {
        const resolved = resolveAffectedShas({ defaultBase: input.defaultBase, workspaceRoot });

        // `||`, not `??` — the guard above treats an empty string as "not
        // supplied", so `--base=` must fall back too. With `??` it would
        // survive as "" and reach git as an empty ref.
        base = base || resolved.base;
        head = head || resolved.head;

        notes.push(`Resolved affected refs from ${resolved.provider} (${resolved.notes.join("; ")})`);
    }

    // A ref-to-ref diff cannot see the working tree, so locally `--affected`
    // would answer "nothing changed" for the exact edits the user is asking
    // about. Fold in `git status` unless the head was pinned to something
    // other than the working tree, or we are in CI where the checkout is the
    // whole truth.
    const inCi = input.runningInCi ?? isInCi;
    const headIsWorkingTree = head === "HEAD" || head === "";
    const includeUncommitted = options.uncommitted ?? (!inCi && headIsWorkingTree);

    let additionalChangedFiles: string[] = [];

    if (includeUncommitted) {
        if (headIsWorkingTree) {
            const readWorkingTree = input.readWorkingTreeChanges ?? defaultReadWorkingTreeChanges;

            additionalChangedFiles = readWorkingTree(workspaceRoot);

            if (additionalChangedFiles.length > 0) {
                notes.push(`including ${additionalChangedFiles.length} uncommitted working-tree file(s)`);
            }
        } else {
            // An explicit --head names a commit, so "uncommitted relative to
            // it" is not a meaningful set. Say so rather than silently
            // ignoring the flag.
            notes.push(`ignoring --uncommitted: --head=${head} pins the comparison to a commit, not the working tree`);
        }
    }

    const result = await getAffectedProjects({
        additionalChangedFiles,
        base,
        downstream: downstreamValue as AffectedScope,
        head,
        projectGraph,
        projects,
        upstream: upstreamValue as AffectedScope,
        workspaceRoot,
    });

    return { ...result, notes, uncommittedFileCount: additionalChangedFiles.length };
};
