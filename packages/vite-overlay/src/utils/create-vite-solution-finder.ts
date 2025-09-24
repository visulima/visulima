import fs from "node:fs";
import path from "node:path";

import type { Solution, SolutionFinder } from "@visulima/error/solution";
import { distance } from "fastest-levenshtein";

const MAX_SEARCH_DEPTH = 4;
const MAX_FILES_TO_SEARCH = 1000;
const MAX_SUGGESTIONS = 5;
const NAME_SIMILARITY_THRESHOLD = 0.5;

const SCRIPT_EXTENSIONS = [".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs"];
const STYLE_EXTENSIONS = [".css", ".scss", ".sass", ".less"];
const ASSET_EXTENSIONS = [".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico"];
const RELEVANT_EXTENSIONS = new Set([...ASSET_EXTENSIONS, ...SCRIPT_EXTENSIONS, ...STYLE_EXTENSIONS]);

interface FileCandidate {
    baseName: string;
    extension: string;
    fullPath: string;
    path: string;
    relevanceScore: number;
}

const has = (message: string, ...needles: string[]): boolean => {
    const lower = message.toLowerCase();

    return needles.some((n) => lower.includes(n.toLowerCase()));
};

/**
 * Gets the relative path from one directory to another, ensuring it starts with './' if needed.
 * @param fromDirectory The source directory
 * @param toPath The target path
 * @returns The relative path string
 */
const getRelativePath = (fromDirectory: string, toPath: string): string => {
    const relativePath = path.relative(fromDirectory, toPath);

    return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
};

/**
 * Gets a human-readable description of the path distance for file suggestions.
 * @param pathDistance The number of directory levels away
 * @returns A descriptive string about the path location
 */
const getPathContext = (pathDistance: number): string => {
    if (pathDistance === 0) {
        return "";
    }

    if (pathDistance === 1) {
        return " (in parent directory)";
    }

    if (pathDistance === 2) {
        return " (in grandparent directory)";
    }

    return ` (${pathDistance} directories away)`;
};

/**
 * Calculates the distance between two directories based on their path relationship.
 * @param fromDirectory The source directory
 * @param toDirectory The target directory
 * @returns The calculated path distance
 */
const calculatePathDistance = (fromDirectory: string, toDirectory: string): number => {
    try {
        const relativePath = path.relative(fromDirectory, toDirectory);
        const segments = relativePath.split(path.sep).filter((s) => s && s !== ".");

        let pathDistance = 0;

        for (const segment of segments) {
            pathDistance += segment === ".." ? 2 : 1;
        }

        return pathDistance;
    } catch {
        return 10;
    }
};

/**
 * Calculates how relevant a file is as a suggestion for a failed import.
 * @param importBaseName The base name of the import being attempted
 * @param importExtension The extension of the import being attempted
 * @param baseName The base name of the candidate file
 * @param fileExtension The extension of the candidate file
 * @returns A relevance score (higher is better)
 */
const calculateRelevanceScore = (importBaseName: string, importExtension: string, baseName: string, fileExtension: string): number => {
    if (importExtension && fileExtension === importExtension) {
        const nameDistance = distance(importBaseName, baseName);

        return nameDistance <= Math.max(3, Math.floor(importBaseName.length * NAME_SIMILARITY_THRESHOLD)) ? 10 - nameDistance : 0;
    }

    if (!importExtension) {
        const nameDistance = distance(importBaseName, baseName);

        if (nameDistance === 0) {
            return 9;
        }

        if (nameDistance <= Math.max(2, Math.floor(importBaseName.length * 0.3)) && RELEVANT_EXTENSIONS.has(fileExtension)) {
            return 7 - nameDistance;
        }

        return 0;
    }

    const nameDistance = distance(importBaseName, baseName);

    return nameDistance <= Math.max(2, Math.floor(importBaseName.length * 0.4)) ? 5 - nameDistance : 0;
};

/**
 * Collects file candidates that could match a failed import by walking the directory tree.
 * @param rootDirectory The root directory to search from
 * @param importBaseName The base name of the import being attempted
 * @param importExtension The extension of the import being attempted
 * @returns Array of file candidates with relevance scores
 */
const collectFileCandidates = (rootDirectory: string, importBaseName: string, importExtension: string): FileCandidate[] => {
    const candidates: FileCandidate[] = [];

    const walk = (directory: string, depth = 0): void => {
        if (depth > MAX_SEARCH_DEPTH || candidates.length > MAX_FILES_TO_SEARCH) {
            return;
        }

        try {
            const entries = fs.readdirSync(directory, { withFileTypes: true });

            for (const entry of entries) {
                if (candidates.length > MAX_FILES_TO_SEARCH)
                    break;

                const fullPath = path.join(directory, entry.name);

                if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
                    walk(fullPath, depth + 1);
                } else if (entry.isFile()) {
                    const extension = path.extname(entry.name);
                    const baseName = path.basename(entry.name, extension);
                    const score = calculateRelevanceScore(importBaseName, importExtension, baseName, extension);

                    if (score > 0) {
                        candidates.push({
                            baseName,
                            extension,
                            fullPath,
                            path: fullPath,
                            relevanceScore: score,
                        });
                    }
                }
            }
        } catch {
            // Skip directories we can't read
        }
    };

    walk(rootDirectory);

    return candidates;
};

/**
 * Finds similar files to a failed import and generates HTML suggestions.
 * @param importPath The import path that failed
 * @param fromFile The file that attempted the import
 * @param rootDirectory The root directory to search from
 * @returns HTML string with file suggestions
 */
const findSimilarFiles = (importPath: string, fromFile: string, rootDirectory: string): string => {
    const importName = path.basename(importPath);
    const importExtension = path.extname(importName);
    const importBaseName = path.basename(importName, importExtension);

    const fromDirectory = path.dirname(fromFile);

    const candidates = collectFileCandidates(rootDirectory, importBaseName, importExtension);

    const scoredFiles = candidates.map((candidate) => {
        const nameDistance = distance(importBaseName, candidate.baseName);
        const pathDistance = calculatePathDistance(fromDirectory, path.dirname(candidate.fullPath));

        const score = candidate.relevanceScore * 0.7 + pathDistance * 0.2 + nameDistance * 0.1;

        return { ...candidate, nameDistance, pathDistance, score };
    });

    scoredFiles.sort((a, b) => a.score - b.score);

    const suggestions: string[] = [];
    const topMatches = scoredFiles.slice(0, 8);
    let hasPublicFileSuggestions = false;

    for (const match of topMatches) {
        const suggestionPath = getRelativePath(fromDirectory, match.fullPath);

        if (!suggestions.includes(suggestionPath)) {
            const context = getPathContext(match.pathDistance);

            suggestions.push(suggestionPath + context);

            const normalizedPath = match.fullPath.replaceAll("\\", "/");
            const pathSegments = normalizedPath.split("/");
            const publicIndex = pathSegments.indexOf("public");

            if (publicIndex !== -1 && publicIndex < pathSegments.length - 1) {
                hasPublicFileSuggestions = true;
            }
        }
    }

    let finalSuggestions = `<ul>${[...new Set(suggestions)]
        .slice(0, MAX_SUGGESTIONS)
        .map((suggestion) => `<li>\`${suggestion}\`</li>`)
        .join("\n")}</ul>`;

    if (hasPublicFileSuggestions) {
        const publicFileName = importName;

        const isAssetFile = [...ASSET_EXTENSIONS].some((extension) => publicFileName.includes(extension));

        if (isAssetFile) {
            finalSuggestions += `Files in the \`public\` folder should be accessed via absolute URLs like \`/${publicFileName}\`.`;
        }
    }

    return finalSuggestions;
};

const ERROR_PATTERNS = [
    {
        solution: {
            body: "Browser APIs like `window` and `document` are not available during server-side rendering. Use dynamic imports or check for SSR environment before using browser APIs.",
            header: "SSR Browser API Error",
        },
        test: (message: string) => has(message, "window is not defined", "document is not defined"),
    },
    {
        solution: {
            body: "Some plugins need specific ordering. Use `enforce: 'pre'` for plugins that need to run first, or `enforce: 'post'` for plugins that need to run last.",
            header: "Plugin Ordering Issue",
        },
        test: (message: string) => has(message, "Plugin ordering", "enforce"),
    },
    {
        solution: {
            body: "CSS Modules require proper configuration. Make sure your CSS files use the `.module.css` extension and are imported correctly.",
            header: "CSS Modules Configuration",
        },
        test: (message: string) => has(message, "CSS Modules", "module.css"),
    },
    {
        solution: {
            body: [
                "Only variables prefixed with `VITE_` are exposed on `import.meta.env` to the client at build time.",
                "Server-only variables should not be prefixed with `VITE_`.",
                "- Do not use `process.env` in browser code; prefer `import.meta.env.*`",
                "- Custom vars must be prefixed with `VITE_` to be exposed to client",
                "- For TS, add `/// <reference types=\"vite/client\" />` for type-safe access",
            ].join("\n"),
            header: "Environment Variables",
        },
        test: (message: string) => has(message, "VITE_", "process.env"),
    },
    {
        solution: {
            body: "For static assets, use the `new URL('./path/to/asset', import.meta.url)` syntax or import them and use the returned URL.",
            header: "Asset Import Issue",
        },
        test: (message: string) => has(message, "Failed to load") && has(message, ".png", ".jpg", ".svg"),
    },
    {
        solution: {
            body: "Some issues only occur in production builds. Check if the error happens in development mode. You might need different configurations for build vs dev.",
            header: "Build vs Development Mode",
        },
        test: (message: string) => has(message, "production", "build"),
    },
    {
        solution: {
            body: "HMR issues can occur with certain patterns. Make sure you're not mutating module-level variables and consider using `import.meta.hot` guards.",
            header: "Hot Module Replacement Issue",
        },
        test: (message: string) => has(message, "HMR", "hot reload"),
    },
    {
        solution: {
            body: "Check your `tsconfig.json` and make sure it includes proper paths and compiler options. For Vite, you might need a `vite-env.d.ts` file.",
            header: "TypeScript Configuration",
        },
        test: (message: string, file?: string) => has(message, "TypeScript") || (file && file.endsWith(".ts")),
    },
    {
        solution: {
            body: "Some dependencies need to be excluded from pre-bundling. Add them to `optimizeDeps.exclude` in your Vite config.",
            header: "Dependency Optimization",
        },
        test: (message: string) => has(message, "optimizeDeps", "pre-bundling"),
    },
    {
        solution: {
            body: "Configure path aliases in your Vite config using the `resolve.alias` option to match your TypeScript path mappings.",
            header: "Path Resolution",
        },
        test: (message: string) => has(message, "resolve.alias", "Cannot find module"),
    },
    {
        solution: {
            body: "Server middleware and proxy settings should be configured in the `server` section of your Vite config.",
            header: "Server Configuration",
        },
        test: (message: string) => has(message, "middleware", "proxy"),
    },
    {
        solution: {
            body: "Check your plugin configuration in `vite.config.js/ts`. Make sure all required options are provided and options are correctly typed.",
            header: "Plugin Configuration",
        },
        test: (message: string) => has(message, "plugin", "configuration"),
    },
    {
        solution: {
            body: "Configure your build output directory using `build.outDir` in your Vite config. Make sure the directory is writable.",
            header: "Build Output Configuration",
        },
        test: (message: string) => has(message, "build.outDir", "dist"),
    },
    // React
    {
        solution: {
            body: [
                "Client and server rendered markup differ.",
                "",
                "Checklist:",
                "- A server/client branch `if (typeof window !== 'undefined')`.",
                "- Variable input such as `Date.now()` or `Math.random()` which changes each time it's called.",
                "- Date formatting in a user's locale which doesn't match the server.",
                "- External changing data without sending a snapshot of it along with the HTML.",
                "- Invalid HTML tag nesting.",
                "",
                "It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.",
                "",
                "https://react.dev/link/hydration-mismatch",
            ].join("\n"),
        },
        test: (message: string) => has(message, "hydration failed", "did not match", "expected server html", "text content does not match"),
    },
] as const;

/**
 * Creates a solution finder specifically designed for Vite-related errors.
 * Provides intelligent suggestions for common Vite import resolution and configuration issues.
 * @param rootPath The root path of the project
 * @returns A solution finder object for Vite-specific error handling
 */
const createViteSolutionFinder = (rootPath: string): SolutionFinder => {
    return {
        // eslint-disable-next-line sonarjs/cognitive-complexity
        async handle(error, context): Promise<Solution | undefined> {
            const { file, language } = context;
            const message = error.message ?? "";

            // 1. Import resolution errors with file suggestions
            if (has(message, "Failed to resolve import", "Cannot resolve module")) {
                // Extract the import path from the error message
                const importMatch = message.match(/Failed to resolve import ["']([^"']+)["']/);
                const moduleMatch = message.match(/Cannot resolve module ["']([^"']+)["']/);

                const importPath = importMatch?.[1] || moduleMatch?.[1];

                if (importPath && file) {
                    const suggestions = findSimilarFiles(importPath, file, rootPath);

                    if (suggestions) {
                        return {
                            body: `The import path \`${importPath}\` could not be resolved.<br/><br/>Did you mean one of these files?<br/>${suggestions}`,
                        };
                    }

                    // Check for common plugin issues
                    if ([".jsx", ".tsx"].includes(language as string) || has(message, "react")) {
                        return {
                            body: "Install and configure the React plugin. Add `@vitejs/plugin-react` to your dependencies and include it in your Vite config.",
                            header: "Missing React Plugin",
                        };
                    }

                    if (language === "vue") {
                        return {
                            body: "Install and configure the Vue plugin. Add `@vitejs/plugin-vue` to your dependencies and include it in your Vite config.",
                            header: "Missing Vue Plugin",
                        };
                    }
                }
            }

            // Check relative import issues with file extension
            if (has(message, "Cannot resolve") && (language === "typescript" || language === "javascript")) {
                const relativeImportMatch = message.match(/Cannot resolve ["'](\.\.?\/[^"']*)["']/);

                if (relativeImportMatch) {
                    const importPath = relativeImportMatch[1];

                    if (importPath && file) {
                        const suggestions = findSimilarFiles(importPath, file, rootPath);

                        if (suggestions) {
                            return {
                                body: `Cannot resolve \`${importPath}\`. Did you mean one of these files?${suggestions}`,
                                header: "File Not Found",
                            };
                        }
                    }
                }

                return {
                    body: "In Vite, you may need to include file extensions in imports, especially for TypeScript files. Try adding `.js` extension to your imports.",
                    header: "Missing File Extension",
                };
            }

            // Check common error patterns
            for (const pattern of ERROR_PATTERNS) {
                if (pattern.test(message, file)) {
                    return pattern.solution;
                }
            }

            return undefined; // No solution found
        },
        name: "vite-solution-finder",
        priority: 20, // Higher priority than general finders
    };
};

/**
 * Default export for creating Vite solution finders.
 * @see createViteSolutionFinder
 */
export default createViteSolutionFinder;
