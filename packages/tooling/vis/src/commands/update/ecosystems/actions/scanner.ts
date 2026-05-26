import { isAccessibleSync, readFileSync, walkSync } from "@visulima/fs";
import { join } from "@visulima/path";

/**
 * A single `uses:` reference picked out of a workflow / composite action.
 * We preserve the raw line + token positions so the applier can do an
 * exact-string rewrite without re-serialising the YAML (which would
 * destroy comments, anchors, and quoting style).
 */
export interface UsesReference {
    /** Owner/repo (e.g. `actions/checkout`) or full path (`org/repo/path/to/action`). */
    readonly slug: string;
    /** Sub-path of a composite action inside the repo, or `undefined` for repo-root actions. */
    readonly subpath: string | undefined;
    /** The ref string after `@` — tag, branch, or SHA. */
    readonly ref: string;
    /** Owner segment (`actions` in `actions/checkout`). */
    readonly owner: string;
    /** Repo segment (`checkout`). */
    readonly repo: string;
    /** Absolute path of the file that contains the reference. */
    readonly file: string;
    /** 1-based line number. */
    readonly line: number;
    /** Exact original token as it appeared after `uses:`, sans surrounding whitespace/quotes. */
    readonly original: string;
    /** Whether the existing ref is already a 40-char hex SHA. */
    readonly isSha: boolean;
    /** Inline comment trailing the `uses:` line (e.g. `# v3.5.3`). Used to preserve the version hint when re-pinning. */
    readonly trailingComment: string | undefined;
    /** When set, the actions-up-style ignore comment that excludes this line. */
    readonly ignoreReason: string | undefined;
}

const WORKFLOWS_GLOB_DIR = ".github/workflows";
const COMPOSITE_GLOB_DIR = ".github/actions";

/**
 * Regex that matches `uses: <slug>@<ref>` in a YAML line. Tolerates:
 *   - leading hyphen for list entries
 *   - quoted or bare values
 *   - trailing comments after the ref
 *
 * We deliberately exclude `./local-action` and `docker://image` forms
 * here: local references can't be "updated" (they're in-tree), and the
 * docker form is handled by the docker scanner via the action.yml's
 * `runs.image` field, not by `uses:`.
 */
const USES_LINE_RE = /^(\s*-?\s*uses:\s*)(['"]?)([^'"\s#]+)\2(\s*#\s*(.+))?\s*$/;

const SHA_RE = /^[a-f0-9]{40}$/i;

const IGNORE_NEXT_RE = /actions-up-ignore-next-line(?::\s*(.+))?/i;
const IGNORE_INLINE_RE = /actions-up-ignore(?::\s*(.+))?/i;
const IGNORE_BLOCK_START_RE = /actions-up-ignore-start/i;
const IGNORE_BLOCK_END_RE = /actions-up-ignore-end/i;

const splitSlug = (slug: string): { owner: string; repo: string; subpath: string | undefined } | undefined => {
    const parts = slug.split("/");

    if (parts.length < 2) {
        return undefined;
    }

    const [owner, repo, ...rest] = parts;

    if (!owner || !repo) {
        return undefined;
    }

    return {
        owner,
        repo,
        subpath: rest.length > 0 ? rest.join("/") : undefined,
    };
};

/**
 * Strip surrounding single/double quotes from a YAML scalar. We accept
 * both styles up-front but the applier mirrors whatever the user wrote.
 */
const stripQuotes = (raw: string): string => {
    if (raw.length >= 2 && (raw[0] === "'" || raw[0] === "\"") && raw[raw.length - 1] === raw[0]) {
        return raw.slice(1, -1);
    }

    return raw;
};

/**
 * Walks the supplied file content line-by-line and emits one
 * `UsesReference` per `uses:` line. The line-based approach is
 * intentional: YAML parsers strip comments, but we need
 * `# actions-up-ignore` directives to survive into the reference list.
 */
export const extractUsesFromContent = (filePath: string, content: string): UsesReference[] => {
    const lines = content.split(/\r?\n/);
    const references: UsesReference[] = [];

    let pendingIgnoreReason: string | undefined;
    let blockIgnore = false;

    for (let index = 0; index < lines.length; index++) {
        const line = lines[index] ?? "";

        // Block-level ignore directives. `start` and `end` switch a flag
        // that applies to every line between them — including the start
        // line itself, so a directive next to a `uses:` line on the same
        // line still works.
        if (IGNORE_BLOCK_START_RE.test(line)) {
            blockIgnore = true;
        }

        if (IGNORE_BLOCK_END_RE.test(line)) {
            blockIgnore = false;
            // The end marker line itself shouldn't carry an ignore.
            continue;
        }

        // Lookahead form: `# actions-up-ignore-next-line` on the previous line.
        const ignoreNextMatch = IGNORE_NEXT_RE.exec(line);

        if (ignoreNextMatch) {
            pendingIgnoreReason = ignoreNextMatch[1] ?? "actions-up-ignore-next-line";
            continue;
        }

        const match = USES_LINE_RE.exec(line);

        if (!match) {
            // Reset the pending lookahead — a comment that didn't precede
            // a `uses:` line shouldn't leak across the file.
            pendingIgnoreReason = undefined;

            continue;
        }

        const value = stripQuotes(match[3] ?? "");
        const trailingComment = match[5]?.trim();

        // Local actions and docker:// urls are out of scope.
        if (value.startsWith("./") || value.startsWith("../") || value.startsWith("docker://")) {
            pendingIgnoreReason = undefined;

            continue;
        }

        const atIndex = value.lastIndexOf("@");

        if (atIndex <= 0) {
            // Reusable workflow without a ref (rare, e.g. `uses: org/repo/.github/workflows/x.yml`)
            // — skip rather than fail.
            pendingIgnoreReason = undefined;

            continue;
        }

        const slug = value.slice(0, atIndex);
        const ref = value.slice(atIndex + 1);
        const parts = splitSlug(slug);

        if (!parts) {
            pendingIgnoreReason = undefined;

            continue;
        }

        let ignoreReason = pendingIgnoreReason ?? (blockIgnore ? "actions-up-ignore-block" : undefined);
        const inlineMatch = trailingComment ? IGNORE_INLINE_RE.exec(trailingComment) : undefined;
        // Only treat the inline directive as an ignore when it appears as
        // a standalone token — a trailing `# v3.1.0` mustn't be parsed as
        // an ignore even though `IGNORE_INLINE_RE` is permissive.
        // We require the directive to start the trailing comment.
        if (
            inlineMatch
            && trailingComment
            && /^actions-up-ignore(?::|\s|$)/i.test(trailingComment)
        ) {
            ignoreReason = ignoreReason ?? (inlineMatch[1] ?? "actions-up-ignore");
        }

        pendingIgnoreReason = undefined;

        references.push({
            file: filePath,
            ignoreReason,
            isSha: SHA_RE.test(ref),
            line: index + 1,
            original: value,
            owner: parts.owner,
            ref,
            repo: parts.repo,
            slug,
            subpath: parts.subpath,
            // The `version-hint` comment (`# v3.5.3`) survives as the
            // version label when the ref itself is a SHA. The applier
            // also writes this comment back when re-pinning to a SHA.
            trailingComment: trailingComment && !ignoreReason ? trailingComment : undefined,
        });
    }

    return references;
};

const isWorkflowFile = (name: string): boolean => name.endsWith(".yml") || name.endsWith(".yaml");

/**
 * Walks the workspace looking for action references:
 *   - `.github/workflows/*.yml` (and .yaml)
 *   - `.github/actions/*/action.yml` (and .yaml)
 *   - Root `action.yml` / `action.yaml` (the action repo itself)
 *
 * `extraDirs` can be passed to scan additional directories, mirroring
 * actions-up's `--dir` flag.
 */
export const scanActionsRepository = (workspaceRoot: string, extraDirs: string[] = []): UsesReference[] => {
    const references: UsesReference[] = [];
    const visitedFiles = new Set<string>();

    const collectFile = (absolutePath: string): void => {
        if (visitedFiles.has(absolutePath)) {
            return;
        }

        visitedFiles.add(absolutePath);

        let content: string;

        try {
            content = readFileSync(absolutePath);
        } catch {
            return;
        }

        const found = extractUsesFromContent(absolutePath, content);

        references.push(...found);
    };

    // .github/workflows/*.yml — flat directory, not recursive.
    const workflowsDirectory = join(workspaceRoot, WORKFLOWS_GLOB_DIR);

    if (isAccessibleSync(workflowsDirectory)) {
        for (const entry of walkSync(workflowsDirectory, { includeDirs: false, includeSymlinks: false, maxDepth: 1 })) {
            if (isWorkflowFile(entry.name)) {
                collectFile(entry.path);
            }
        }
    }

    // .github/actions/<name>/action.yml — one level of subdirs.
    const compositeDirectory = join(workspaceRoot, COMPOSITE_GLOB_DIR);

    if (isAccessibleSync(compositeDirectory)) {
        for (const entry of walkSync(compositeDirectory, { includeDirs: false, includeSymlinks: false, maxDepth: 3 })) {
            if (entry.name === "action.yml" || entry.name === "action.yaml") {
                collectFile(entry.path);
            }
        }
    }

    // Root action.yml — the repo itself is an action.
    for (const candidate of ["action.yml", "action.yaml"]) {
        const path = join(workspaceRoot, candidate);

        if (isAccessibleSync(path)) {
            collectFile(path);
        }
    }

    for (const directory of extraDirs) {
        const absolute = directory.startsWith("/") ? directory : join(workspaceRoot, directory);

        if (!isAccessibleSync(absolute)) {
            continue;
        }

        for (const entry of walkSync(absolute, { includeDirs: false, includeSymlinks: false })) {
            if (isWorkflowFile(entry.name)) {
                collectFile(entry.path);
            }
        }
    }

    return references;
};
