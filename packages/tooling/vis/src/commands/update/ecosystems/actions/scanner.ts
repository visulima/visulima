import { isAccessibleSync, readFileSync, walkSync } from "@visulima/fs";
import { isAbsolute, join } from "@visulima/path";

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
    /** Quote character the original value was wrapped in, or `""` when unquoted. The applier re-emits the new value inside the same quote style so trailing `# vN.M.P` hints don't end up *inside* the YAML string. */
    readonly quote: "" | "'" | "\"";
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
        // The directive must live on a line by itself; when it appears as a
        // trailing comment on a `uses:` line we treat it as the inline
        // (this-line) ignore form below — otherwise the line that follows
        // silently inherits an ignore the user never asked for.
        const trimmedLine = line.trim();
        const isCommentOnly = trimmedLine === "" || trimmedLine.startsWith("#");
        const ignoreNextMatch = isCommentOnly ? IGNORE_NEXT_RE.exec(line) : undefined;

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

        // match[2] is the original quote character (`'`, `"`, or empty);
        // match[3] is the already-unquoted value. We capture the quote
        // separately so the applier can re-emit the same quoting style
        // and the trailing `# vN.M.P` hint never lands *inside* the YAML
        // string.
        const rawQuote = match[2] ?? "";
        const quote: "" | "'" | "\"" = rawQuote === "'" || rawQuote === "\"" ? rawQuote : "";
        const value = match[3] ?? "";
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
        // Only treat the inline directive as an ignore when it appears as
        // a standalone token starting the trailing comment — a trailing
        // `# v3.1.0` mustn't be parsed as an ignore. Both
        // `actions-up-ignore` and `actions-up-ignore-next-line` on the
        // same line as `uses:` are treated as inline ignores (matching
        // how `eslint-disable-next-line` applies to the line it sits on).
        if (trailingComment) {
            const startInline = /^actions-up-ignore(?:-next-line)?(?::\s*(.+))?(?:\s|$)/i.exec(trailingComment);

            if (startInline) {
                ignoreReason = ignoreReason ?? (startInline[1] ?? "actions-up-ignore");
            }
        }

        pendingIgnoreReason = undefined;

        references.push({
            file: filePath,
            ignoreReason,
            isSha: SHA_RE.test(ref),
            line: index + 1,
            // `original` includes the surrounding quotes when present, so the
            // applier's `line.indexOf(original)` lands on the whole token
            // (including the closing quote) and the replacement re-supplies
            // both quotes — keeping any trailing `# vN.M.P` outside the YAML
            // string literal.
            original: `${quote}${value}${quote}`,
            owner: parts.owner,
            quote,
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
 *   - .github/workflows/<file>.yml (and .yaml)
 *   - .github/actions/<name>/action.yml (and .yaml)
 *   - Root action.yml / action.yaml (the action repo itself)
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
        const absolute = isAbsolute(directory) ? directory : join(workspaceRoot, directory);

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
