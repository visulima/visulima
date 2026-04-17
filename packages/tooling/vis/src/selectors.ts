import { relative } from "@visulima/path";
import type { WorkspaceConfiguration } from "@visulima/task-runner";

import type { VisProjectConfiguration } from "./workspace";

/**
 * Parsed form of a target selector.
 *
 * vis accepts moon-style target syntax alongside the simple `&lt;target>`
 * and `--projects` form:
 *
 *   :build              → run `build` on every project
 *   ~:build             → run `build` on the project closest to cwd
 *   #frontend:build     → run `build` on every project tagged `frontend`
 *   my-pkg:build        → run `build` on the single project `my-pkg`
 *   build               → run `build` on every project (legacy form)
 */
export interface ParsedSelector {
    /** Selector kind — used by commands for richer diagnostics. */
    kind: "all" | "closest" | "project" | "tag";
    /** Projects the selector resolves to (before further filtering). */
    projects?: string[];
    /** The tag, when `kind === "tag"`. */
    tag?: string;
    /** The target name. */
    target: string;
}

const TAG_PROJECT_RE = /^#([\w\-/]+):(.+)$/;
const NAMED_PROJECT_RE = /^([@\w\-/]+):(.+)$/;

/**
 * Parses a target selector string into its component parts.
 * @param input Raw selector string (e.g. `:build`, `~:test`, `#tag:lint`, `pkg:build`, or bare `build`).
 * @returns The parsed selector, or `undefined` if `input` is empty.
 */
export const parseTargetSelector = (input: string): Omit<ParsedSelector, "projects"> | undefined => {
    if (input === "") {
        return undefined;
    }

    if (input.startsWith(":")) {
        return { kind: "all", target: input.slice(1) };
    }

    if (input.startsWith("~:")) {
        return { kind: "closest", target: input.slice(2) };
    }

    const tagMatch = TAG_PROJECT_RE.exec(input);

    if (tagMatch?.[1] && tagMatch[2]) {
        return { kind: "tag", tag: tagMatch[1], target: tagMatch[2] };
    }

    const projectMatch = NAMED_PROJECT_RE.exec(input);

    if (
        projectMatch?.[1]
        && projectMatch[2] // Distinguish `pkg-name:target` from a bare `target` that happens to contain `:`.
        && (projectMatch[1].startsWith("@") || projectMatch[1].includes("/") || projectMatch[1].includes("-"))
    ) {
        return { kind: "project", projects: [projectMatch[1]], target: projectMatch[2] } as Omit<ParsedSelector, "projects"> & { projects: string[] };
    }

    return { kind: "all", target: input };
};

/**
 * Resolves a selector string against a workspace to produce a concrete
 * list of project names and the target to run.
 * @param input Raw selector string.
 * @param workspace The discovered workspace configuration.
 * @param cwd Current working directory (used for `~:` closest resolution).
 * @param workspaceRoot Absolute path to the workspace root.
 * @returns An object with `projects` (candidate names) and `target`.
 * @throws If the selector is invalid or `~:` finds no matching project.
 */
export const resolveSelector = async (
    input: string,
    workspace: WorkspaceConfiguration,
    cwd: string,
    workspaceRoot: string,
): Promise<{ projects: string[]; target: string }> => {
    const parsed = parseTargetSelector(input);

    if (!parsed) {
        throw new Error(`Invalid target selector: "${input}"`);
    }

    const allProjects = Object.keys(workspace.projects);

    if (parsed.kind === "all") {
        return { projects: allProjects, target: parsed.target };
    }

    if (parsed.kind === "project") {
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

    const relCwd = relative(workspaceRoot, cwd) || ".";
    let bestProject: string | undefined;
    let bestRootLength = -1;

    for (const [name, project] of Object.entries(workspace.projects)) {
        const projectRoot = (project as VisProjectConfiguration).root;

        if (!projectRoot) {
            continue;
        }

        const isMatch = relCwd === projectRoot || relCwd.startsWith(`${projectRoot}/`);

        if (isMatch && projectRoot.length > bestRootLength) {
            bestRootLength = projectRoot.length;
            bestProject = name;
        }
    }

    if (!bestProject) {
        if (process.stdout.isTTY) {
            const { createInterface } = await import("node:readline");
            const rl = createInterface({ input: process.stdin, output: process.stderr });
            const allNames = Object.keys(workspace.projects).sort();

            process.stderr.write(`No project found at ${relCwd}. Pick one:\n`);

            for (const [i, allName] of allNames.entries()) {
                process.stderr.write(`  ${String(i + 1)}) ${allName}\n`);
            }

            const answer = await new Promise<string>((resolve) => {
                rl.question("> ", resolve);
            });

            rl.close();
            const idx = Number.parseInt(answer, 10) - 1;

            if (idx >= 0 && idx < allNames.length) {
                return { projects: [allNames[idx]!], target: parsed.target };
            }
        }

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
 * Parses a query string into a structured predicate.
 *
 * Grammar: `&lt;field>=&lt;value>` or `&lt;field>!=&lt;value>` clauses joined by
 * `&amp;&amp;` (all must match) or `||` (any must match). Mixing operators is
 * not supported and throws.
 * @param input Raw query string, e.g. `"language=typescript &amp;& tag=lib"`.
 * @returns The parsed query, or `undefined` if the input is empty.
 * @throws On mixed `&amp;&amp;` / `||` or malformed clauses.
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
            value: rawValue!.trim().replaceAll(/^["']|["']$/g, ""),
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
        case "id":
        case "project": {
            return test(name);
        }
        case "language": {
            return test(project.language);
        }
        case "layer": {
            return test(project.layer);
        }
        case "projectType":
        case "type": {
            return test(project.projectType);
        }
        case "stack": {
            return test(project.stack);
        }
        case "tag":
        case "tags": {
            return testList(project.tags);
        }
        default: {
            // Unknown field — treat as non-match so we don't crash.
            return false;
        }
    }
};

/**
 * Filters project names by a query string.
 * @param projectNames Candidate project names to filter.
 * @param workspace The workspace configuration (projects must carry vis metadata).
 * @param query A query string, or `undefined` / empty to skip filtering.
 * @returns The subset of `projectNames` that match the query.
 */
export const filterProjectsByQuery = (projectNames: string[], workspace: WorkspaceConfiguration, query: string | undefined): string[] => {
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
