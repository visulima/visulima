import { join } from "@visulima/path";

import { readPackageDeps } from "./utils";

/**
 * Detected framework information.
 */
interface DetectedFramework {
    /** The env var prefix(es) that should be included in task hashes */
    envPrefixes: string[];
    /** The framework name */
    name: string;
}

/**
 * Known framework definitions with their package identifiers and env var prefixes.
 */
const FRAMEWORK_DEFINITIONS: ReadonlyArray<{
    envPrefixes: string[];
    name: string;
    packages: string[];
}> = [
    {
        envPrefixes: ["NEXT_PUBLIC_"],
        name: "Next.js",
        packages: ["next"],
    },
    {
        envPrefixes: ["VITE_"],
        name: "Vite",
        packages: ["vite"],
    },
    {
        envPrefixes: ["REACT_APP_"],
        name: "Create React App",
        packages: ["react-scripts"],
    },
    {
        envPrefixes: ["GATSBY_"],
        name: "Gatsby",
        packages: ["gatsby"],
    },
    {
        envPrefixes: ["NUXT_PUBLIC_"],
        name: "Nuxt",
        packages: ["nuxt", "nuxt3"],
    },
    {
        envPrefixes: ["EXPO_PUBLIC_"],
        name: "Expo",
        packages: ["expo"],
    },
    {
        envPrefixes: ["REMIX_PUBLIC_"],
        name: "Remix",
        packages: ["@remix-run/react", "@remix-run/node"],
    },
    {
        // KNOWN FOOTGUN: `PUBLIC_` is an extremely broad, non-namespaced
        // prefix. When framework inference is enabled, every `PUBLIC_*`
        // env var folds into the task hash, so unrelated `PUBLIC_*` vars
        // bust the cache for any project depending on astro. SvelteKit
        // only treats `PUBLIC_` vars as public when accessed via
        // `$env/static/public`, but we can't see access sites from
        // package.json alone — the over-broad match is intentional and
        // errs toward correctness over cache hit rate.
        envPrefixes: ["PUBLIC_"],
        name: "Astro",
        packages: ["astro"],
    },
    {
        // See the Astro note above — same `PUBLIC_` over-broad-match
        // caveat applies to SvelteKit.
        envPrefixes: ["PUBLIC_"],
        name: "SvelteKit",
        packages: ["@sveltejs/kit"],
    },
    {
        envPrefixes: ["VITE_"],
        name: "Solid Start",
        packages: ["@solidjs/start", "solid-start"],
    },
];

/**
 * Detects frameworks used in a project by inspecting its package.json dependencies.
 * @param packageJsonPath Absolute path to the package.json file
 * @returns Array of detected frameworks with their env prefixes
 */
const detectFrameworks = async (packageJsonPath: string): Promise<DetectedFramework[]> => {
    const allDeps = await readPackageDeps(packageJsonPath, { optional: false, peer: false });

    if (!allDeps) {
        return [];
    }

    const detected: DetectedFramework[] = [];

    for (const framework of FRAMEWORK_DEFINITIONS) {
        if (framework.packages.some((pkg) => allDeps.has(pkg))) {
            detected.push({
                envPrefixes: framework.envPrefixes,
                name: framework.name,
            });
        }
    }

    return detected;
};

/**
 * Detects frameworks across all projects in a workspace and returns
 * the env var patterns that should be included in task hashes.
 * @param workspaceRoot The workspace root directory
 * @param projects Map of project name to project configuration with root paths
 * @returns Array of env var wildcard patterns (e.g., ["NEXT_PUBLIC_*", "VITE_*"])
 */
const inferFrameworkEnvPatterns = async (workspaceRoot: string, projects: Record<string, { root: string }>): Promise<string[]> => {
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
    return [...allPrefixes].toSorted().map((prefix) => `${prefix}*`);
};

/**
 * For a specific project, detects frameworks and returns the matching
 * env vars from the current environment.
 * @param packageJsonPath Absolute path to the project's package.json
 * @param env The current environment variables
 * @returns Map of env var name to value for matching framework env vars
 */
const getFrameworkEnvVariables = async (packageJsonPath: string, env: Record<string, string | undefined> = process.env): Promise<Record<string, string>> => {
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

export type { DetectedFramework };
export { detectFrameworks, getFrameworkEnvVariables, inferFrameworkEnvPatterns };
