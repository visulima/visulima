import { isAccessibleSync, readFileSync, readJsonSync, walkSync } from "@visulima/fs";
import { join, resolve } from "@visulima/path";
import type {
    DependencyType,
    InputDefinition,
    ProjectGraph,
    ProjectGraphDependency,
    ProjectGraphProjectNode,
    TargetConfiguration,
    WorkspaceConfiguration,
} from "@visulima/task-runner";
import { looksLikeInputUri, parseInputUri } from "@visulima/task-runner";
import { parse as parseYaml } from "yaml";

import { BUILT_IN_DETECTORS, inferProjectTargets } from "../inference";
import { mergeTargetWithInherit } from "../task/target-merge";
import type { VisTargetConfiguration } from "../task/target-options";
import { applyPreset, defaultCacheForType } from "../task/target-options";
import { buildGitignoreMatcher } from "../util/gitignore-matcher";
import type {
    PackageJson,
    PackageJsonIndex,
    ProjectJson,
    ProjectOptionsIndex,
    TaskDefaultsScope,
    VisConfig,
    VisProjectConfiguration,
    VisTaskConfigIndex,
} from "./types";

const TRAILING_SLASH_RE = /\/+$/;
const DOUBLE_GLOB_SUFFIX_RE = /\/\*\*$/;
const NESTED_GLOB_SUFFIX_RE = /\/\*\/\*$/;
const QUOTES_RE = /^['"]|['"]$/g;
const NODE_MODULES_RE = /node_modules/;
const DOT_GIT_RE = /\.git/;

/**
 * Reads and parses a JSON file, returning undefined on failure.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- T is the caller-supplied typed-cast convenience; the alternative is a verbose `as X | undefined` at every callsite
const readJsonFileSafe = <T>(filePath: string): T | undefined => {
    try {
        return readJsonSync(filePath) as T;
    } catch {
        return undefined;
    }
};

/**
 * Recursively scans a directory for packages (directories containing package.json).
 */
const scanDirectoryRecursive = (baseDirectory: string, base: string, results: string[]): void => {
    for (const entry of walkSync(baseDirectory, { includeFiles: false, includeSymlinks: false, skip: [NODE_MODULES_RE, DOT_GIT_RE] })) {
        if (entry.path === baseDirectory) {
            continue;
        }

        if (isAccessibleSync(join(entry.path, "package.json"))) {
            const relativePath = entry.path.slice(baseDirectory.length + 1);

            results.push(`${base}/${relativePath}`);
        }
    }
};

/**
 * Resolves a simple glob pattern like "packages/*" to directories containing package.json.
 */
const resolveSimpleGlob = (workspaceRoot: string, cleanPattern: string, results: string[]): void => {
    const base = cleanPattern.slice(0, -2);
    const baseDirectory = resolve(workspaceRoot, base);

    if (!isAccessibleSync(baseDirectory)) {
        return;
    }

    for (const entry of walkSync(baseDirectory, { includeFiles: false, includeSymlinks: false, maxDepth: 1, skip: [NODE_MODULES_RE, DOT_GIT_RE] })) {
        if (entry.path === baseDirectory) {
            continue;
        }

        if (isAccessibleSync(join(entry.path, "package.json"))) {
            results.push(join(base, entry.name));
        }
    }
};

/**
 * Resolves a double glob pattern like "packages/**" or "packages/ * / *" to directories containing package.json.
 */
const resolveDoubleGlob = (workspaceRoot: string, cleanPattern: string, results: string[]): void => {
    const base = cleanPattern.replace(DOUBLE_GLOB_SUFFIX_RE, "").replace(NESTED_GLOB_SUFFIX_RE, "");
    const baseDirectory = resolve(workspaceRoot, base);

    if (!isAccessibleSync(baseDirectory)) {
        return;
    }

    scanDirectoryRecursive(baseDirectory, base, results);
};

/**
 * Resolves an exact directory pattern.
 */
const resolveExactDirectory = (workspaceRoot: string, cleanPattern: string, results: string[]): void => {
    const fullPath = resolve(workspaceRoot, cleanPattern);

    if (isAccessibleSync(fullPath) && isAccessibleSync(join(fullPath, "package.json"))) {
        results.push(cleanPattern);
    }
};

const REGEX_SPECIALS_RE = /[$()+.?[\\\]^{|}]/g;

/**
 * Top-level bare globs like `@*` or `pkg-*` — pnpm allows them as
 * shortcuts for "scope-prefixed children of the workspace root". `*` is
 * the only meta-character supported; everything else is escaped.
 */
const resolveBareGlob = (workspaceRoot: string, cleanPattern: string, results: string[]): void => {
    const escaped = cleanPattern.replaceAll(REGEX_SPECIALS_RE, String.raw`\$&`).replaceAll("*", ".*");
    const regex = new RegExp(`^${escaped}$`);

    for (const entry of walkSync(workspaceRoot, { includeFiles: false, includeSymlinks: false, maxDepth: 1, skip: [NODE_MODULES_RE, DOT_GIT_RE] })) {
        if (entry.path === workspaceRoot) {
            continue;
        }

        if (regex.test(entry.name) && isAccessibleSync(join(entry.path, "package.json"))) {
            results.push(entry.name);
        }
    }
};

/**
 * Resolves glob-like workspace patterns to actual directories. Supports
 * `dir/&lt;asterisk>`, `dir/&lt;asterisk>&lt;asterisk>`, `dir/&lt;asterisk>/&lt;asterisk>`,
 * top-level bare globs like `@&lt;asterisk>`, and exact paths.
 *
 * `!`-prefixed entries are exclusion patterns (pnpm semantics): a
 * resolved directory matching any of them is dropped from the result.
 * The workspace root's `.gitignore` is also applied so packages living
 * inside ignored directories (generated apps, scratch checkouts) don't
 * sneak into update / outdated runs.
 */
const resolveWorkspacePatterns = (workspaceRoot: string, patterns: string[]): string[] => {
    const positives: string[] = [];
    const negatives: string[] = [];

    for (const pattern of patterns) {
        const cleanPattern = pattern.replace(TRAILING_SLASH_RE, "");

        if (cleanPattern.startsWith("!")) {
            const stripped = cleanPattern.slice(1);

            if (stripped.length > 0) {
                negatives.push(stripped);

                // pnpm treats `!dir/**` as "exclude dir and everything under
                // it"; gitignore's `dir/**` matches only descendants. Add a
                // companion `dir/` pattern so the directory itself is also
                // dropped from workspace candidates.
                if (stripped.endsWith("/**")) {
                    negatives.push(`${stripped.slice(0, -3)}/`);
                }
            }

            continue;
        }

        positives.push(cleanPattern);
    }

    const directories: string[] = [];

    for (const cleanPattern of positives) {
        if (cleanPattern.endsWith("/**") || cleanPattern.endsWith("/*/*")) {
            resolveDoubleGlob(workspaceRoot, cleanPattern, directories);
        } else if (cleanPattern.endsWith("/*")) {
            resolveSimpleGlob(workspaceRoot, cleanPattern, directories);
        } else if (!cleanPattern.includes("/") && cleanPattern.includes("*")) {
            resolveBareGlob(workspaceRoot, cleanPattern, directories);
        } else {
            resolveExactDirectory(workspaceRoot, cleanPattern, directories);
        }
    }

    if (directories.length === 0) {
        return directories;
    }

    const matcher = buildGitignoreMatcher({ cwd: workspaceRoot, extraPatterns: negatives });

    return matcher.filterDirectories(directories);
};

/**
 * Reads workspace patterns from pnpm-workspace.yaml (simple parser).
 */

/**
 * Expands every `{ group: "name" }` entry in a target's `dependsOn`
 * into the group's declared members, recursively resolving nested
 * groups and detecting cycles.
 *
 * Runs once per workspace discovery so task-runner's graph builder
 * only ever sees bare dependency entries — groups are pure vis sugar.
 */
export const expandTaskGroups = (
    dependsOn: (string | { dependencies?: boolean; projects?: string | string[]; target: string } | { group: string })[] | undefined,
    groups: VisConfig["taskGroups"],
    seen: Set<string> = new Set(),
): (string | { dependencies?: boolean; projects?: string | string[]; target: string })[] => {
    if (!dependsOn) {
        return [];
    }

    const expanded: (string | { dependencies?: boolean; projects?: string | string[]; target: string })[] = [];

    for (const entry of dependsOn) {
        if (typeof entry === "object" && entry && "group" in entry) {
            const groupName = entry.group;

            if (seen.has(groupName)) {
                throw new Error(`Cycle detected in vis.config taskGroups: ${[...seen, groupName].join(" → ")}`);
            }

            const members = groups?.[groupName];

            if (!members) {
                throw new Error(`Unknown taskGroup "${groupName}" referenced in dependsOn. Declare it under \`taskGroups\` in vis.config.ts.`);
            }

            expanded.push(...expandTaskGroups(members, groups, new Set([...seen, groupName])));
            continue;
        }

        expanded.push(entry);
    }

    return expanded;
};

/**
 * Validates the root `package.json` `workspaces` field and returns the
 * resolved pattern array. Throws a clear diagnostic when the field is
 * malformed (empty array, wrong type, object without `packages`)
 * instead of falling through to a vague "no workspace configuration
 * found" error that hides the real problem.
 */
const validateWorkspacesField = (raw: PackageJson["workspaces"]): string[] => {
    if (Array.isArray(raw)) {
        if (raw.length === 0) {
            throw new Error("Invalid package.json `workspaces`: empty array. Add at least one pattern like \"packages/*\" or remove the field.");
        }

        for (const entry of raw) {
            if (typeof entry !== "string" || entry.trim().length === 0) {
                throw new TypeError(`Invalid package.json \`workspaces\` entry: expected a non-empty glob string, got ${JSON.stringify(entry)}.`);
            }
        }

        return raw;
    }

    if (raw && typeof raw === "object") {
        const { packages } = raw;

        if (packages === undefined) {
            throw new Error("Invalid package.json `workspaces`: object form requires a `packages` array (e.g. `{ \"packages\": [\"packages/*\"] }`).");
        }

        if (!Array.isArray(packages)) {
            throw new TypeError(`Invalid package.json \`workspaces.packages\`: expected an array of glob strings, got ${typeof packages}.`);
        }

        return validateWorkspacesField(packages);
    }

    throw new TypeError(`Invalid package.json \`workspaces\`: expected an array or { packages: string[] } object, got ${typeof raw}.`);
};

/**
 * Read `overrides:` from `pnpm-workspace.yaml` (pnpm v9+ moved the
 * `pnpm.overrides` block out of `package.json` into the workspace
 * config). Returns the flat `{ depName: specifier }` map, or
 * `undefined` if the file is missing / unparseable / has no overrides.
 *
 * Best-effort: a malformed YAML file returns `undefined` instead of
 * throwing — drift detection should silently skip the file rather than
 * crash a `vis lint` invocation.
 */
const readPnpmWorkspaceOverrides = (workspaceRoot: string): Record<string, string> | undefined => {
    const filePath = join(workspaceRoot, "pnpm-workspace.yaml");

    if (!isAccessibleSync(filePath)) {
        return undefined;
    }

    let parsed: unknown;

    try {
        parsed = parseYaml(readFileSync(filePath));
    } catch {
        return undefined;
    }

    if (typeof parsed !== "object" || parsed === null) {
        return undefined;
    }

    const { overrides } = parsed as { overrides?: unknown };

    if (typeof overrides !== "object" || overrides === null || Array.isArray(overrides)) {
        return undefined;
    }

    const out: Record<string, string> = {};

    for (const [key, value] of Object.entries(overrides as Record<string, unknown>)) {
        if (typeof value === "string") {
            out[key] = value;
        }
    }

    return Object.keys(out).length > 0 ? out : undefined;
};

const readPnpmWorkspacePatterns = (workspaceRoot: string): string[] | undefined => {
    const filePath = join(workspaceRoot, "pnpm-workspace.yaml");

    if (!isAccessibleSync(filePath)) {
        return undefined;
    }

    const content = readFileSync(filePath);
    const patterns: string[] = [];
    let inPackages = false;

    for (const line of content.split("\n")) {
        const trimmed = line.trim();

        if (trimmed === "packages:") {
            inPackages = true;
            continue;
        }

        if (inPackages) {
            if (trimmed.startsWith("- ")) {
                const pattern = trimmed.slice(2).replaceAll(QUOTES_RE, "");

                patterns.push(pattern);
            } else if (trimmed && !trimmed.startsWith("#")) {
                break;
            }
        }
    }

    return patterns.length > 0 ? patterns : undefined;
};

/**
 * Read the *raw* workspace patterns array — pnpm-workspace.yaml first,
 * package.json#workspaces as fallback. Returns the patterns verbatim,
 * including any `!`-prefixed exclusions, so callers can decide how to
 * apply them (the existing {@link resolveWorkspacePatterns} only
 * resolves positive entries).
 *
 * Best-effort: a malformed `workspaces` field returns `undefined`
 * instead of throwing, so consumers using this for filtering (e.g.
 * sort-package-json) don't fail the whole command on a config typo.
 * Strict consumers should call {@link validateWorkspacesField}
 * directly to surface diagnostics.
 */
const readWorkspacePatterns = (workspaceRoot: string): string[] | undefined => {
    const pnpm = readPnpmWorkspacePatterns(workspaceRoot);

    if (pnpm) {
        return pnpm;
    }

    const rootPkg = readJsonFileSafe<PackageJson>(join(workspaceRoot, "package.json"));

    if (rootPkg?.workspaces === undefined) {
        return undefined;
    }

    try {
        return validateWorkspacesField(rootPkg.workspaces);
    } catch {
        return undefined;
    }
};

const FILE_GROUP_PREFIX = "@filegroup:";

type ProjectType = NonNullable<ProjectJson["projectType"]>;

/**
 * Returns true if the named `TaskDefaultsBlock` scope matches the
 * given project metadata. Missing scope fields are treated as "any".
 */
const scopeMatches = (scope: TaskDefaultsScope | undefined, projectJson: ProjectJson | undefined, projectType: ProjectType): boolean => {
    if (!scope) {
        return true;
    }

    if (scope.projectType && scope.projectType !== projectType) {
        return false;
    }

    if (scope.tags && scope.tags.length > 0) {
        const projectTags = new Set(projectJson?.tags);
        const hasOverlap = scope.tags.some((tag) => projectTags.has(tag));

        if (!hasOverlap) {
            return false;
        }
    }

    if (scope.layer) {
        const needed = Array.isArray(scope.layer) ? scope.layer : [scope.layer];

        if (projectJson?.layer === undefined || !needed.includes(projectJson.layer)) {
            return false;
        }
    }

    if (scope.stack) {
        const needed = Array.isArray(scope.stack) ? scope.stack : [scope.stack];

        if (projectJson?.stack === undefined || !needed.includes(projectJson.stack)) {
            return false;
        }
    }

    if (scope.language) {
        const needed = Array.isArray(scope.language) ? scope.language : [scope.language];

        if (projectJson?.language === undefined || !needed.includes(projectJson.language)) {
            return false;
        }
    }

    return true;
};

/**
 * Returns the merged target defaults that apply to a project, combining
 * the flat `config.targetDefaults` with all matching `config.taskDefaults`
 * blocks in declaration order. Later entries override earlier ones.
 */
const collectTargetDefaults = (
    config: VisConfig,
    projectJson: ProjectJson | undefined,
    projectType: ProjectType,
): Record<string, Partial<VisTargetConfiguration>> => {
    const merged: Record<string, Partial<VisTargetConfiguration>> = {};

    for (const [name, defaults] of Object.entries(config.targetDefaults ?? {})) {
        merged[name] = mergeTargetWithInherit(undefined, defaults);
    }

    for (const block of config.taskDefaults ?? []) {
        if (!scopeMatches(block.scope, projectJson, projectType)) {
            continue;
        }

        for (const [name, defaults] of Object.entries(block.targets)) {
            merged[name] = mergeTargetWithInherit(merged[name], defaults);
        }
    }

    return merged;
};

/**
 * Resolves `@filegroup:&lt;name>` tokens in an inputs array into their
 * concrete patterns defined at the workspace level. Eagerly validates any
 * URI-shaped strings (`file://`, `glob://`, `env://`, `func://`,
 * `dep://`) so config-load surfaces typos like `gob://**` instead of
 * deferring the failure until the affected target happens to run.
 */
const resolveFileGroupInputs = (
    inputs: (string | InputDefinition)[] | undefined,
    fileGroups: Record<string, string[]> | undefined,
): (string | InputDefinition)[] | undefined => {
    if (!inputs) {
        return inputs;
    }

    const resolved: (string | InputDefinition)[] = [];

    for (const input of inputs) {
        if (typeof input === "string" && input.startsWith(FILE_GROUP_PREFIX)) {
            const groupName = input.slice(FILE_GROUP_PREFIX.length);
            const group = fileGroups?.[groupName];

            if (group) {
                resolved.push(...group);
            }

            continue;
        }

        resolved.push(input);
    }

    for (const input of resolved) {
        if (typeof input === "string" && looksLikeInputUri(input)) {
            parseInputUri(input);
        }
    }

    return resolved;
};

/**
 * Tracks which unknown-detector warnings have already been emitted in
 * this process so a misconfigured workspace doesn't spam the console
 * once per project loop. Keyed by sorted unknown-key tuple.
 */
const warnedUnknownDetectorKeys = new Set<string>();

/**
 * Resolves the `inferTargets` config to a per-detector predicate, or
 * `undefined` when inference is disabled entirely. Boolean `true` enables
 * every detector; the object form lets users opt individual detectors in
 * or out by name (`{ vite: false }` keeps vitest/packem on, drops vite).
 * Detectors omitted from the object run at their default (enabled).
 *
 * Emits a once-per-process Node warning when the object form references
 * a detector name that doesn't exist in `BUILT_IN_DETECTORS` (typo
 * insurance — `{ vit: false }` would otherwise silently no-op).
 */
const resolveInferTargetOption = (option: VisConfig["inferTargets"]): ((detectorName: string) => boolean) | undefined => {
    if (option === true) {
        return () => true;
    }

    if (option === undefined || option === false) {
        return undefined;
    }

    const knownNames = new Set(BUILT_IN_DETECTORS.map((detector) => detector.name));
    const unknownKeys = Object.keys(option).filter((key) => !knownNames.has(key));

    if (unknownKeys.length > 0) {
        const dedupKey = [...unknownKeys].sort().join(",");

        if (!warnedUnknownDetectorKeys.has(dedupKey)) {
            warnedUnknownDetectorKeys.add(dedupKey);
            process.emitWarning(
                `vis: inferTargets references unknown detector(s): ${unknownKeys.join(", ")}. Known detectors: ${[...knownNames].join(", ")}.`,
                "VisConfigWarning",
            );
        }
    }

    return (detectorName) => option[detectorName] !== false;
};

/**
 * Merges a script-derived target with any declarative target definition
 * from project.json and applies scoped defaults. Also applies presets and
 * default-cache-for-type logic.
 */
const mergeTarget = (
    _name: string,
    scriptCommand: string | undefined,
    projectTarget: Partial<VisTargetConfiguration> | undefined,
    defaults: Partial<VisTargetConfiguration> | undefined,
    fileGroups: Record<string, string[]> | undefined,
): VisTargetConfiguration => {
    const merged = mergeTargetWithInherit(defaults, projectTarget);
    const base: VisTargetConfiguration = {
        ...merged,
        options: {
            ...defaults?.options,
            ...projectTarget?.options,
        },
    };

    if (scriptCommand && base.command === undefined && base.executor === undefined) {
        base.command = scriptCommand;
    }

    if (base.inputs) {
        base.inputs = resolveFileGroupInputs(base.inputs, fileGroups);
    }

    const withPreset = applyPreset(base);

    if (withPreset.cache === undefined) {
        withPreset.cache = defaultCacheForType(withPreset.type);
    }

    return withPreset;
};

/**
 * Creates script-based targets from package.json scripts, merging any
 * matching project.json target declaration + scoped defaults + file groups.
 */
const createTargetsFromScripts = (
    scripts: Record<string, string> | undefined,
    projectTargets: Record<string, VisTargetConfiguration> | undefined,
    defaults: Record<string, Partial<VisTargetConfiguration>>,
    fileGroups: Record<string, string[]> | undefined,
): Record<string, VisTargetConfiguration> => {
    const targets: Record<string, VisTargetConfiguration> = {};
    const seen = new Set<string>();

    for (const [name, command] of Object.entries(scripts ?? {})) {
        seen.add(name);
        targets[name] = mergeTarget(name, command, projectTargets?.[name], defaults[name], fileGroups);
    }

    for (const [name, projectTarget] of Object.entries(projectTargets ?? {})) {
        if (seen.has(name)) {
            continue;
        }

        targets[name] = mergeTarget(name, undefined, projectTarget, defaults[name], fileGroups);
    }

    return targets;
};

/**
 * Merge per-project targets from `project.json` with the per-package
 * `vis.task.ts` overlay. The overlay wins per-target via
 * {@link mergeTargetWithInherit}, which honours the `@inherit` sentinel.
 */
const mergeProjectTargets = (
    projectJsonTargets: Record<string, VisTargetConfiguration> | undefined,
    visTaskTargets: Record<string, VisTargetConfiguration> | undefined,
): Record<string, VisTargetConfiguration> | undefined => {
    if (projectJsonTargets === undefined && visTaskTargets === undefined) {
        return undefined;
    }

    const names = new Set<string>([...Object.keys(projectJsonTargets ?? {}), ...Object.keys(visTaskTargets ?? {})]);
    const out: Record<string, VisTargetConfiguration> = {};

    for (const name of names) {
        out[name] = mergeTargetWithInherit(projectJsonTargets?.[name], visTaskTargets?.[name]);
    }

    return out;
};

/**
 * Discovers all projects in the workspace and builds a WorkspaceConfiguration.
 */
const discoverWorkspace = (
    workspaceRoot: string,
    config: VisConfig = {},
    taskConfigs?: VisTaskConfigIndex,
): {
    config: VisConfig;
    packageJsons: PackageJsonIndex;
    projectOptions: ProjectOptionsIndex;
    workspace: WorkspaceConfiguration;
} => {
    const projects: Record<string, VisProjectConfiguration> = {};
    const projectOptions: ProjectOptionsIndex = new Map();
    const packageJsons: PackageJsonIndex = new Map();

    const pnpmPatterns = readPnpmWorkspacePatterns(workspaceRoot);
    const rootPkg = readJsonFileSafe<PackageJson>(join(workspaceRoot, "package.json"));

    let workspacePatterns: string[] | undefined;

    if (pnpmPatterns) {
        workspacePatterns = pnpmPatterns;
    } else if (rootPkg?.workspaces !== undefined) {
        workspacePatterns = validateWorkspacesField(rootPkg.workspaces);
    }

    if (!workspacePatterns) {
        throw new Error("No workspace configuration found. Expected pnpm-workspace.yaml or package.json workspaces field.");
    }

    const projectDirectories = resolveWorkspacePatterns(workspaceRoot, workspacePatterns);

    for (const projectDirectory of projectDirectories) {
        const packageJsonPath = join(workspaceRoot, projectDirectory, "package.json");
        const pkg = readJsonFileSafe<PackageJson>(packageJsonPath);

        if (!pkg?.name) {
            continue;
        }

        packageJsons.set(pkg.name, pkg);

        const projectJsonPath = join(workspaceRoot, projectDirectory, "project.json");
        const projectJson = readJsonFileSafe<ProjectJson>(projectJsonPath);

        let projectType: ProjectType = "library";

        if (projectJson?.projectType) {
            projectType = projectJson.projectType;
        } else if (pkg.bin !== undefined) {
            projectType = "application";
        }

        const defaults = collectTargetDefaults(config, projectJson, projectType);

        const overlayTargets = mergeProjectTargets(projectJson?.targets, taskConfigs?.get(projectDirectory)?.targets);
        const visTargets = createTargetsFromScripts(pkg.scripts, overlayTargets, defaults, config.fileGroups);

        // Project Crystal-style inference. Runs *after* the explicit
        // pipeline so any target name already declared by a
        // package.json script, project.json, or vis.task.ts wins. We
        // funnel the inferred target through `mergeTarget` so the
        // applied target defaults / preset / fileGroups path is
        // identical to script-derived targets — no parallel merge code
        // to drift.
        const detectorEnabled = resolveInferTargetOption(config.inferTargets);

        if (detectorEnabled !== undefined) {
            const projectRoot = join(workspaceRoot, projectDirectory);
            const enabledDetectors = BUILT_IN_DETECTORS.filter((detector) => detectorEnabled(detector.name));
            const inference = inferProjectTargets({ pkg, projectDirectory, projectRoot }, enabledDetectors);

            for (const [name, inferredTarget] of Object.entries(inference.targets)) {
                if (visTargets[name] !== undefined) {
                    continue;
                }

                visTargets[name] = {
                    ...mergeTarget(name, inferredTarget.command, inferredTarget, defaults[name], config.fileGroups),
                    inferred: true,
                };
            }
        }

        projectOptions.set(pkg.name, visTargets);

        const sanitizedTargets: Record<string, TargetConfiguration> = {};

        for (const [targetName, target] of Object.entries(visTargets)) {
            const { options } = target;
            const rest: Record<string, unknown> = { ...target };

            delete rest["inferred"];
            delete rest["options"];
            delete rest["preset"];
            delete rest["type"];

            const expandedDependsOn = target.dependsOn ? expandTaskGroups(target.dependsOn, config.taskGroups) : undefined;

            sanitizedTargets[targetName] = {
                ...rest,
                ...(expandedDependsOn ? { dependsOn: expandedDependsOn } : {}),
                ...(options ? { options: options as unknown as Record<string, unknown> } : {}),
            };
        }

        projects[pkg.name] = {
            implicitDependencies: projectJson?.implicitDependencies,
            language: projectJson?.language,
            layer: projectJson?.layer,
            owners: projectJson?.owners,
            project: projectJson?.project,
            projectType,
            root: projectDirectory,
            sourceRoot: projectJson?.sourceRoot ?? `${projectDirectory}/src`,
            stack: projectJson?.stack,
            tags: projectJson?.tags,
            targets: sanitizedTargets,
        };
    }

    return { config, packageJsons, projectOptions, workspace: { projects } };
};

/**
 * Builds the project dependency graph from package.json dependencies.
 *
 * If `packageJsons` is provided (e.g. from {@link discoverWorkspace}),
 * each project's `package.json` is reused from memory instead of
 * re-read + re-parsed off disk — on a 40-project monorepo that's 40
 * fewer reads per `vis run`.
 */
const buildProjectGraph = (workspaceRoot: string, workspace: WorkspaceConfiguration, packageJsons?: PackageJsonIndex): ProjectGraph => {
    const nodes: Record<string, ProjectGraphProjectNode> = {};
    const dependencies: Record<string, ProjectGraphDependency[]> = {};
    const projectNames = new Set(Object.keys(workspace.projects));

    for (const [name, config] of Object.entries(workspace.projects)) {
        nodes[name] = {
            data: config,
            name,
            type: config.projectType ?? "library",
        };

        dependencies[name] = [];

        const pkg = packageJsons?.get(name) ?? readJsonFileSafe<PackageJson>(join(workspaceRoot, config.root, "package.json"));

        if (!pkg) {
            continue;
        }

        const depSources: [Record<string, string> | undefined, DependencyType][] = [
            [pkg.dependencies, "static"],
            [pkg.devDependencies, "devDependency"],
            [pkg.peerDependencies, "peerDependency"],
        ];

        const seen = new Set<string>();

        for (const [deps, depType] of depSources) {
            if (!deps) {
                continue;
            }

            for (const depName of Object.keys(deps)) {
                if (projectNames.has(depName) && !seen.has(depName)) {
                    seen.add(depName);
                    dependencies[name]?.push({
                        source: name,
                        target: depName,
                        type: depType,
                    });
                }
            }
        }
    }

    return { dependencies, nodes };
};

/**
 * Pre-load every project's `vis.task.ts` overlay in parallel. Returns
 * a {@link VisTaskConfigIndex} keyed by relative project directory, ready
 * to pass into {@link discoverWorkspace}.
 *
 * This pre-pass is the bridge between sync `discoverWorkspace` and the
 * async overlay loader — callers that want overlay support load this
 * once up front, callers that don't simply omit the third argument and
 * keep the legacy "no overlay" behaviour.
 */
const loadVisTaskConfigsForWorkspace = async (workspaceRoot: string): Promise<VisTaskConfigIndex> => {
    const { loadVisTaskConfig } = await import("./config");
    const pnpmPatterns = readPnpmWorkspacePatterns(workspaceRoot);
    const rootPkg = readJsonFileSafe<PackageJson>(join(workspaceRoot, "package.json"));

    let workspacePatterns: string[] | undefined;

    if (pnpmPatterns) {
        workspacePatterns = pnpmPatterns;
    } else if (rootPkg?.workspaces !== undefined) {
        workspacePatterns = validateWorkspacesField(rootPkg.workspaces);
    }

    if (!workspacePatterns) {
        return new Map();
    }

    const projectDirectories = resolveWorkspacePatterns(workspaceRoot, workspacePatterns);
    const result: VisTaskConfigIndex = new Map();

    await Promise.all(
        projectDirectories.map(async (projectDirectory) => {
            const pkg = readJsonFileSafe<PackageJson>(join(workspaceRoot, projectDirectory, "package.json"));

            if (!pkg?.name) {
                return;
            }

            const overlay = await loadVisTaskConfig(workspaceRoot, join(workspaceRoot, projectDirectory), pkg.name);

            if (overlay !== undefined) {
                result.set(projectDirectory, overlay);
            }
        }),
    );

    return result;
};

export { type StagedConfig } from "../staged";
export {
    buildProjectGraph,
    collectTargetDefaults,
    discoverWorkspace,
    loadVisTaskConfigsForWorkspace,
    readPnpmWorkspaceOverrides,
    readPnpmWorkspacePatterns,
    readWorkspacePatterns,
    resolveWorkspacePatterns,
    scopeMatches,
    validateWorkspacesField,
};

export type {
    CodeownersConfig,
    OwnersEntry,
    PackageJson,
    PackageJsonIndex,
    ProjectJson,
    ProjectOptionsIndex,
    TaskDefaultsBlock,
    TaskDefaultsScope,
    VisConfig,
    VisProjectConfiguration,
    VisTaskConfig,
    VisTaskConfigIndex,
} from "./types";
