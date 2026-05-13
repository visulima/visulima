import { readdirSync, statSync, unlinkSync } from "node:fs";

import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { readYamlSync, writeYamlSync } from "@visulima/fs/yaml";
import { dirname, join, relative, sep } from "@visulima/path";

import { backupFile } from "./backup";
import { editJsonFile } from "./json";
import { readJsonConfig, serializeConfigObject, writeVisConfig } from "./shared";
import type { MigrateLogger, MigrationReport } from "./types";

interface NxJson {
    affected?: {
        defaultBase?: string;
    };
    defaultBase?: string;
    namedInputs?: Record<string, (string | Record<string, unknown>)[]>;
    targetDefaults?: Record<string, NxTargetDefault>;
}

interface NxTargetDefault {
    [key: string]: unknown;
    cache?: boolean;
    dependsOn?: string[];
    executor?: string;
    inputs?: (string | Record<string, unknown>)[];
    options?: Record<string, unknown>;
    outputs?: string[];
    persistent?: boolean;
}

interface ProjectJson {
    $schema?: string;
    [key: string]: unknown;
    name?: string;
    targets?: Record<string, NxProjectTarget>;
}

interface NxProjectTarget {
    [key: string]: unknown;
    executor?: string;
    options?: Record<string, unknown>;
    syncGenerators?: string[];
}

const SKIP_DIRECTORIES = new Set([
    ".cache",
    ".git",
    ".next",
    ".nx",
    ".output",
    ".svelte-kit",
    ".turbo",
    ".vercel",
    ".vis",
    "build",
    "coverage",
    "dist",
    "node_modules",
]);

/**
 * Recursively collect every `project.json` file under `root`, excluding
 * common build/cache directories. Bounded depth to avoid pathological trees.
 */
const findProjectJsonFiles = (root: string, maxDepth = 8): string[] => {
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

        for (const entry of entries) {
            if (SKIP_DIRECTORIES.has(entry) || entry.startsWith(".")) {
                continue;
            }

            const abs = join(dir, entry);

            let stat;

            try {
                stat = statSync(abs);
            } catch {
                continue;
            }

            if (stat.isDirectory()) {
                walk(abs, depth + 1);
            } else if (entry === "project.json") {
                out.push(abs);
            }
        }
    };

    walk(root, 0);

    return out;
};

/**
 * Translation table for the most common nx-namespaced target executors.
 * Used to suggest replacements when stripping namespaced keys from
 * `targetDefaults`.
 */
const NX_EXECUTOR_HINTS: Record<string, string> = {
    "@nx/eslint:lint": "lint:eslint",
    "@nx/jest:jest": "test",
    "@nx/js:tsc": "build",
    "@nx/next:build": "build",
    "@nx/playwright:playwright": "test:e2e",
    "@nx/storybook:build": "build-storybook",
    "@nx/vite:build": "build",
    "@nx/vite:test": "test",
    "@nx/webpack:webpack": "build",
};

/**
 * Strip namespaced executor keys (anything containing `:`) from `targetDefaults`.
 * vis only understands script-name targets — namespaced keys like `@nx/js:tsc`
 * pass through as broken config otherwise.
 */
const stripNamespacedTargetDefaults = (targetDefaults: Record<string, NxTargetDefault>, report: MigrationReport): Record<string, NxTargetDefault> => {
    const cleaned: Record<string, NxTargetDefault> = {};

    for (const [key, value] of Object.entries(targetDefaults)) {
        if (!key.includes(":")) {
            cleaned[key] = value;
            continue;
        }

        const hint = NX_EXECUTOR_HINTS[key];
        const message = hint
            ? `Dropped \`${key}\` from tasks — vis uses package.json scripts as targets. Move its settings to \`${hint}\` if appropriate.`
            : `Dropped \`${key}\` from tasks — vis only supports script-name targets, not nx-namespaced executors.`;

        report.warnings.push(message);
    }

    return cleaned;
};

const renderVisConfig = (nx: NxJson, workspaceRoot: string, useEditorconfig?: boolean): string => {
    const configObject: Record<string, unknown> = {};

    if (nx.namedInputs && Object.keys(nx.namedInputs).length > 0) {
        configObject.namedInputs = nx.namedInputs;
    }

    if (nx.targetDefaults && Object.keys(nx.targetDefaults).length > 0) {
        configObject.tasks = nx.targetDefaults;
    }

    const serialised = serializeConfigObject(configObject, join(workspaceRoot, "vis.config.ts"), useEditorconfig);

    return [
        "// Migrated from nx.json by `vis migrate nx`.",
        "// Per-project project.json files are compatible with vis and do not need to be rewritten —",
        "// vis already reads targets, tags, implicitDependencies, and sourceRoot.",
        "",
        "import { defineConfig } from \"@visulima/vis/config\";",
        "",
        `export default defineConfig(${serialised});`,
        "",
    ].join("\n");
};

const NX_PROJECT_SCHEMA_RE = /node_modules\/nx\/schemas\/project-schema\.json$/u;

/**
 * Rewrite the `$schema` field on each `project.json` so it points at vis
 * instead of nx. Preserves the relative `../../` depth the original used
 * so the file stays self-checking.
 */
const rewriteProjectJsonSchemas = (
    projectJsonPaths: string[],
    options: { dryRun?: boolean; useEditorconfig?: boolean },
    logger: MigrateLogger,
    report: MigrationReport,
): number => {
    let count = 0;

    for (const filePath of projectJsonPaths) {
        if (options.dryRun) {
            const data = readProjectJsonSafe(filePath);

            if (data?.$schema && NX_PROJECT_SCHEMA_RE.test(data.$schema)) {
                logger.info(`Would rewrite $schema in ${filePath}`);
                count += 1;
            }

            continue;
        }

        const changed = editJsonFile<ProjectJson>(
            filePath,
            (data) => {
                if (!data.$schema || !NX_PROJECT_SCHEMA_RE.test(data.$schema)) {
                    return undefined;
                }

                data.$schema = data.$schema.replace(NX_PROJECT_SCHEMA_RE, "node_modules/@visulima/vis/schemas/project.schema.json");

                return data;
            },
            report,
            { useEditorconfig: options.useEditorconfig },
        );

        if (changed) {
            count += 1;
        }
    }

    if (count > 0) {
        logger.info(`Rewrote $schema in ${String(count)} project.json file(s).`);
    }

    return count;
};

const readProjectJsonSafe = (filePath: string): ProjectJson | undefined => {
    if (!isAccessibleSync(filePath)) {
        return undefined;
    }

    try {
        return JSON.parse(readFileSync(filePath)) as ProjectJson;
    } catch {
        return undefined;
    }
};

interface ProjectNameMap {
    /** Set of every known project.json#name in the workspace. */
    knownProjects: Set<string>;
    /** Map from sibling package.json#name → project.json#name. */
    pkgToProject: Map<string, string>;
}

/**
 * Build a `pkgName → projectName` map by reading each project.json
 * alongside its sibling package.json. Used to translate pnpm `--filter`
 * arguments (which use package names) into vis `--projects=` selectors
 * (which use project names). When the two are identical, no entry is
 * added to the map — the caller falls back to `knownProjects` directly.
 */
const discoverPackageToProjectMap = (projectJsonPaths: string[]): ProjectNameMap => {
    const pkgToProject = new Map<string, string>();
    const knownProjects = new Set<string>();

    for (const projectPath of projectJsonPaths) {
        const projectData = readProjectJsonSafe(projectPath);

        if (!projectData?.name) {
            continue;
        }

        knownProjects.add(projectData.name);

        const pkgPath = join(dirname(projectPath), "package.json");

        if (!isAccessibleSync(pkgPath)) {
            continue;
        }

        try {
            const pkg = JSON.parse(readFileSync(pkgPath)) as { name?: string };

            if (pkg.name && pkg.name !== projectData.name) {
                pkgToProject.set(pkg.name, projectData.name);
            }
        } catch {
            // Unparseable package.json — skip the mapping for this project.
        }
    }

    return { knownProjects, pkgToProject };
};

interface PnpmFilterCommand {
    /** Has shell complexity, quotes, or unrecognised flags — caller should bail. */
    complex: boolean;
    /** Plain-name filter values (no globs, no exclusions). */
    filters: string[];
    /** At least one filter starts with `!` (exclusion) — caller should bail and warn. */
    hasExclusion: boolean;
    /** At least one filter contains glob/path/dependency syntax — caller should bail and warn. */
    hasGlob: boolean;
    /** `--parallel` was present (pnpm: ignore dependency ordering). */
    parallel: boolean;
    /** `-r` / `--recursive` was present. */
    recursive: boolean;
    /** The script target (e.g. `dev`, `build`). Empty when unparseable. */
    target: string;
}

/** Tokens that indicate shell complexity we won't try to rewrite. */
const SHELL_COMPLEX_RE = /&&|\|\||[;|><`]|\$\(/u;

/** Glob/path/dependency-syntax markers in pnpm filter values. */
const FILTER_NON_PLAIN_RE = /[*[\]^.]/u;

const collectFilterValue = (result: PnpmFilterCommand, raw: string): void => {
    if (raw === "") {
        result.complex = true;

        return;
    }

    if (raw.startsWith("!")) {
        result.hasExclusion = true;

        return;
    }

    if (FILTER_NON_PLAIN_RE.test(raw) || raw.includes("...")) {
        result.hasGlob = true;

        return;
    }

    result.filters.push(raw);
};

/**
 * Conservatively parse a `pnpm`-prefixed script string and extract its
 * filter shape. Returns `null` if the script doesn't start with `pnpm`
 * or contains shell complexity (`&amp;&amp;`, pipes, redirects, quotes, etc.).
 *
 * The intent is to translate the common workspace-orchestration cases
 * (`pnpm --filter foo dev`, `pnpm -r run build`) into `vis run` invocations
 * — anything fancier should be left for the user to migrate by hand.
 */
const parsePnpmFilterCommand = (script: string): PnpmFilterCommand | null => {
    if (typeof script !== "string" || script.trim() === "") {
        return null;
    }

    if (SHELL_COMPLEX_RE.test(script) || /['"]/u.test(script)) {
        return null;
    }

    const tokens = script.trim().split(/\s+/u);

    if (tokens[0] !== "pnpm" && tokens[0] !== "pnpm.cmd") {
        return null;
    }

    const result: PnpmFilterCommand = {
        complex: false,
        filters: [],
        hasExclusion: false,
        hasGlob: false,
        parallel: false,
        recursive: false,
        target: "",
    };

    let index = 1;

    while (index < tokens.length) {
        const token = tokens[index] as string;

        if (token === "--filter" || token === "-F") {
            const next = tokens[index + 1];

            if (next === undefined) {
                result.complex = true;

                return result;
            }

            collectFilterValue(result, next);
            index += 2;
            continue;
        }

        if (token.startsWith("--filter=")) {
            collectFilterValue(result, token.slice("--filter=".length));
            index += 1;
            continue;
        }

        if (token.startsWith("-F=")) {
            collectFilterValue(result, token.slice(3));
            index += 1;
            continue;
        }

        if (token === "--parallel") {
            result.parallel = true;
            index += 1;
            continue;
        }

        if (token === "-r" || token === "--recursive") {
            result.recursive = true;
            index += 1;
            continue;
        }

        if (token === "--workspace-root" || token === "-w") {
            // Workspace-root scripts aren't filtered to projects — bail.
            result.complex = true;

            return result;
        }

        if (token === "run" || token === "exec") {
            // `run` is a no-op separator in `pnpm run <target>`.
            // `exec` runs an arbitrary binary — bail.
            if (token === "exec") {
                result.complex = true;

                return result;
            }

            index += 1;
            continue;
        }

        if (token.startsWith("-")) {
            // Unknown flag (e.g. `--silent`, `--reporter=...`) — refuse to rewrite.
            result.complex = true;

            return result;
        }

        result.target = token;
        index += 1;

        if (index < tokens.length) {
            // Extra positional arguments after the target — vis run won't pass them through.
            result.complex = true;
        }

        return result;
    }

    // Walked all tokens without ever hitting a target.
    result.complex = true;

    return result;
};

interface FilterMappingResult {
    mapped: string[];
    unmapped: string[];
}

const mapFiltersToProjects = (filters: ReadonlyArray<string>, nameMap: ProjectNameMap): FilterMappingResult => {
    const mapped: string[] = [];
    const unmapped: string[] = [];

    for (const filter of filters) {
        const direct = nameMap.pkgToProject.get(filter);

        if (direct !== undefined) {
            mapped.push(direct);
            continue;
        }

        if (nameMap.knownProjects.has(filter)) {
            mapped.push(filter);
            continue;
        }

        unmapped.push(filter);
    }

    return { mapped, unmapped };
};

/**
 * Render the rewritten `vis run` form. Only emits `--projects=` when
 * filters were specified; recursive (no filter) calls stay project-wide.
 */
const renderVisRunScript = (parsed: PnpmFilterCommand, mapped: ReadonlyArray<string>): string => {
    const parts = ["vis", "run", parsed.target];

    if (mapped.length > 0) {
        const projects = [...mapped].sort((a, b) => a.localeCompare(b)).join(",");

        parts.push(`--projects=${projects}`);
    }

    return parts.join(" ");
};

interface RewriteResult {
    /** Targets we rewrote at least one script for — feeds persistent-default detection. */
    rewrittenTargets: Set<string>;
    /** Scripts that mention pnpm filters that don't resolve to a known project. */
    unmappedHits: { filters: string[]; script: string }[];
}

/**
 * Long-running task names that imply `persistent: true` + `cache: false`
 * when rewritten via pnpm filter detection. Cacheable build-style tasks
 * are intentionally excluded.
 */
const PERSISTENT_TARGET_NAMES = new Set(["dev", "dev:server", "dev:watch", "serve", "start:dev", "storybook", "watch"]);

/**
 * Walks the root package.json scripts, rewriting `pnpm --filter ... &lt;t>`
 * invocations to `vis run &lt;t> --projects=&lt;csv>` when every filter
 * resolves to a known project. Skips scripts with shell complexity,
 * exclusion filters (`!name`), or glob filters (`@scope/*`) — those are
 * surfaced to the caller as unmapped / non-rewriteable hits.
 */
const applyPnpmFilterScriptRewrites = (
    workspaceRoot: string,
    nameMap: ProjectNameMap,
    options: { dryRun?: boolean; useEditorconfig?: boolean },
    logger: MigrateLogger,
    report: MigrationReport,
): RewriteResult => {
    const result: RewriteResult = { rewrittenTargets: new Set<string>(), unmappedHits: [] };
    const pkgPath = join(workspaceRoot, "package.json");

    if (!isAccessibleSync(pkgPath)) {
        return result;
    }

    let pkgRaw: { scripts?: Record<string, string> } | undefined;

    try {
        pkgRaw = JSON.parse(readFileSync(pkgPath)) as { scripts?: Record<string, string> };
    } catch {
        return result;
    }

    if (!pkgRaw.scripts) {
        return result;
    }

    const planned = new Map<string, string>();

    for (const [name, value] of Object.entries(pkgRaw.scripts)) {
        const parsed = parsePnpmFilterCommand(value);

        if (!parsed || parsed.target === "") {
            continue;
        }

        if (parsed.complex) {
            continue;
        }

        if (parsed.hasExclusion || parsed.hasGlob) {
            // We don't know which projects to keep/drop without evaluating the glob/exclusion.
            // Surface as a manual step rather than a silent no-op.
            report.warnings.push(
                `pnpm filter in scripts.${name} uses ${parsed.hasExclusion ? "an exclusion (!)" : "a glob/dependency selector"} — left untouched. Translate by hand to \`vis run ${parsed.target} --projects=...\` once you decide which projects should be selected.`,
            );

            continue;
        }

        if (parsed.filters.length === 0 && !parsed.recursive) {
            // `pnpm <target>` without -r runs the script in the cwd — not a workspace pattern.
            continue;
        }

        const mapping = mapFiltersToProjects(parsed.filters, nameMap);

        if (mapping.unmapped.length > 0) {
            result.unmappedHits.push({ filters: mapping.unmapped, script: name });
            continue;
        }

        const rewritten = renderVisRunScript(parsed, mapping.mapped);

        if (rewritten !== value) {
            planned.set(name, rewritten);
            result.rewrittenTargets.add(parsed.target);
        }
    }

    if (planned.size === 0) {
        return result;
    }

    if (options.dryRun) {
        for (const [name, rewritten] of planned) {
            const original = pkgRaw.scripts[name];

            logger.info(`Would rewrite scripts.${name}: \`${original ?? ""}\` → \`${rewritten}\``);
        }

        return result;
    }

    editJsonFile<{ scripts?: Record<string, string> }>(
        pkgPath,
        (pkg) => {
            if (!pkg.scripts) {
                return undefined;
            }

            const nextScripts = { ...pkg.scripts };
            let modified = false;

            for (const [name, rewritten] of planned) {
                if (nextScripts[name] !== undefined && nextScripts[name] !== rewritten) {
                    nextScripts[name] = rewritten;
                    modified = true;
                }
            }

            if (!modified) {
                return undefined;
            }

            pkg.scripts = nextScripts;

            return pkg;
        },
        report,
        { useEditorconfig: options.useEditorconfig },
    );

    logger.info(`Rewrote ${String(planned.size)} pnpm-filter script(s) in package.json to use \`vis run\`.`);

    return result;
};

/**
 * Ensure each long-running target referenced by a rewritten pnpm-filter
 * script gets `{ persistent: true, cache: false }` in `targetDefaults`.
 * Mutates `nx` in place so the entry lands in the rendered vis.config.ts.
 */
const ensurePersistentTargetDefaults = (nx: NxJson, rewrittenTargets: ReadonlySet<string>, report: MigrationReport): void => {
    let targetDefaults = nx.targetDefaults ?? {};
    let modified = false;

    for (const target of rewrittenTargets) {
        if (!PERSISTENT_TARGET_NAMES.has(target)) {
            continue;
        }

        const existing: NxTargetDefault = targetDefaults[target] ?? {};
        const next: NxTargetDefault = { ...existing };
        let changedHere = false;

        if (next.persistent !== true) {
            next.persistent = true;
            changedHere = true;
        }

        if (next.cache !== false) {
            next.cache = false;
            changedHere = true;
        }

        if (changedHere) {
            targetDefaults = { ...targetDefaults, [target]: next };
            modified = true;
            report.manualSteps.push(
                `tasks.${target} set to { persistent: true, cache: false } — long-running task auto-detected from rewritten pnpm filter scripts. Adjust if your ${target} is actually short-lived.`,
            );
        }
    }

    if (modified) {
        nx.targetDefaults = targetDefaults;
    }
};

/**
 * A target counts as a no-op `nx:run-script` shim if its executor is
 * `nx:run-script` and its only meaningful option is the script name.
 * These exist purely to register a script with nx — vis reads scripts
 * from `package.json` directly, so the entire `targets` block can be
 * dropped when every entry is one of these shims.
 */
const isNxRunScriptShim = (target: NxProjectTarget): boolean => {
    if (target.executor !== "nx:run-script") {
        return false;
    }

    const optionKeys = Object.keys(target.options ?? {});

    return optionKeys.length === 0 || (optionKeys.length === 1 && optionKeys[0] === "script");
};

interface ProjectTargetReport {
    file: string;
    name: string;
    nonShimTargets: string[];
    syncGenerators: { sync: string[]; target: string }[];
}

/**
 * Translate `targets` blocks in project.json: when every entry is an
 * `nx:run-script` shim, drop the whole block (vis reads package.json
 * scripts directly). Otherwise leave the block in place and surface a
 * punch list of targets needing manual review. Also detects
 * `syncGenerators` keys (#7) and reports them — vis has no equivalent
 * pre-target hook system yet.
 */
const translateProjectJsonTargets = (
    projectJsonPaths: string[],
    options: { dryRun?: boolean; useEditorconfig?: boolean },
    logger: MigrateLogger,
    report: MigrationReport,
): { droppedTargetBlocks: number; punchList: ProjectTargetReport[] } => {
    let droppedTargetBlocks = 0;
    const punchList: ProjectTargetReport[] = [];

    for (const filePath of projectJsonPaths) {
        const data = readProjectJsonSafe(filePath);

        if (!data?.targets || Object.keys(data.targets).length === 0) {
            continue;
        }

        const projectName = data.name ?? "<unnamed>";
        const nonShimTargets: string[] = [];
        const syncGenerators: { sync: string[]; target: string }[] = [];

        for (const [name, target] of Object.entries(data.targets)) {
            if (target.syncGenerators && target.syncGenerators.length > 0) {
                syncGenerators.push({ sync: [...target.syncGenerators], target: name });
            }

            if (!isNxRunScriptShim(target)) {
                nonShimTargets.push(name);
            }
        }

        const allShims = nonShimTargets.length === 0;

        if (allShims) {
            // Safe to drop the entire targets block.
            if (options.dryRun) {
                logger.info(`Would remove targets block from ${filePath} (all entries are nx:run-script shims).`);
                droppedTargetBlocks += 1;
            } else {
                editJsonFile<ProjectJson>(
                    filePath,
                    (current) => {
                        if (!current.targets) {
                            return undefined;
                        }

                        delete current.targets;

                        return current;
                    },
                    report,
                    { useEditorconfig: options.useEditorconfig },
                );

                droppedTargetBlocks += 1;
            }
        } else {
            punchList.push({ file: filePath, name: projectName, nonShimTargets, syncGenerators });
        }

        if (allShims && syncGenerators.length > 0) {
            // Targets block is gone but we still need to surface the syncGenerators.
            punchList.push({ file: filePath, name: projectName, nonShimTargets: [], syncGenerators });
        }
    }

    if (droppedTargetBlocks > 0) {
        logger.info(`Removed targets block from ${String(droppedTargetBlocks)} project.json file(s) (entries were nx:run-script shims).`);
    }

    return { droppedTargetBlocks, punchList };
};

/**
 * Strip `@nx/*` keys from pnpm-workspace.yaml's `catalog` and any named
 * bucket under `catalogs.&lt;name>`, and remove `nx` from
 * `onlyBuiltDependencies`. Mirrors syncpack's catalog cleanup so users
 * don't have to hand-edit YAML after migration.
 */
const cleanPnpmWorkspaceYaml = (
    workspaceRoot: string,
    options: { dryRun?: boolean },
    logger: MigrateLogger,
    report: MigrationReport,
): { catalogEntriesRemoved: number; onlyBuiltRemoved: boolean } => {
    const yamlPath = join(workspaceRoot, "pnpm-workspace.yaml");

    if (!isAccessibleSync(yamlPath)) {
        return { catalogEntriesRemoved: 0, onlyBuiltRemoved: false };
    }

    let parsed: Record<string, unknown> | undefined;

    try {
        parsed = readYamlSync(yamlPath);
    } catch {
        return { catalogEntriesRemoved: 0, onlyBuiltRemoved: false };
    }

    if (!parsed || typeof parsed !== "object") {
        return { catalogEntriesRemoved: 0, onlyBuiltRemoved: false };
    }

    let catalogEntriesRemoved = 0;

    const isNxKey = (key: string): boolean => key === "nx" || key.startsWith("@nx/");

    const stripBucketInto = (bucket: Record<string, unknown> | undefined, parent: Record<string, unknown>, parentKey: string): void => {
        if (!bucket || typeof bucket !== "object") {
            return;
        }

        const before = Object.keys(bucket).length;
        const cleaned = Object.fromEntries(Object.entries(bucket).filter(([key]) => !isNxKey(key)));
        const removed = before - Object.keys(cleaned).length;

        if (removed > 0) {
            catalogEntriesRemoved += removed;
            parent[parentKey] = cleaned;
        }
    };

    stripBucketInto(parsed["catalog"] as Record<string, unknown> | undefined, parsed, "catalog");

    const catalogs = parsed["catalogs"] as Record<string, Record<string, unknown>> | undefined;

    if (catalogs && typeof catalogs === "object") {
        for (const [bucketName, bucket] of Object.entries(catalogs)) {
            stripBucketInto(bucket, catalogs, bucketName);
        }
    }

    let onlyBuiltRemoved = false;
    const onlyBuilt = parsed["onlyBuiltDependencies"];

    if (Array.isArray(onlyBuilt)) {
        const filtered = onlyBuilt.filter((entry) => entry !== "nx");

        if (filtered.length !== onlyBuilt.length) {
            parsed["onlyBuiltDependencies"] = filtered;
            onlyBuiltRemoved = true;
        }
    }

    const modified = catalogEntriesRemoved > 0 || onlyBuiltRemoved;

    if (modified) {
        if (options.dryRun) {
            if (catalogEntriesRemoved > 0) {
                logger.info(`Would remove ${String(catalogEntriesRemoved)} nx-related catalog entr(y/ies) from pnpm-workspace.yaml.`);
            }

            if (onlyBuiltRemoved) {
                logger.info("Would remove `nx` from pnpm-workspace.yaml#onlyBuiltDependencies.");
            }
        } else {
            backupFile(yamlPath, report);
            writeYamlSync(yamlPath, parsed);

            if (catalogEntriesRemoved > 0) {
                logger.info(`Removed ${String(catalogEntriesRemoved)} nx-related catalog entr(y/ies) from pnpm-workspace.yaml.`);
            }

            if (onlyBuiltRemoved) {
                logger.info("Removed `nx` from pnpm-workspace.yaml#onlyBuiltDependencies.");
            }
        }
    }

    return { catalogEntriesRemoved, onlyBuiltRemoved };
};

interface CleanupChecklist {
    eslintHits: string[];
    ignoreFile: boolean;
    nxJson: boolean;
    pkgDevDeps: string[];
    pkgScripts: string[];
    workflowHits: { file: string; reason: string }[];
}

/**
 * Inventory of leftover nx artefacts that the migrator deliberately
 * does NOT auto-remove (too risky, or scoped to tools we don't write).
 * The user gets a numbered checklist printed at the end of the run.
 */
const collectCleanupChecklist = (workspaceRoot: string): CleanupChecklist => {
    const checklist: CleanupChecklist = {
        eslintHits: [],
        ignoreFile: false,
        nxJson: false,
        pkgDevDeps: [],
        pkgScripts: [],
        workflowHits: [],
    };

    if (isAccessibleSync(join(workspaceRoot, "nx.json"))) {
        checklist.nxJson = true;
    }

    if (isAccessibleSync(join(workspaceRoot, ".github/ignore-files-for-nx-affected.yml"))) {
        checklist.ignoreFile = true;
    }

    const pkgPath = join(workspaceRoot, "package.json");

    if (isAccessibleSync(pkgPath)) {
        try {
            const pkg = JSON.parse(readFileSync(pkgPath)) as { devDependencies?: Record<string, string>; scripts?: Record<string, string> };

            if (pkg.devDependencies) {
                for (const dep of Object.keys(pkg.devDependencies)) {
                    if (dep === "nx" || dep.startsWith("@nx/") || dep.startsWith("@nrwl/")) {
                        checklist.pkgDevDeps.push(dep);
                    }
                }
            }

            if (pkg.scripts) {
                for (const [name, value] of Object.entries(pkg.scripts)) {
                    if (typeof value !== "string") {
                        continue;
                    }

                    if (/\bnx\s+(?:run-many|run|affected|exec|reset|repair)\b/u.test(value) || value.startsWith("nx ")) {
                        checklist.pkgScripts.push(name);
                    }
                }
            }
        } catch {
            // Unparseable — skip.
        }
    }

    const workflowsDir = join(workspaceRoot, ".github/workflows");

    if (isAccessibleSync(workflowsDir)) {
        try {
            for (const entry of readdirSync(workflowsDir)) {
                if (!entry.endsWith(".yml") && !entry.endsWith(".yaml")) {
                    continue;
                }

                const abs = join(workflowsDir, entry);
                const content = readFileSync(abs);

                if (/nrwl\/nx-set-shas/u.test(content)) {
                    checklist.workflowHits.push({ file: `.github/workflows/${entry}`, reason: "uses nrwl/nx-set-shas action" });
                }

                if (/\bNX_BRANCH\b|\bNX_RUN_GROUP\b/u.test(content)) {
                    checklist.workflowHits.push({ file: `.github/workflows/${entry}`, reason: "sets NX_BRANCH / NX_RUN_GROUP env" });
                }

                if (/--files=\$\{\{[^}]*tj-actions/u.test(content) || /tj-actions\/changed-files/u.test(content)) {
                    checklist.workflowHits.push({
                        file: `.github/workflows/${entry}`,
                        reason: "uses tj-actions/changed-files (no longer needed; vis does its own affected diff)",
                    });
                }
            }
        } catch {
            // Unreadable — skip.
        }
    }

    // ESLint config: surface stale `@nx/eslint-plugin` rules so the user
    // knows to remove them (we don't rewrite their flat config).
    for (const candidate of ["eslint.config.mjs", "eslint.config.js", "eslint.config.cjs", "eslint.config.ts", ".eslintrc.json", ".eslintrc.js"]) {
        const abs = join(workspaceRoot, candidate);

        if (!isAccessibleSync(abs)) {
            continue;
        }

        const content = readFileSync(abs);

        if (/@nx\/eslint-plugin|@nx\/enforce-module-boundaries|@nx\/dependency-checks|@nx\/nx-plugin-checks/u.test(content)) {
            checklist.eslintHits.push(candidate);
        }
    }

    return checklist;
};

const formatChecklist = (checklist: CleanupChecklist, workspaceRoot: string, options: { backedUpNxJson?: boolean }): string[] => {
    const items: string[] = [];

    if (checklist.nxJson && !options.backedUpNxJson) {
        items.push(`Remove ${join(workspaceRoot, "nx.json")} once you're satisfied with vis.config.ts.`);
    }

    if (checklist.ignoreFile) {
        items.push("Delete .github/ignore-files-for-nx-affected.yml — vis uses git-based affected diff and has no equivalent.");
    }

    if (checklist.pkgDevDeps.length > 0) {
        items.push(`Remove these nx devDependencies from package.json: ${checklist.pkgDevDeps.join(", ")}.`);
    }

    if (checklist.pkgScripts.length > 0) {
        items.push(`Rewrite these package.json scripts to use \`vis run\`: ${checklist.pkgScripts.join(", ")}.`);
    }

    if (checklist.workflowHits.length > 0) {
        const grouped = new Map<string, Set<string>>();

        for (const hit of checklist.workflowHits) {
            const set = grouped.get(hit.file) ?? new Set<string>();

            set.add(hit.reason);
            grouped.set(hit.file, set);
        }

        for (const [file, reasons] of grouped) {
            items.push(`Update ${file}: ${[...reasons].join("; ")}.`);
        }
    }

    if (checklist.eslintHits.length > 0) {
        items.push(
            `Remove @nx/eslint-plugin imports + rules (enforce-module-boundaries, dependency-checks, nx-plugin-checks) from: ${checklist.eslintHits.join(", ")}. There is no vis equivalent yet.`,
        );
    }

    return items.map((item, index) => `${String(index + 1)}. ${item}`);
};

const printChecklist = (lines: string[], logger: MigrateLogger): void => {
    if (lines.length === 0) {
        return;
    }

    logger.info("");
    logger.info("── Post-migrate cleanup ──");

    for (const line of lines) {
        logger.info(line);
    }
};

/**
 * Format a project.json target path as workspace-relative for terser
 * output in punch lists.
 */
const relativeFromRoot = (workspaceRoot: string, abs: string): string => {
    const rel = relative(workspaceRoot, abs);

    return rel.startsWith("..") ? abs : rel.split(sep).join("/");
};

/**
 * Translates an `nx.json` into a `vis.config.ts` and applies the rest of
 * the cleanup the migrator can do safely (project.json $schema rewrite,
 * targets-block stripping, pnpm-workspace.yaml cleanup), then prints a
 * checklist of work that still needs human review.
 * @param workspaceRoot Absolute workspace root path.
 * @param options Migration options.
 * @param options.dryRun When true, render/preview but skip writes.
 * @param options.force Overwrite existing vis.config.ts (a `.bak` is taken first).
 * @param options.useEditorconfig When false, skip `.editorconfig` discovery for indent.
 * @param logger Logger for user feedback.
 * @param report Migration report to append manual steps and warnings.
 */
export const migrateNx = (
    workspaceRoot: string,
    options: { dryRun?: boolean; force?: boolean; useEditorconfig?: boolean },
    logger: MigrateLogger,
    report: MigrationReport,
): void => {
    const nx = readJsonConfig<NxJson>(workspaceRoot, "nx.json");

    if (!nx) {
        logger.warn("No nx.json found in workspace root — nothing to migrate.");
        report.warnings.push("No nx.json at workspace root.");

        return;
    }

    if (nx.targetDefaults) {
        nx.targetDefaults = stripNamespacedTargetDefaults(nx.targetDefaults, report);
    }

    const projectJsonPaths = findProjectJsonFiles(workspaceRoot);
    const nameMap = discoverPackageToProjectMap(projectJsonPaths);

    const rewriteResult = applyPnpmFilterScriptRewrites(workspaceRoot, nameMap, options, logger, report);

    ensurePersistentTargetDefaults(nx, rewriteResult.rewrittenTargets, report);

    for (const hit of rewriteResult.unmappedHits) {
        report.warnings.push(
            `scripts.${hit.script}: pnpm filter(s) ${hit.filters.map((f) => `\`${f}\``).join(", ")} don't match any known project.json#name or sibling package.json#name. Left untouched — fix the filter or add the missing project.json before re-running.`,
        );
    }

    const rendered = renderVisConfig(nx, workspaceRoot, options.useEditorconfig);

    if (!writeVisConfig(workspaceRoot, rendered, options, logger, report)) {
        return;
    }

    rewriteProjectJsonSchemas(projectJsonPaths, options, logger, report);

    const { punchList } = translateProjectJsonTargets(projectJsonPaths, options, logger, report);

    for (const item of punchList) {
        if (item.nonShimTargets.length > 0) {
            report.manualSteps.push(
                `Review targets in ${relativeFromRoot(workspaceRoot, item.file)} (project: ${item.name}) — non-shim targets need manual review: ${item.nonShimTargets.join(", ")}.`,
            );
        }

        for (const sg of item.syncGenerators) {
            report.warnings.push(
                `syncGenerators on \`${item.name}#${sg.target}\` (${relativeFromRoot(workspaceRoot, item.file)}) has no vis equivalent. Move ${sg.sync.join(", ")} into a \`prebuild\` script in package.json or a vis plugin.`,
            );
        }
    }

    cleanPnpmWorkspaceYaml(workspaceRoot, options, logger, report);

    report.manualSteps.push(
        "vis adds two task primitives nx doesn't expose declaratively: `when: { os, env, branch, ci, not.* }` for conditional execution (replaces ad-hoc `configurations`) and `always: true` for finally/teardown tasks that run even when upstream fails. See docs/guides/conditional-and-finally-tasks.mdx.",
    );

    if (nx.affected?.defaultBase || nx.defaultBase) {
        report.manualSteps.push(
            `nx's default base branch (${nx.affected?.defaultBase ?? nx.defaultBase}) is honoured by vis via the --base flag; no vis config change needed.`,
        );
    }

    const checklist = collectCleanupChecklist(workspaceRoot);
    const lines = formatChecklist(checklist, workspaceRoot, {});

    printChecklist(lines, logger);

    // Optional: remove nx.json itself when the user opted into --force.
    // Without --force we leave it on disk so they can compare against the
    // generated vis.config.ts. Either way we surface it in the checklist
    // (above, via collectCleanupChecklist).
    if (options.force && !options.dryRun && checklist.nxJson) {
        const nxJsonPath = join(workspaceRoot, "nx.json");

        backupFile(nxJsonPath, report);

        try {
            unlinkSync(nxJsonPath);
            logger.info(`Removed ${nxJsonPath} (backup at ${nxJsonPath}.bak).`);
        } catch {
            // Non-critical — leave it on disk.
        }
    }
};

// Internal helpers exposed for tests. Not part of the public API.
export {
    applyPnpmFilterScriptRewrites as applyPnpmFilterScriptRewritesForTesting,
    cleanPnpmWorkspaceYaml as cleanPnpmWorkspaceYamlForTesting,
    collectCleanupChecklist as collectCleanupChecklistForTesting,
    discoverPackageToProjectMap as discoverPackageToProjectMapForTesting,
    ensurePersistentTargetDefaults as ensurePersistentTargetDefaultsForTesting,
    findProjectJsonFiles as findProjectJsonFilesForTesting,
    formatChecklist as formatChecklistForTesting,
    isNxRunScriptShim as isNxRunScriptShimForTesting,
    NX_EXECUTOR_HINTS,
    NX_PROJECT_SCHEMA_RE,
    parsePnpmFilterCommand as parsePnpmFilterCommandForTesting,
    PERSISTENT_TARGET_NAMES,
    rewriteProjectJsonSchemas as rewriteProjectJsonSchemasForTesting,
    stripNamespacedTargetDefaults as stripNamespacedTargetDefaultsForTesting,
    translateProjectJsonTargets as translateProjectJsonTargetsForTesting,
};
