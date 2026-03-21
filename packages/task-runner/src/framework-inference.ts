import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Detected framework information.
 */
export interface DetectedFramework {
    /** The framework name */
    name: string;
    /** The env var prefix(es) that should be included in task hashes */
    envPrefixes: string[];
}

/**
 * Known framework definitions with their package identifiers and env var prefixes.
 */
const FRAMEWORK_DEFINITIONS: ReadonlyArray<{
    name: string;
    packages: string[];
    envPrefixes: string[];
}> = [
    {
        name: "Next.js",
        packages: ["next"],
        envPrefixes: ["NEXT_PUBLIC_"],
    },
    {
        name: "Vite",
        packages: ["vite"],
        envPrefixes: ["VITE_"],
    },
    {
        name: "Create React App",
        packages: ["react-scripts"],
        envPrefixes: ["REACT_APP_"],
    },
    {
        name: "Gatsby",
        packages: ["gatsby"],
        envPrefixes: ["GATSBY_"],
    },
    {
        name: "Nuxt",
        packages: ["nuxt", "nuxt3"],
        envPrefixes: ["NUXT_PUBLIC_"],
    },
    {
        name: "Expo",
        packages: ["expo"],
        envPrefixes: ["EXPO_PUBLIC_"],
    },
    {
        name: "Remix",
        packages: ["@remix-run/react", "@remix-run/node"],
        envPrefixes: ["REMIX_PUBLIC_"],
    },
    {
        name: "Astro",
        packages: ["astro"],
        envPrefixes: ["PUBLIC_"],
    },
    {
        name: "SvelteKit",
        packages: ["@sveltejs/kit"],
        envPrefixes: ["PUBLIC_"],
    },
    {
        name: "Solid Start",
        packages: ["@solidjs/start", "solid-start"],
        envPrefixes: ["VITE_"],
    },
];

/**
 * Detects frameworks used in a project by inspecting its package.json dependencies.
 *
 * @param packageJsonPath - Absolute path to the package.json file
 * @returns Array of detected frameworks with their env prefixes
 */
export const detectFrameworks = async (
    packageJsonPath: string,
): Promise<DetectedFramework[]> => {
    try {
        const content = await readFile(packageJsonPath, "utf-8");
        const pkg = JSON.parse(content) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
        };

        const allDeps = new Set<string>([
            ...Object.keys(pkg.dependencies ?? {}),
            ...Object.keys(pkg.devDependencies ?? {}),
        ]);

        const detected: DetectedFramework[] = [];

        for (const framework of FRAMEWORK_DEFINITIONS) {
            if (framework.packages.some((pkg) => allDeps.has(pkg))) {
                detected.push({
                    name: framework.name,
                    envPrefixes: framework.envPrefixes,
                });
            }
        }

        return detected;
    } catch {
        return [];
    }
};

/**
 * Detects frameworks across all projects in a workspace and returns
 * the env var patterns that should be included in task hashes.
 *
 * @param workspaceRoot - The workspace root directory
 * @param projects - Map of project name to project configuration with root paths
 * @returns Array of env var wildcard patterns (e.g., ["NEXT_PUBLIC_*", "VITE_*"])
 */
export const inferFrameworkEnvPatterns = async (
    workspaceRoot: string,
    projects: Record<string, { root: string }>,
): Promise<string[]> => {
    const allPrefixes = new Set<string>();

    const detectionPromises = Object.values(projects).map(async (project) => {
        const packageJsonPath = join(workspaceRoot, project.root, "package.json");
        const frameworks = await detectFrameworks(packageJsonPath);

        for (const fw of frameworks) {
            for (const prefix of fw.envPrefixes) {
                allPrefixes.add(prefix);
            }
        }
    });

    await Promise.all(detectionPromises);

    // Convert prefixes to wildcard patterns
    return [...allPrefixes].sort().map((prefix) => `${prefix}*`);
};

/**
 * For a specific project, detects frameworks and returns the matching
 * env vars from the current environment.
 *
 * @param packageJsonPath - Absolute path to the project's package.json
 * @param env - The current environment variables
 * @returns Map of env var name to value for matching framework env vars
 */
export const getFrameworkEnvVars = async (
    packageJsonPath: string,
    env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): Promise<Record<string, string>> => {
    const frameworks = await detectFrameworks(packageJsonPath);
    const result: Record<string, string> = {};

    for (const framework of frameworks) {
        for (const prefix of framework.envPrefixes) {
            for (const [key, value] of Object.entries(env)) {
                if (key.startsWith(prefix) && value !== undefined) {
                    result[key] = value;
                }
            }
        }
    }

    return result;
};
