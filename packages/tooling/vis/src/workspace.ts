import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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
}

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
 * Resolves glob-like workspace patterns to actual directories.
 * Supports simple patterns like "packages/*" and "packages/**".
 */
const resolveWorkspacePatterns = (workspaceRoot: string, patterns: string[]): string[] => {
    const directories: string[] = [];

    for (const pattern of patterns) {
        // Remove trailing slash
        const cleanPattern = pattern.replace(/\/+$/, "");

        // Skip negation patterns
        if (cleanPattern.startsWith("!")) {
            continue;
        }

        // Handle simple glob: "packages/*"
        if (cleanPattern.endsWith("/*")) {
            const base = cleanPattern.slice(0, -2);
            const baseDir = resolve(workspaceRoot, base);

            if (existsSync(baseDir)) {
                for (const entry of readdirSync(baseDir)) {
                    const fullPath = join(baseDir, entry);

                    if (statSync(fullPath).isDirectory() && existsSync(join(fullPath, "package.json"))) {
                        directories.push(join(base, entry));
                    }
                }
            }
        }
        // Handle double glob: "packages/**" or "packages/*/*"
        else if (cleanPattern.endsWith("/**") || cleanPattern.endsWith("/*/*")) {
            const base = cleanPattern.replace(/\/\*\*$/, "").replace(/\/\*\/\*$/, "");
            const baseDir = resolve(workspaceRoot, base);

            if (existsSync(baseDir)) {
                const scanDir = (dir: string, relativePath: string): void => {
                    for (const entry of readdirSync(dir)) {
                        if (entry === "node_modules" || entry === ".git") {
                            continue;
                        }

                        const fullPath = join(dir, entry);
                        const relPath = relativePath ? `${relativePath}/${entry}` : entry;

                        if (statSync(fullPath).isDirectory()) {
                            if (existsSync(join(fullPath, "package.json"))) {
                                directories.push(`${base}/${relPath}`);
                            }

                            scanDir(fullPath, relPath);
                        }
                    }
                };

                scanDir(baseDir, "");
            }
        }
        // Exact directory
        else {
            const fullPath = resolve(workspaceRoot, cleanPattern);

            if (existsSync(fullPath) && existsSync(join(fullPath, "package.json"))) {
                directories.push(cleanPattern);
            }
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
                // Remove quotes if present
                const pattern = trimmed.slice(2).replace(/^['"]|['"]$/g, "");

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
const readVisConfig = (workspaceRoot: string): VisConfig => {
    return readJsonFile<VisConfig>(join(workspaceRoot, "vis.json")) ?? {};
};

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
    const projectDirs = resolveWorkspacePatterns(workspaceRoot, workspacePatterns);

    for (const projectDir of projectDirs) {
        const packageJsonPath = join(workspaceRoot, projectDir, "package.json");
        const pkg = readJsonFile<PackageJson>(packageJsonPath);

        if (!pkg?.name) {
            continue;
        }

        // Check for project.json for additional configuration
        const projectJsonPath = join(workspaceRoot, projectDir, "project.json");
        const projectJson = readJsonFile<{ projectType?: "application" | "library"; sourceRoot?: string; tags?: string[] }>(projectJsonPath);

        const targets = pkg.scripts ? createTargetsFromScripts(pkg.scripts, config.targetDefaults) : {};

        projects[pkg.name] = {
            projectType: projectJson?.projectType ?? "library",
            root: projectDir,
            sourceRoot: projectJson?.sourceRoot ?? `${projectDir}/src`,
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
const findWorkspaceRoot = (startDir: string): string => {
    let current = resolve(startDir);

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
