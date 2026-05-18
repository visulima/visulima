import { readdirSync, statSync } from "node:fs";

import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { readYamlSync } from "@visulima/fs/yaml";
import { join } from "@visulima/path";

import { loadVisConfig } from "../../config/config";

/**
 * The source migration tool whose config the migrated `vis.config.ts`
 * is being checked against.
 */
export type SourceTool = "moon" | "nx" | "turbo";

/**
 * One node of the normalized task-graph model. The model is deliberately
 * config-level (not execution-level): it captures the task-graph topology
 * and the cache-key surface, which are the deterministic, provable core
 * of "did the migration preserve semantics". It does **not** run either
 * tool — see the scoping note in roadmap #13.
 */
export interface GraphNode {
    /** `undefined` = the source did not state it (inherits); only diffed when both sides state it. */
    cache: boolean | undefined;
    /** Canonical dependency-edge tokens, locale-sorted. `^t` = upstream dep, `p#t` = explicit project, `t` = bare. */
    dependsOn: string[];
    /** Locale-sorted env var names (passThrough folded in). */
    env: string[];
    /** Canonical id: `&lt;project>#&lt;target>`, or `*#&lt;target>` for root/default tasks, or `__global__`. */
    id: string;
    /** Locale-sorted input tokens (object inputs JSON-canonicalized). */
    inputs: string[];
    /** Locale-sorted output tokens. */
    outputs: string[];
}

export type TaskGraphModel = Map<string, GraphNode>;

export type FindingSeverity = "error" | "warning";

export interface EquivalenceFinding {
    /** Which equivalence axis diverged. */
    axis: "cache" | "dependsOn" | "env" | "inputs" | "outputs" | "target-set";
    detail: string;
    /** The graph node id this finding is about. */
    node: string;
    severity: FindingSeverity;
}

export interface EquivalenceReport {
    findings: EquivalenceFinding[];
    source: SourceTool;
    sourceNodeCount: number;
    visNodeCount: number;
}

const GLOBAL_ID = "__global__";

// Locale-aware, deterministic — mirrors the item 11 / Axis A sort contract
// so two runs over identical input emit byte-identical output.
const sortStrings = (values: Iterable<string>): string[] => [...new Set(values)].sort((a, b) => a.localeCompare(b));

/**
 * Canonicalize one object-shaped input (nx allows `{ fileset }`, `{ env }`,
 * `{ input }`, `{ dependentTasksOutputFiles }`, …) into a stable token so
 * structurally-equal inputs always produce the same string.
 */
const canonicalizeObjectToken = (value: Record<string, unknown>): string => {
    const keys = Object.keys(value).sort();
    const parts = keys.map((k) => `${k}=${JSON.stringify(value[k])}`);

    return `{${parts.join(",")}}`;
};

const normalizeTokenList = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    const out: string[] = [];

    for (const entry of value) {
        if (typeof entry === "string") {
            out.push(entry);
        } else if (entry && typeof entry === "object") {
            out.push(canonicalizeObjectToken(entry as Record<string, unknown>));
        }
    }

    return sortStrings(out);
};

const emptyNode = (id: string): GraphNode => {
    return {
        cache: undefined,
        dependsOn: [],
        env: [],
        id,
        inputs: [],
        outputs: [],
    };
};

/* ------------------------------------------------------------------ *
 * dependsOn canonicalization — unify turbo / nx / moon / vis syntaxes  *
 * ------------------------------------------------------------------ */

const canonicalEdge = (project: string | undefined, target: string, upstream: boolean): string => {
    if (upstream) {
        return `^${target}`;
    }

    if (project && project !== "self" && project !== "~") {
        return `${project}#${target}`;
    }

    return target;
};

const normalizeStringEdge = (raw: string, syntax: SourceTool | "vis"): string => {
    const dep = raw.trim();

    if (syntax === "moon") {
        // moon: `^:build` (deps), `~:build` (self), `project:build`, `build`
        if (dep.startsWith("^:")) {
            return canonicalEdge(undefined, dep.slice(2), true);
        }

        if (dep.startsWith("~:")) {
            return canonicalEdge(undefined, dep.slice(2), false);
        }

        if (dep.includes(":")) {
            const [project, target] = dep.split(":");

            return canonicalEdge(project, target ?? "", false);
        }

        return dep;
    }

    // turbo / nx / vis share `^build`, `project#build`, `build`
    if (dep.startsWith("^")) {
        return canonicalEdge(undefined, dep.slice(1), true);
    }

    if (dep.includes("#")) {
        const [project, target] = dep.split("#");

        return canonicalEdge(project, target ?? "", false);
    }

    return dep;
};

const normalizeDependsOn = (value: unknown, syntax: SourceTool | "vis"): string[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    const out: string[] = [];

    for (const entry of value) {
        if (typeof entry === "string") {
            out.push(normalizeStringEdge(entry, syntax));

            continue;
        }

        if (!entry || typeof entry !== "object") {
            continue;
        }

        const object = entry as { dependencies?: boolean; optional?: boolean; projects?: string | string[]; target?: string };
        const { target } = object;

        if (!target) {
            continue;
        }

        if (object.dependencies === true) {
            out.push(canonicalEdge(undefined, target, true));

            continue;
        }

        if (object.projects === undefined) {
            out.push(canonicalEdge(undefined, target, false));

            continue;
        }

        const projects = Array.isArray(object.projects) ? object.projects : [object.projects];

        for (const project of projects) {
            out.push(project === "^" ? canonicalEdge(undefined, target, true) : canonicalEdge(project, target, false));
        }
    }

    return sortStrings(out);
};

/* ------------------------------------------------------------------ *
 * Source parsers — read the raw foreign config, no tool invocation     *
 * ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- T is the caller-supplied typed-cast convenience; the alternative is a verbose `as X | undefined` at every callsite (mirrors shared.ts#readJsonConfig)
const readJson = <T>(path: string): T | undefined => {
    if (!isAccessibleSync(path)) {
        return undefined;
    }

    try {
        return JSON.parse(readFileSync(path)) as T;
    } catch {
        return undefined;
    }
};

interface TurboTask {
    cache?: boolean;
    dependsOn?: string[];
    env?: string[];
    inputs?: string[];
    outputs?: string[];
    passThroughEnv?: string[];
}

interface TurboJson {
    globalDependencies?: string[];
    globalEnv?: string[];
    globalPassThroughEnv?: string[];
    pipeline?: Record<string, TurboTask>;
    tasks?: Record<string, TurboTask>;
}

const parseTurboModel = (root: string): TaskGraphModel => {
    const model: TaskGraphModel = new Map();
    const turbo = readJson<TurboJson>(join(root, "turbo.json"));

    if (!turbo) {
        return model;
    }

    const tasks = turbo.tasks ?? turbo.pipeline ?? {};

    for (const [name, task] of Object.entries(tasks)) {
        const id = name.includes("#") ? name : `*#${name}`;
        const node = emptyNode(id);

        node.dependsOn = normalizeDependsOn(task.dependsOn, "turbo");
        node.inputs = normalizeTokenList(task.inputs);
        node.outputs = normalizeTokenList(task.outputs);
        node.env = sortStrings([...(task.env ?? []), ...(task.passThroughEnv ?? [])]);
        node.cache = task.cache === false ? false : undefined;
        model.set(id, node);
    }

    const global = emptyNode(GLOBAL_ID);

    global.inputs = normalizeTokenList(turbo.globalDependencies);
    global.env = sortStrings([...(turbo.globalEnv ?? []), ...(turbo.globalPassThroughEnv ?? [])]);

    if (global.inputs.length > 0 || global.env.length > 0) {
        model.set(GLOBAL_ID, global);
    }

    return model;
};

const SKIP_DIRECTORIES = new Set([".git", ".nx", ".turbo", ".vis", "build", "coverage", "dist", "node_modules"]);

const findFiles = (root: string, fileName: string, maxDepth = 8): string[] => {
    const out: string[] = [];

    const walk = (dir: string, depth: number): void => {
        if (depth > maxDepth) {
            return;
        }

        let entries: string[];

        try {
            entries = readdirSync(dir);
        } catch {
            return;
        }

        for (const entry of entries.toSorted()) {
            if (entry === fileName) {
                out.push(join(dir, entry));

                continue;
            }

            if (entry.startsWith(".") && entry !== ".moon") {
                continue;
            }

            if (SKIP_DIRECTORIES.has(entry)) {
                continue;
            }

            const full = join(dir, entry);

            try {
                if (statSync(full).isDirectory()) {
                    walk(full, depth + 1);
                }
            } catch {
                // Unreadable / vanished entry — skip.
            }
        }
    };

    walk(root, 0);

    return out;
};

interface NxTarget {
    cache?: boolean;
    dependsOn?: unknown;
    inputs?: unknown;
    outputs?: unknown;
}

interface NxJson {
    targetDefaults?: Record<string, NxTarget>;
}

interface ProjectJson {
    name?: string;
    targets?: Record<string, NxTarget>;
}

const applyNxTarget = (node: GraphNode, target: NxTarget): void => {
    node.dependsOn = normalizeDependsOn(target.dependsOn, "nx");
    node.inputs = normalizeTokenList(target.inputs);
    node.outputs = normalizeTokenList(target.outputs);
    node.cache = typeof target.cache === "boolean" ? target.cache : undefined;
};

const parseNxModel = (root: string): TaskGraphModel => {
    const model: TaskGraphModel = new Map();
    const nx = readJson<NxJson>(join(root, "nx.json"));

    for (const [name, target] of Object.entries(nx?.targetDefaults ?? {})) {
        const id = `*#${name}`;
        const node = emptyNode(id);

        applyNxTarget(node, target);
        model.set(id, node);
    }

    for (const projectJsonPath of findFiles(root, "project.json")) {
        const project = readJson<ProjectJson>(projectJsonPath);

        if (!project?.name || !project.targets) {
            continue;
        }

        for (const [name, target] of Object.entries(project.targets)) {
            const id = `${project.name}#${name}`;
            const node = emptyNode(id);

            applyNxTarget(node, target);
            model.set(id, node);
        }
    }

    return model;
};

interface MoonTaskYaml {
    deps?: unknown;
    inputs?: string[];
    options?: { cache?: boolean };
    outputs?: string[];
}

interface MoonTasksYaml {
    implicitInputs?: string[];
    tasks?: Record<string, MoonTaskYaml>;
}

const applyMoonTask = (node: GraphNode, task: MoonTaskYaml): void => {
    node.dependsOn = normalizeDependsOn(task.deps, "moon");
    node.inputs = normalizeTokenList(task.inputs);
    node.outputs = normalizeTokenList(task.outputs);
    node.cache = typeof task.options?.cache === "boolean" ? task.options.cache : undefined;
};

const readMoonYaml = (path: string): MoonTasksYaml | undefined => {
    if (!isAccessibleSync(path)) {
        return undefined;
    }

    try {
        return readYamlSync(path);
    } catch {
        return undefined;
    }
};

const parseMoonModel = (root: string): TaskGraphModel => {
    const model: TaskGraphModel = new Map();

    const moonDirectory = join(root, ".moon");
    const rootTaskFiles = [join(moonDirectory, "tasks.yml"), join(moonDirectory, "tasks.yaml")];

    for (const file of rootTaskFiles) {
        const parsed = readMoonYaml(file);

        if (!parsed) {
            continue;
        }

        for (const [name, task] of Object.entries(parsed.tasks ?? {})) {
            const id = `*#${name}`;
            const node = emptyNode(id);

            applyMoonTask(node, task);
            model.set(id, node);
        }

        if (parsed.implicitInputs && parsed.implicitInputs.length > 0) {
            const global = emptyNode(GLOBAL_ID);

            global.inputs = normalizeTokenList(parsed.implicitInputs);
            model.set(GLOBAL_ID, global);
        }
    }

    for (const moonYml of [...findFiles(root, "moon.yml"), ...findFiles(root, "moon.yaml")]) {
        const parsed = readMoonYaml(moonYml);

        if (!parsed?.tasks) {
            continue;
        }

        // moon.yml lives at the project root; use the containing dir name as project id.
        const segments = moonYml.split(/[/\\]/);
        const project = segments.at(-2) ?? "*";

        for (const [name, task] of Object.entries(parsed.tasks)) {
            const id = `${project}#${name}`;
            const node = emptyNode(id);

            applyMoonTask(node, task);
            model.set(id, node);
        }
    }

    return model;
};

/* ------------------------------------------------------------------ *
 * vis-side model — load the migrated config through vis's own loader   *
 * ------------------------------------------------------------------ */

interface VisTaskLike {
    cache?: boolean;
    dependsOn?: unknown;
    env?: string[];
    inputs?: unknown;
    options?: { passThroughEnv?: string[] };
    outputs?: unknown;
    passThroughEnv?: string[];
}

const applyVisTask = (node: GraphNode, task: VisTaskLike): void => {
    node.dependsOn = normalizeDependsOn(task.dependsOn, "vis");
    node.inputs = normalizeTokenList(task.inputs);
    node.outputs = normalizeTokenList(task.outputs);
    node.env = sortStrings([...(task.env ?? []), ...(task.passThroughEnv ?? []), ...(task.options?.passThroughEnv ?? [])]);
    node.cache = task.cache === false ? false : typeof task.cache === "boolean" ? task.cache : undefined;
};

export const buildVisModel = async (root: string): Promise<TaskGraphModel> => {
    const model: TaskGraphModel = new Map();
    const config = (await loadVisConfig(root)) as {
        taskRunner?: { globalEnv?: string[]; globalInputs?: string[]; globalPassThroughEnv?: string[] };
        tasks?: Record<string, VisTaskLike>;
    };

    for (const [name, task] of Object.entries(config.tasks ?? {})) {
        const id = `*#${name}`;
        const node = emptyNode(id);

        applyVisTask(node, task ?? {});
        model.set(id, node);
    }

    const runner = config.taskRunner ?? {};
    const global = emptyNode(GLOBAL_ID);

    global.inputs = normalizeTokenList(runner.globalInputs);
    global.env = sortStrings([...(runner.globalEnv ?? []), ...(runner.globalPassThroughEnv ?? [])]);

    if (global.inputs.length > 0 || global.env.length > 0) {
        model.set(GLOBAL_ID, global);
    }

    return model;
};

export const buildSourceModel = (root: string, tool: SourceTool): TaskGraphModel => {
    switch (tool) {
        case "moon": {
            return parseMoonModel(root);
        }
        case "nx": {
            return parseNxModel(root);
        }
        default: {
            return parseTurboModel(root);
        }
    }
};

/**
 * Auto-detect the source tool by config-file presence. Returns
 * `undefined` when none (or several) are found so the caller can ask
 * the user to disambiguate with `--from`.
 */
export const detectSourceTool = (root: string): SourceTool | undefined => {
    const found: SourceTool[] = [];

    if (isAccessibleSync(join(root, "turbo.json"))) {
        found.push("turbo");
    }

    if (isAccessibleSync(join(root, "nx.json"))) {
        found.push("nx");
    }

    if (isAccessibleSync(join(root, ".moon", "tasks.yml")) || isAccessibleSync(join(root, ".moon", "tasks.yaml"))) {
        found.push("moon");
    }

    return found.length === 1 ? found[0] : undefined;
};

/* ------------------------------------------------------------------ *
 * Diff                                                                 *
 * ------------------------------------------------------------------ */

const diffArrayAxis = (findings: EquivalenceFinding[], node: string, axis: EquivalenceFinding["axis"], source: string[], vis: string[]): void => {
    const missing = source.filter((v) => !vis.includes(v));
    const added = vis.filter((v) => !source.includes(v));

    if (missing.length === 0 && added.length === 0) {
        return;
    }

    const parts: string[] = [];

    if (missing.length > 0) {
        parts.push(`dropped [${missing.join(", ")}]`);
    }

    if (added.length > 0) {
        parts.push(`added [${added.join(", ")}]`);
    }

    findings.push({
        axis,
        // A dropped input/edge changes the task graph or widens the cache key
        // (correctness risk) → error. A purely additive change is a warning.
        detail: `${axis} diverged: ${parts.join("; ")}`,
        node,
        severity: missing.length > 0 ? "error" : "warning",
    });
};

export const diffModels = (source: TaskGraphModel, vis: TaskGraphModel, tool: SourceTool): EquivalenceReport => {
    const findings: EquivalenceFinding[] = [];
    const ids = sortStrings([...source.keys(), ...vis.keys()]);

    for (const id of ids) {
        const sourceNode = source.get(id);
        const visNode = vis.get(id);

        if (sourceNode && !visNode) {
            // turbo's migrator intentionally skips `project#task` entries;
            // report that as a documented, non-fatal gap rather than an error.
            const skippedByDesign = tool === "turbo" && id.includes("#") && !id.startsWith("*#") && id !== GLOBAL_ID;

            findings.push({
                axis: "target-set",
                detail: skippedByDesign
                    ? `source target \`${id}\` was skipped by design (turbo project#task is migrated into per-project project.json — move it there and re-verify)`
                    : `source target \`${id}\` has no equivalent in the migrated vis config`,
                node: id,
                severity: skippedByDesign ? "warning" : "error",
            });

            continue;
        }

        if (!sourceNode && visNode) {
            findings.push({
                axis: "target-set",
                detail: `migrated vis config defines \`${id}\` with no source equivalent (extra target — not a regression, but review)`,
                node: id,
                severity: "warning",
            });

            continue;
        }

        if (!sourceNode || !visNode) {
            continue;
        }

        diffArrayAxis(findings, id, "dependsOn", sourceNode.dependsOn, visNode.dependsOn);
        diffArrayAxis(findings, id, "inputs", sourceNode.inputs, visNode.inputs);
        diffArrayAxis(findings, id, "outputs", sourceNode.outputs, visNode.outputs);
        diffArrayAxis(findings, id, "env", sourceNode.env, visNode.env);

        if (sourceNode.cache !== undefined && visNode.cache !== undefined && sourceNode.cache !== visNode.cache) {
            findings.push({
                axis: "cache",
                detail: `cache flag diverged: source=${String(sourceNode.cache)} vis=${String(visNode.cache)} (changes what invalidates the cache)`,
                node: id,
                severity: "error",
            });
        }
    }

    findings.sort((a, b) => a.node.localeCompare(b.node) || a.axis.localeCompare(b.axis));

    return { findings, source: tool, sourceNodeCount: source.size, visNodeCount: vis.size };
};

/* ------------------------------------------------------------------ *
 * Axis-A output                                                        *
 * ------------------------------------------------------------------ */

export type OutputFormat = "json" | "ndjson" | "table";

export const VALID_FORMATS = new Set<OutputFormat>(["json", "ndjson", "table"]);

const toJsonPayload = (report: EquivalenceReport): Record<string, unknown> => {
    return {
        equivalent: report.findings.every((f) => f.severity !== "error"),
        findings: report.findings,
        source: report.source,
        sourceNodeCount: report.sourceNodeCount,
        visNodeCount: report.visNodeCount,
    };
};

/**
 * Renders the report. JSON / NDJSON go to **stdout only** (the machine
 * channel, per Axis A); the human table goes through `logger`.
 */
export const formatEquivalenceReport = (
    report: EquivalenceReport,
    format: OutputFormat,
    logger: { info: (message: string) => void; warn: (message: string) => void },
): void => {
    if (format === "json") {
        process.stdout.write(`${JSON.stringify(toJsonPayload(report), undefined, 2)}\n`);

        return;
    }

    if (format === "ndjson") {
        for (const finding of report.findings) {
            process.stdout.write(`${JSON.stringify(finding)}\n`);
        }

        return;
    }

    logger.info(`Migration equivalence: ${report.source} → vis`);
    logger.info(`  source nodes: ${String(report.sourceNodeCount)}   vis nodes: ${String(report.visNodeCount)}`);

    if (report.findings.length === 0) {
        logger.info("  ✓ task graph + cache-key surface preserved (no divergence).");

        return;
    }

    for (const finding of report.findings) {
        const line = `  [${finding.severity}] ${finding.node} (${finding.axis}) — ${finding.detail}`;

        if (finding.severity === "error") {
            logger.warn(line);
        } else {
            logger.info(line);
        }
    }
};

/**
 * Returns the process exit code: `1` when the migration is not proven
 * equivalent at the requested gate, `0` otherwise.
 */
export const equivalenceExitCode = (report: EquivalenceReport, failOn: "error" | "warning"): number => {
    const gating = report.findings.some((f) => (failOn === "warning" ? true : f.severity === "error"));

    return gating ? 1 : 0;
};
