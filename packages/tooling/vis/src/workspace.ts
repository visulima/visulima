import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";

import { join, resolve } from "@visulima/path";
import type {
    ProjectConfiguration,
    ProjectGraph,
    ProjectGraphDependency,
    ProjectGraphProjectNode,
    TargetConfiguration,
    WorkspaceConfiguration,
} from "@visulima/task-runner";

interface PackageJson {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    name?: string;
    peerDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
    workspaces?: string[] | { packages: string[] };
}

interface VisConfig {
    /** Target default configurations */
    targetDefaults?: Record<string, Partial<TargetConfiguration>>;
    /** Task runner options */
    taskRunnerOptions?: Record<string, unknown>;
    /** Update command defaults */
    update?: {
        exclude?: string[];
        include?: string[];
        prerelease?: boolean;
        target?: "latest" | "minor" | "patch";
    };
}

// eslint-disable-next-line sonarjs/slow-regex
const TRAILING_SLASH_RE = /\/+$/;
const DOUBLE_GLOB_SUFFIX_RE = /\/\*\*$/;
const NESTED_GLOB_SUFFIX_RE = /\/\*\/\*$/;
const QUOTES_RE = /^['"]|['"]$/g;

/**
 * Reads and parses a JSON file.
 */
const readJsonFile = <T>(filePath: string): T | undefined => {
    try {
        const content = readFileSync(filePath, "utf8");

        return JSON.parse(content) as T;
    } catch {
        return undefined;
    }
};

/**
 * Recursively scans a directory for packages (directories containing package.json).
 */
const scanDirectoryRecursive = (directory: string, relativePath: string, base: string, results: string[]): void => {
    for (const entry of readdirSync(directory)) {
        if (entry === "node_modules" || entry === ".git") {
            continue;
        }

        const fullPath = join(directory, entry);
        const entryRelativePath = relativePath ? `${relativePath}/${entry}` : entry;

        if (statSync(fullPath).isDirectory()) {
            if (existsSync(join(fullPath, "package.json"))) {
                results.push(`${base}/${entryRelativePath}`);
            }

            scanDirectoryRecursive(fullPath, entryRelativePath, base, results);
        }
    }
};

/**
 * Resolves a simple glob pattern like "packages/*" to directories containing package.json.
 */
const resolveSimpleGlob = (workspaceRoot: string, cleanPattern: string, results: string[]): void => {
    const base = cleanPattern.slice(0, -2);
    const baseDirectory = resolve(workspaceRoot, base);

    if (!existsSync(baseDirectory)) {
        return;
    }

    for (const entry of readdirSync(baseDirectory)) {
        const fullPath = join(baseDirectory, entry);

        if (statSync(fullPath).isDirectory() && existsSync(join(fullPath, "package.json"))) {
            results.push(join(base, entry));
        }
    }
};

/**
 * Resolves a double glob pattern like "packages/**" or "packages/ * / *" to directories containing package.json.
 */
const resolveDoubleGlob = (workspaceRoot: string, cleanPattern: string, results: string[]): void => {
    const base = cleanPattern.replace(DOUBLE_GLOB_SUFFIX_RE, "").replace(NESTED_GLOB_SUFFIX_RE, "");
    const baseDirectory = resolve(workspaceRoot, base);

    if (!existsSync(baseDirectory)) {
        return;
    }

    scanDirectoryRecursive(baseDirectory, "", base, results);
};

/**
 * Resolves an exact directory pattern.
 */
const resolveExactDirectory = (workspaceRoot: string, cleanPattern: string, results: string[]): void => {
    const fullPath = resolve(workspaceRoot, cleanPattern);

    if (existsSync(fullPath) && existsSync(join(fullPath, "package.json"))) {
        results.push(cleanPattern);
    }
};

/**
 * Resolves glob-like workspace patterns to actual directories.
 * Supports simple patterns like "packages/*" and "packages/**".
 */
const resolveWorkspacePatterns = (workspaceRoot: string, patterns: string[]): string[] => {
    const directories: string[] = [];

    for (const pattern of patterns) {
        const cleanPattern = pattern.replace(TRAILING_SLASH_RE, "");

        if (cleanPattern.startsWith("!")) {
            continue;
        }

        if (cleanPattern.endsWith("/*")) {
            resolveSimpleGlob(workspaceRoot, cleanPattern, directories);
        } else if (cleanPattern.endsWith("/**") || cleanPattern.endsWith("/*/*")) {
            resolveDoubleGlob(workspaceRoot, cleanPattern, directories);
        } else {
            resolveExactDirectory(workspaceRoot, cleanPattern, directories);
        }
    }

    return directories;
};

/**
 * Reads workspace patterns from pnpm-workspace.yaml (simple parser).
 */
const readPnpmWorkspacePatterns = (workspaceRoot: string): string[] | undefined => {
    const filePath = join(workspaceRoot, "pnpm-workspace.yaml");

    if (!existsSync(filePath)) {
        return undefined;
    }

    const content = readFileSync(filePath, "utf8");
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
 * Reads vis.json configuration file from the workspace root.
 */
const readVisConfig = (workspaceRoot: string): VisConfig => readJsonFile<VisConfig>(join(workspaceRoot, "vis.json")) ?? {};

/**
 * Creates script-based targets from package.json scripts.
 */
const createTargetsFromScripts = (
    scripts: Record<string, string>,
    targetDefaults?: Record<string, Partial<TargetConfiguration>>,
): Record<string, TargetConfiguration> => {
    const targets: Record<string, TargetConfiguration> = {};

    for (const [scriptName, scriptCommand] of Object.entries(scripts)) {
        const defaults = targetDefaults?.[scriptName];

        targets[scriptName] = {
            ...defaults,
            command: scriptCommand,
        };
    }

    return targets;
};

/**
 * Discovers all projects in the workspace and builds a WorkspaceConfiguration.
 */
const discoverWorkspace = (workspaceRoot: string): { config: VisConfig; workspace: WorkspaceConfiguration } => {
    const config = readVisConfig(workspaceRoot);
    const projects: Record<string, ProjectConfiguration> = {};

    // Find workspace patterns
    const pnpmPatterns = readPnpmWorkspacePatterns(workspaceRoot);
    const rootPkg = readJsonFile<PackageJson>(join(workspaceRoot, "package.json"));

    let workspacePatterns: string[] | undefined;

    if (pnpmPatterns) {
        workspacePatterns = pnpmPatterns;
    } else if (rootPkg?.workspaces) {
        workspacePatterns = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : rootPkg.workspaces.packages;
    }

    if (!workspacePatterns) {
        throw new Error("No workspace configuration found. Expected pnpm-workspace.yaml or package.json workspaces field.");
    }

    // Resolve patterns to actual project directories
    const projectDirectories = resolveWorkspacePatterns(workspaceRoot, workspacePatterns);

    for (const projectDirectory of projectDirectories) {
        const packageJsonPath = join(workspaceRoot, projectDirectory, "package.json");
        const pkg = readJsonFile<PackageJson>(packageJsonPath);

        if (!pkg?.name) {
            continue;
        }

        // Check for project.json for additional configuration
        const projectJsonPath = join(workspaceRoot, projectDirectory, "project.json");
        const projectJson = readJsonFile<{ projectType?: "application" | "library"; sourceRoot?: string; tags?: string[] }>(projectJsonPath);

        const targets = pkg.scripts ? createTargetsFromScripts(pkg.scripts, config.targetDefaults) : {};

        projects[pkg.name] = {
            projectType: projectJson?.projectType ?? "library",
            root: projectDirectory,
            sourceRoot: projectJson?.sourceRoot ?? `${projectDirectory}/src`,
            tags: projectJson?.tags,
            targets,
        };
    }

    return { config, workspace: { projects } };
};

/**
 * Builds the project dependency graph from package.json dependencies.
 */
const buildProjectGraph = (workspaceRoot: string, workspace: WorkspaceConfiguration): ProjectGraph => {
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

        // Read the package.json to find dependencies
        const pkg = readJsonFile<PackageJson>(join(workspaceRoot, config.root, "package.json"));

        if (!pkg) {
            continue;
        }

        const allDeps = {
            ...pkg.dependencies,
            ...pkg.devDependencies,
            ...pkg.peerDependencies,
        };

        for (const depName of Object.keys(allDeps)) {
            if (projectNames.has(depName)) {
                dependencies[name]?.push({
                    source: name,
                    target: depName,
                    type: "static",
                });
            }
        }
    }

    return { dependencies, nodes };
};

/**
 * Finds the workspace root by searching up for pnpm-workspace.yaml or a root package.json with workspaces.
 */
const findWorkspaceRoot = (startDirectory: string): string => {
    let current = resolve(startDirectory);

    while (current !== "/") {
        if (existsSync(join(current, "pnpm-workspace.yaml"))) {
            return current;
        }

        const pkg = readJsonFile<PackageJson>(join(current, "package.json"));

        if (pkg?.workspaces) {
            return current;
        }

        const parent = resolve(current, "..");

        if (parent === current) {
            break;
        }

        current = parent;
    }

    throw new Error("Could not find workspace root. Expected pnpm-workspace.yaml or package.json with workspaces.");
};

export type { PackageJson, VisConfig };
export { buildProjectGraph, discoverWorkspace, findWorkspaceRoot, readVisConfig, resolveWorkspacePatterns };
