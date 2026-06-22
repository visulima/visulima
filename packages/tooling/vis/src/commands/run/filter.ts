import { relative } from "@visulima/path";
import type { ProjectGraph } from "@visulima/task-runner";
import { expandAffected, getChangedFiles } from "@visulima/task-runner";
import zeptomatch from "zeptomatch";

/*
 * A single parsed pnpm-style `--filter` selector.
 *
 * pnpm filter grammar (the subset vis maps onto its project set):
 *
 *   @org/web            → match a package by name
 * /*              → match packages by name glob
 *   ...&lt;pkg>            → &lt;pkg> + everything that depends on it (dependents)
 *   &lt;pkg>...            → &lt;pkg> + everything it depends on (dependencies)
 *   ...^&lt;pkg>           → only the dependents of &lt;pkg> (exclude self)
 *   &lt;pkg>^...           → only the dependencies of &lt;pkg> (exclude self)
 *   [&lt;ref>]             → packages changed since git &lt;ref> (e.g. [main])
 *   ...[&lt;ref>]          → changed-since &lt;ref> + their dependents
 *   ./packages/*        → match packages by path glob
 *   {packages/*}        → match packages by path glob (brace form)
 *
 * The graph (`...`) and changed-since (`[ref]`) modifiers compose: the
 * "leading"/"trailing" `...` apply to whatever the base pattern resolves
 * to, whether that's a name, a path, or a changed-since ref.
 */
export interface ParsedFilter {
    /**
     * Changed-since git ref extracted from `[&lt;ref>]`, or `undefined` when
     * the selector has no changed-since component. An empty string means
     * `[]` (compare against the configured default base).
     */
    changedSince: string | undefined;

    /**
     * When a graph modifier carries the `^` marker (`...^pkg` / `pkg^...`),
     * the base match itself is dropped and only the expanded
     * dependents/dependencies are kept.
     */
    excludeSelf: boolean;
    /** Include the dependencies (upstream) of the matched set. */
    includeDependencies: boolean;
    /** Include the dependents (downstream) of the matched set. */
    includeDependents: boolean;
    /** The base pattern is a path glob (`./...`, `{...}`) rather than a name. */
    isPath: boolean;

    /**
     * The base name/path pattern. Empty string when the selector is a bare
     * changed-since form (`[main]`, `...[main]`) with no name/path part.
     */
    pattern: string;
}

const isExplicitPathPattern = (value: string): boolean => value.startsWith("./") || value.startsWith("../") || value.startsWith("/") || value.startsWith("**");

/**
 * Parses a single pnpm-style filter selector into its structured form.
 *
 * The parser is intentionally tolerant: an empty or whitespace-only
 * selector yields `undefined` so callers can skip it. It does not throw
 * on unknown shapes — anything that isn't a graph/changed-since modifier
 * is treated as a literal name or path pattern.
 * @param selector Raw filter string, e.g. `...@org/web`, `[main]`, `./packages/*`.
 * @returns The parsed filter, or `undefined` when the selector is empty.
 */
export const parseFilter = (selector: string): ParsedFilter | undefined => {
    let rest = selector.trim();

    if (rest === "") {
        return undefined;
    }

    let includeDependents = false;
    let includeDependencies = false;
    let excludeSelf = false;

    // Leading graph modifier: `...pkg` (dependents) or `...^pkg`
    // (dependents only, exclude self). pnpm reads the leading `...` as
    // "include packages that depend on the matched set".
    if (rest.startsWith("...")) {
        includeDependents = true;
        rest = rest.slice(3);

        if (rest.startsWith("^")) {
            excludeSelf = true;
            rest = rest.slice(1);
        }
    }

    // Trailing graph modifier: `pkg...` (dependencies) or `pkg^...`
    // (dependencies only, exclude self).
    if (rest.endsWith("...")) {
        includeDependencies = true;
        rest = rest.slice(0, -3);

        if (rest.endsWith("^")) {
            excludeSelf = true;
            rest = rest.slice(0, -1);
        }
    }

    // Changed-since component: a trailing `[<ref>]`. pnpm only supports
    // this as a suffix (`pkg[ref]`, `...[ref]`, `[ref]`), so anchor it at
    // the end and keep whatever precedes it as the name/path pattern.
    let changedSince: string | undefined;
    const changedMatch = /\[([^\]]*)\]$/.exec(rest);

    if (changedMatch) {
        changedSince = changedMatch[1] ?? "";
        rest = rest.slice(0, changedMatch.index);
    }

    let pattern = rest.trim();
    let isPath = false;

    // Brace path form: `{packages/*}` → strip the braces and treat as a
    // path glob. pnpm uses braces to disambiguate a path from a name.
    if (pattern.startsWith("{") && pattern.endsWith("}") && pattern.length >= 2) {
        pattern = pattern.slice(1, -1);
        isPath = true;
    } else if (isExplicitPathPattern(pattern)) {
        isPath = true;
    }

    return {
        changedSince,
        excludeSelf,
        includeDependencies,
        includeDependents,
        isPath,
        pattern,
    };
};

/**
 * Normalizes a path glob so it matches project roots, which are stored
 * relative to the workspace root with POSIX separators. Strips a leading
 * `./` and any trailing `/` so `./packages/*` and `packages/*` behave the
 * same.
 */
const normalizePathPattern = (pattern: string): string => {
    let normalized = pattern.replaceAll("\\", "/");

    if (normalized.startsWith("./")) {
        normalized = normalized.slice(2);
    }

    if (normalized.length > 1 && normalized.endsWith("/")) {
        normalized = normalized.slice(0, -1);
    }

    return normalized;
};

/**
 * Inputs the project graph plus the metadata needed to resolve a filter's
 * base pattern (names, package names, paths) and its changed-since ref.
 */
export interface ApplyFiltersContext {
    /**
     * Resolves the changed-since ref `[&lt;ref>]` to a list of changed project
     * names. Defaults to a git-diff implementation that reuses the same
     * detection as `vis affected`. Injectable for tests.
     */
    changedProjectsForRef?: (reference: string) => Promise<string[]> | string[];
    /** Default base ref to use for a bare `[]` changed-since selector. */
    defaultBase?: string;
    /** Maps a project name to its `package.json#name` (for name-glob matching). */
    packageNameByProject?: Map<string, string | undefined>;
    /** The project dependency graph (nodes carry `data.root`). */
    projectGraph: ProjectGraph;
    /** Absolute workspace root, used for git-diff changed-since detection. */
    workspaceRoot?: string;
}

const matchName = (pattern: string, projectName: string, packageName: string | undefined): boolean => {
    if (pattern === "") {
        return false;
    }

    if (zeptomatch(pattern, projectName)) {
        return true;
    }

    return packageName !== undefined && zeptomatch(pattern, packageName);
};

const matchPath = (pattern: string, root: string | undefined): boolean => {
    if (root === undefined || root === "") {
        return false;
    }

    const normalizedPattern = normalizePathPattern(pattern);
    const normalizedRoot = normalizePathPattern(root);

    return zeptomatch(normalizedPattern, normalizedRoot);
};

const expandWithGraph = (base: Set<string>, filter: ParsedFilter, projectGraph: ProjectGraph): Set<string> => {
    // pnpm's `...` is transitive ("deep"), so reuse task-runner's BFS
    // expander — the same code `vis affected` uses — with downstream
    // (dependents) / upstream (dependencies) toggled by the modifier.
    const { affected, downstream, upstream } = expandAffected(base, projectGraph, {
        downstream: filter.includeDependents ? "deep" : "none",
        upstream: filter.includeDependencies ? "deep" : "none",
    });

    if (!filter.excludeSelf) {
        return affected;
    }

    // `...^pkg` / `pkg^...` keep only the expanded set, dropping the base
    // matches themselves.
    const result = new Set<string>([...downstream, ...upstream]);

    for (const name of base) {
        result.delete(name);
    }

    return result;
};

/**
 * Resolves a single parsed filter to a set of project names against the
 * supplied graph + context.
 */
const resolveFilter = async (filter: ParsedFilter, context: ApplyFiltersContext): Promise<Set<string>> => {
    const { packageNameByProject, projectGraph } = context;
    const allNames = Object.keys(projectGraph.nodes);

    let base = new Set<string>();

    // Base pattern (name or path). An empty pattern means the selector is
    // a pure changed-since form, in which case the changed projects below
    // become the base set instead.
    if (filter.pattern !== "") {
        for (const name of allNames) {
            if (filter.isPath) {
                if (matchPath(filter.pattern, projectGraph.nodes[name]?.data.root)) {
                    base.add(name);
                }
            } else if (matchName(filter.pattern, name, packageNameByProject?.get(name))) {
                base.add(name);
            }
        }
    }

    // Changed-since intersect / seed. With a base pattern present, pnpm
    // intersects (`pkg[ref]` = pkg AND changed). Without one, the changed
    // set *is* the base.
    if (filter.changedSince !== undefined) {
        const reference = filter.changedSince === "" ? (context.defaultBase ?? "main") : filter.changedSince;
        const detector = context.changedProjectsForRef ?? defaultChangedProjectsForRef(context);
        const changed = new Set(await detector(reference));

        base = filter.pattern === "" ? changed : new Set([...base].filter((name) => changed.has(name)));
    }

    if (!filter.includeDependents && !filter.includeDependencies) {
        return base;
    }

    return expandWithGraph(base, filter, projectGraph);
};

/**
 * Default changed-since resolver: runs a git diff between `&lt;ref>` and
 * `HEAD` (reusing task-runner's `getChangedFiles`, the same detection as
 * `vis affected`) and maps changed files to project names by root prefix.
 */
const defaultChangedProjectsForRef
    = (context: ApplyFiltersContext) =>
        async (reference: string): Promise<string[]> => {
            const { projectGraph, workspaceRoot } = context;

            if (!workspaceRoot) {
                return [];
            }

            let changedFiles: string[];

            try {
                changedFiles = await getChangedFiles(workspaceRoot, reference, "HEAD");
            } catch (error) {
            // getChangedFiles validates the ref and shells out to git; surface a
            // friendly message for a bad `--filter "[ref]"` instead of a raw error.
                const detail = error instanceof Error ? error.message : String(error);

                throw new Error(`vis run --filter: invalid changed-since ref "${reference}" (${detail})`, { cause: error });
            }

            const matched = new Set<string>();

            for (const [name, node] of Object.entries(projectGraph.nodes)) {
                const root = normalizePathPattern(node.data.root ?? name);

                if (root === "" || root === ".") {
                    continue;
                }

                for (const file of changedFiles) {
                    const relativeFile = relative(workspaceRoot, file).replaceAll("\\", "/");

                    if (relativeFile === root || relativeFile.startsWith(`${root}/`)) {
                        matched.add(name);

                        break;
                    }
                }
            }

            return [...matched];
        };

/**
 * Applies a list of pnpm-style filters to the workspace, returning the
 * union of every filter's resolved project set. Filters are additive
 * (OR), matching pnpm's behaviour when multiple `--filter` flags are
 * passed.
 * @param filters Parsed filters (skip `undefined` entries before calling, or pass raw strings via {@link applyFilterStrings}).
 * @param context Graph + metadata needed to resolve names, paths and changed-since refs.
 * @returns The union of project names selected by all filters.
 */
export const applyFilters = async (filters: ReadonlyArray<ParsedFilter>, context: ApplyFiltersContext): Promise<string[]> => {
    const selected = new Set<string>();

    for (const filter of filters) {
        for (const name of await resolveFilter(filter, context)) {
            selected.add(name);
        }
    }

    return [...selected];
};

/**
 * Convenience wrapper: parses raw `--filter` strings and applies them.
 * Empty/whitespace-only selectors are skipped.
 * @param selectors Raw filter strings.
 * @param context Graph + metadata.
 * @returns The union of project names selected by all filters.
 */
export const applyFilterStrings = async (selectors: ReadonlyArray<string>, context: ApplyFiltersContext): Promise<string[]> => {
    const parsed: ParsedFilter[] = [];

    for (const selector of selectors) {
        const filter = parseFilter(selector);

        if (filter) {
            parsed.push(filter);
        }
    }

    return applyFilters(parsed, context);
};
