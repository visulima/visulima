import { relative } from "@visulima/path";
import type { WorkspaceConfiguration } from "@visulima/task-runner";

import type { VisProjectConfiguration } from "./workspace";

/**
 * Parsed form of a target selector.
 *
 * vis accepts moon-style target syntax alongside the simple `<target>`
 * and `--projects` form:
 *
 *   :build              → run `build` on every project
 *   ~:build             → run `build` on the project closest to cwd
 *   #frontend:build     → run `build` on every project tagged `frontend`
 *   my-pkg:build        → run `build` on the single project `my-pkg`
 *   build               → run `build` on every project (legacy form)
 */
export interface ParsedSelector {
    /** Projects the selector resolves to (before further filtering). */
    projects?: string[];
    /** Selector kind — used by commands for richer diagnostics. */
    kind: "all" | "closest" | "project" | "tag";
    /** The tag, when `kind === "tag"`. */
    tag?: string;
    /** The target name. */
    target: string;
}

const TAG_PROJECT_RE = /^#([a-zA-Z0-9_\-/]+):(.+)$/;
const NAMED_PROJECT_RE = /^([@a-zA-Z0-9_\-/]+):(.+)$/;

/**
 * Parses a target selector string. Returns `undefined` if the input
 * doesn't match any of the recognised forms.
 */
export const parseTargetSelector = (input: string): Omit<ParsedSelector, "projects"> | undefined => {
    if (input === "") {
        return undefined;
    }

    // `:target` — all projects
    if (input.startsWith(":")) {
        return { kind: "all", target: input.slice(1) };
    }

    // `~:target` — closest project to cwd
    if (input.startsWith("~:")) {
        return { kind: "closest", target: input.slice(2) };
    }

    // `#tag:target`
    const tagMatch = TAG_PROJECT_RE.exec(input);

    if (tagMatch && tagMatch[1] && tagMatch[2]) {
        return { kind: "tag", tag: tagMatch[1], target: tagMatch[2] };
    }

    // `project:target` — scoped to a single project
    const projectMatch = NAMED_PROJECT_RE.exec(input);

    if (projectMatch && projectMatch[1] && projectMatch[2]) {
        // Heuristic: if the prefix starts with "@" or contains "/" or "-",
        // treat it as a project name, not a bare target.
        if (projectMatch[1].startsWith("@") || projectMatch[1].includes("/") || projectMatch[1].includes("-")) {
            return { kind: "project", projects: [projectMatch[1]], target: projectMatch[2] } as Omit<ParsedSelector, "projects"> & { projects: string[] };
        }
    }

    // Bare `target` name — legacy form, same as `:target`.
    return { kind: "all", target: input };
};

/**
 * Resolves a parsed selector against a workspace. Returns the list of
 * candidate project names plus the target name.
 */
export const resolveSelector = (
    input: string,
    workspace: WorkspaceConfiguration,
    cwd: string,
    workspaceRoot: string,
): { projects: string[]; target: string } => {
    const parsed = parseTargetSelector(input);

    if (!parsed) {
        throw new Error(`Invalid target selector: "${input}"`);
    }

    const allProjects = Object.keys(workspace.projects);

    if (parsed.kind === "all") {
        return { projects: allProjects, target: parsed.target };
    }

    if (parsed.kind === "project") {
        // Reuse the parsed project list.
        const projects = (parsed as ParsedSelector).projects ?? [];

        return { projects, target: parsed.target };
    }

    if (parsed.kind === "tag") {
        const tag = parsed.tag!;
        const matched = allProjects.filter((name) => {
            const project = workspace.projects[name] as VisProjectConfiguration | undefined;

            return project?.tags?.includes(tag) ?? false;
        });

        return { projects: matched, target: parsed.target };
    }

    // closest — walk up from cwd and find the project whose root is
    // the deepest ancestor of cwd.
    const relCwd = relative(workspaceRoot, cwd) || ".";
    let bestProject: string | undefined;
    let bestRootLength = -1;

    for (const [name, project] of Object.entries(workspace.projects)) {
        const projectRoot = (project as VisProjectConfiguration).root;

        if (!projectRoot) {
            continue;
        }

        // Match both `projectRoot` itself and `projectRoot/...`.
        const isMatch = relCwd === projectRoot || relCwd.startsWith(`${projectRoot}/`);

        if (isMatch && projectRoot.length > bestRootLength) {
            bestRootLength = projectRoot.length;
            bestProject = name;
        }
    }

    if (!bestProject) {
        throw new Error(`No project found at or above ${relCwd} for selector "${input}".`);
    }

    return { projects: [bestProject], target: parsed.target };
};

// ── Query language ──────────────────────────────────────────────────

/**
 * A single parsed query clause. e.g. `language=typescript` or
 * `tag!=deprecated`.
 */
interface QueryClause {
    field: string;
    op: "!=" | "=";
    value: string;
}

/**
 * Parsed query — a list of clauses combined with either AND or OR.
 * Groups are not supported; all clauses are combined with the same
 * top-level operator.
 */
interface ParsedQuery {
    clauses: QueryClause[];
    op: "&&" | "||";
}

const QUERY_CLAUSE_RE = /^(\w+)\s*(!?=)\s*(.+)$/;

/**
 * Parses a query string like `language=typescript && tag=lib`. Very
 * small grammar: a sequence of `field=value` / `field!=value` clauses
 * joined by `&&` or `||`. Only one operator allowed per query.
 */
export const parseQuery = (input: string): ParsedQuery | undefined => {
    const trimmed = input.trim();

    if (trimmed === "") {
        return undefined;
    }

    const andParts = trimmed.split("&&").map((part) => part.trim());
    const orParts = trimmed.split("||").map((part) => part.trim());

    const usingAnd = andParts.length > 1;
    const usingOr = orParts.length > 1;

    if (usingAnd && usingOr) {
        throw new Error("Query language does not support mixed && / || — split into multiple --query flags or simplify.");
    }

    const parts = usingOr ? orParts : andParts;
    const op: "&&" | "||" = usingOr ? "||" : "&&";

    const clauses: QueryClause[] = [];

    for (const part of parts) {
        const match = QUERY_CLAUSE_RE.exec(part);

        if (!match) {
            throw new Error(`Invalid query clause: "${part}". Expected <field>=<value> or <field>!=<value>.`);
        }

        const [, field, rawOp, rawValue] = match;

        clauses.push({
            field: field!,
            op: rawOp === "!=" ? "!=" : "=",
            value: rawValue!.trim().replace(/^["']|["']$/g, ""),
        });
    }

    return { clauses, op };
};

/**
 * Evaluates a single clause against a project configuration. Supports
 * the following fields (matching moon's where possible):
 *
 * - `project` / `id`: project name
 * - `tag` / `tags`: matches if the tag is in the project's tag list
 * - `type` / `projectType`
 * - `language`
 * - `stack`
 * - `layer`
 */
const matchClause = (clause: QueryClause, name: string, project: VisProjectConfiguration): boolean => {
    const { field, op, value } = clause;

    const test = (actual: string | undefined): boolean => {
        const matched = actual === value;

        return op === "=" ? matched : !matched;
    };

    const testList = (actuals: string[] | undefined): boolean => {
        const list = actuals ?? [];
        const matched = list.includes(value);

        return op === "=" ? matched : !matched;
    };

    switch (field) {
        case "project":
        case "id":
            return test(name);
        case "tag":
        case "tags":
            return testList(project.tags);
        case "type":
        case "projectType":
            return test(project.projectType);
        case "language":
            return test(project.language);
        case "stack":
            return test(project.stack);
        case "layer":
            return test(project.layer);
        default:
            // Unknown field — treat as non-match so we don't crash.
            return false;
    }
};

/**
 * Filters a list of project names by a query string. Returns all inputs
 * unchanged when `query` is undefined or empty.
 */
export const filterProjectsByQuery = (
    projectNames: string[],
    workspace: WorkspaceConfiguration,
    query: string | undefined,
): string[] => {
    if (!query || query.trim() === "") {
        return projectNames;
    }

    const parsed = parseQuery(query);

    if (!parsed) {
        return projectNames;
    }

    return projectNames.filter((name) => {
        const project = workspace.projects[name] as VisProjectConfiguration | undefined;

        if (!project) {
            return false;
        }

        if (parsed.op === "&&") {
            return parsed.clauses.every((clause) => matchClause(clause, name, project));
        }

        return parsed.clauses.some((clause) => matchClause(clause, name, project));
    });
};
