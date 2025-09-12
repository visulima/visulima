import type { Solution, SolutionFinder, SolutionFinderFile } from "@visulima/error/solution";

type RuleMatch = {
    md: string;
    priority?: number;
    title: string;
};

type Rule = {
    name: string;
    test: (error: Error, file: SolutionFinderFile) => RuleMatch | undefined;
};

const js = (s: string): string => `\`\`\`js\n${s.trim()}\n\`\`\``;
const ts = (s: string): string => `\`\`\`ts\n${s.trim()}\n\`\`\``;
const bash = (s: string): string => `\`\`\`bash\n${s.trim()}\n\`\`\``;

const has = (message: string, ...needles: string[]): boolean => {
    const lower = message.toLowerCase();

    return needles.some((n) => lower.includes(n.toLowerCase()));
};

// Vite-specific error rules
const viteRules: Rule[] = [
    {
        name: "vite-hmr-invalid-update",
        test: (error): RuleMatch | undefined => {
            const message = (error?.message || String(error || "")).toString();

            if (has(message, "hmr", "hot reload", "invalid update", "cannot accept update")) {
                return {
                    md: [
                        "Hot Module Replacement (HMR) update failed.",
                        "",
                        "Common causes:",
                        "• Syntax errors preventing module updates",
                        "• Component state not preserved during HMR",
                        "• CSS modules with conflicting class names",
                        "• File watchers not picking up changes",
                        "",
                        "Try:",
                        "• Check browser console for syntax errors",
                        "• Save file again to trigger full reload",
                        "• Restart dev server if HMR is stuck",
                        "• Check for circular dependencies",
                    ].join("\n"),
                    title: "HMR Update Failed",
                };
            }

            return undefined;
        },
    },
    {
        name: "vite-plugin-error",
        test: (error): RuleMatch | undefined => {
            const message = (error?.message || String(error || "")).toString();

            if (has(message, "vite plugin", "plugin error", "@vitejs/plugin")) {
                return {
                    md: [
                        "A Vite plugin encountered an error.",
                        "",
                        "Common issues:",
                        "• Plugin configuration errors",
                        "• Plugin version conflicts",
                        "• Missing plugin dependencies",
                        "• Plugin not compatible with current Vite version",
                        "",
                        "Check:",
                        "• Plugin documentation and configuration",
                        "• Plugin GitHub issues for similar errors",
                        "• Try disabling the plugin temporarily",
                        "• Update plugin to latest version",
                    ].join("\n"),
                    title: "Vite Plugin Error",
                };
            }

            return undefined;
        },
    },
    {
        name: "vite-css-module-error",
        test: (error, file): RuleMatch | undefined => {
            const message = (error?.message || String(error || "")).toString();

            if (has(message, "css module", "css-modules", ".module.css", ".module.scss")) {
                return {
                    md: [
                        "CSS Module import or usage error.",
                        "",
                        "CSS Modules require specific import syntax:",
                        "",
                        ts("import styles from './Component.module.css';\n// Use: <div className={styles.myClass}>"),
                        "",
                        "Or with TypeScript:",
                        ts("import styles from './Component.module.css';\n// styles.myClass has type-safe access"),
                        "",
                        "Common issues:",
                        "• Wrong import syntax (missing .module.)",
                        "• CSS file not found",
                        "• PostCSS configuration issues",
                        "• CSS class name conflicts",
                        "",
                        `Current file: ${file.file}`,
                    ].join("\n"),
                    title: "CSS Module Error",
                };
            }

            return undefined;
        },
    },
    {
        name: "vite-asset-loading-error",
        test: (error): RuleMatch | undefined => {
            const message = (error?.message || String(error || "")).toString();

            if (has(message, "failed to load", "asset loading", "chunkloaderror", "loading chunk")) {
                return {
                    md: [
                        "Asset or chunk loading failed.",
                        "",
                        "Common causes:",
                        "• Network connectivity issues",
                        "• Dev server not running",
                        "• Incorrect asset paths",
                        "• CORS policy blocking assets",
                        "• Service worker caching stale assets",
                        "",
                        "Try:",
                        "• Restart dev server",
                        "• Clear browser cache",
                        "• Check network tab for failed requests",
                        "• Verify asset paths are correct",
                        "• Disable service worker temporarily",
                    ].join("\n"),
                    title: "Asset Loading Failed",
                };
            }

            return undefined;
        },
    },
    {
        name: "vite-config-error",
        test: (error): RuleMatch | undefined => {
            const message = (error?.message || String(error || "")).toString();

            if (has(message, "vite.config", "config error", "invalid configuration")) {
                return {
                    md: [
                        "Vite configuration error detected.",
                        "",
                        "Check your vite.config.ts or vite.config.js:",
                        "",
                        ts(`export default defineConfig({
  // Common issues:
  plugins: [ /* check plugin configurations */ ],
  resolve: {
    alias: { /* verify path mappings */ }
  },
  build: {
    rollupOptions: {
      // Check external dependencies
    }
  }
})`),
                        "",
                        "Common config issues:",
                        "• Syntax errors in config file",
                        "• Plugin configuration problems",
                        "• Path alias misconfigurations",
                        "• Missing dependencies",
                        "• TypeScript config conflicts",
                        "",
                        "Try:",
                        "• Validate config syntax",
                        "• Comment out plugins one by one",
                        "• Check for conflicting configurations",
                    ].join("\n"),
                    title: "Vite Configuration Error",
                };
            }

            return undefined;
        },
    },
    {
        name: "vite-circular-dependency",
        test: (error): RuleMatch | undefined => {
            const message = (error?.message || String(error || "")).toString();

            if (has(message, "circular dependency", "circular reference", "cyclic dependency")) {
                return {
                    md: [
                        "Circular dependency detected in your modules.",
                        "",
                        "This happens when:",
                        "• Module A imports Module B",
                        "• Module B imports Module A (directly or indirectly)",
                        "",
                        "Solutions:",
                        "• Restructure imports to break the cycle",
                        "• Use dynamic imports: `import()`",
                        "• Move shared code to a separate module",
                        "• Use dependency injection pattern",
                        "",
                        "Example fix:",
                        ts(`// Instead of direct import
import { helper } from './helpers';

// Use dynamic import
const helper = (await import('./helpers')).helper;`),
                        "",
                        "Check your import graph to identify the cycle.",
                    ].join("\n"),
                    title: "Circular Dependency",
                };
            }

            return undefined;
        },
    },
    {
        name: "vite-sourcemap-error",
        test: (error): RuleMatch | undefined => {
            const message = (error?.message || String(error || "")).toString();

            if (has(message, "sourcemap", "source map", "source-map", "mapping")) {
                return {
                    md: [
                        "Source map related error.",
                        "",
                        "Common issues:",
                        "• Source maps disabled in production",
                        "• Source map files not generated",
                        "• Source map paths incorrect",
                        "• Dev tools can't load source maps",
                        "",
                        "Check:",
                        "• Vite config: `build.sourcemap: true`",
                        "• Dev tools source map settings",
                        "• Network tab for source map requests",
                        "• File permissions for .map files",
                    ].join("\n"),
                    title: "Source Map Error",
                };
            }

            return undefined;
        },
    },
    {
        name: "vite-environment-error",
        test: (error): RuleMatch | undefined => {
            const message = (error?.message || String(error || "")).toString();

            if (has(message, "process is not defined", "global is not defined", "buffer is not defined")) {
                return {
                    md: [
                        "Node.js globals not available in browser environment.",
                        "",
                        "Browser-safe alternatives:",
                        "",
                        js(`// Instead of: process.env.NODE_ENV
import.meta.env.MODE

// Instead of: global
window

// Instead of: Buffer
// Use Uint8Array or libraries like 'buffer'

// Instead of: __dirname, __filename
import.meta.url
new URL('./', import.meta.url).pathname`),
                        "",
                        "For libraries expecting Node.js:",
                        "• Check if browser-compatible version exists",
                        "• Use polyfills when necessary",
                        "• Configure Vite to handle Node.js compatibility",
                    ].join("\n"),
                    title: "Node.js in Browser Environment",
                };
            }

            return undefined;
        },
    },
    {
        name: "vite-aggregate-error",
        test: (error): RuleMatch | undefined => {
            // Check if this is an AggregateError by looking for multiple errors
            const hasMultipleErrors = error && typeof error === "object" && ("errors" in error || "length" in error || Array.isArray((error as any).errors));

            const message = (error?.message || String(error || "")).toString();

            if (hasMultipleErrors || has(message, "multiple errors", "aggregate", "batch")) {
                return {
                    md: [
                        "Multiple errors occurred simultaneously.",
                        "",
                        "This typically happens when:",
                        "• Build process fails with multiple validation errors",
                        "• Multiple modules fail to load or compile",
                        "• Linting or type-checking finds multiple issues",
                        "• Hot reload encounters cascading failures",
                        "",
                        "Focus on the primary error first:",
                        "• The first error often causes subsequent failures",
                        "• Fix the root cause to resolve dependent errors",
                        "• Check for circular dependencies or import cycles",
                        "",
                        "In development:",
                        "• Errors are shown in order of severity",
                        "• Fix from top to bottom for best results",
                        "• Some errors may resolve automatically after fixing others",
                    ].join("\n"),
                    title: "Multiple Errors (AggregateError)",
                };
            }

            return undefined;
        },
    },
    {
        name: "vite-dev-server-connection",
        test: (error): RuleMatch | undefined => {
            const message = (error?.message || String(error || "")).toString();

            if (has(message, "connection refused", "econnrefused", "dev server", "localhost", "127.0.0.1")) {
                return {
                    md: [
                        "Cannot connect to Vite dev server.",
                        "",
                        "Common causes:",
                        "• Dev server is not running",
                        "• Wrong port number",
                        "• Firewall blocking connection",
                        "• Host binding issues",
                        "",
                        "Try:",
                        "• Start dev server: `npm run dev` or `vite`",
                        "• Check port configuration in vite.config.ts",
                        "• Verify server is running on correct host/port",
                        "• Check for firewall/antivirus blocking connections",
                        "",
                        bash("npm run dev\n# or\nvite --host 0.0.0.0"),
                    ].join("\n"),
                    title: "Dev Server Connection Failed",
                };
            }

            return undefined;
        },
    },
    {
        name: "vite-import-meta-env",
        test: (error): RuleMatch | undefined => {
            const message = (error?.message || String(error || "")).toString();

            if (has(message, "import.meta", "import_meta", "meta.env", "process.env")) {
                return {
                    md: [
                        "Issue with environment variables or import.meta usage.",
                        "",
                        "Vite provides environment variables through `import.meta.env`:",
                        "",
                        js(`// Correct usage:
console.log(import.meta.env.MODE);        // 'development' | 'production'
console.log(import.meta.env.DEV);         // true in development
console.log(import.meta.env.PROD);        // true in production
console.log(import.meta.env.VITE_*);      // Custom env vars (VITE_API_URL=...)`),
                        "",
                        "Common mistakes:",
                        "• Using `process.env` instead of `import.meta.env`",
                        "• Forgetting `VITE_` prefix for custom env vars",
                        "• Trying to access env vars at build time",
                        "",
                        "Environment variables are:",
                        "• Available only at runtime, not build time",
                        "• Must be prefixed with `VITE_` to be exposed to client",
                        "• Type-safe when using TypeScript with proper typing",
                    ].join("\n"),
                    title: "Import.meta Environment Variables",
                };
            }

            return undefined;
        },
    },
    {
        name: "vite-dynamic-import",
        test: (error): RuleMatch | undefined => {
            const message = (error?.message || String(error || "")).toString();

            if (has(message, "dynamic import", "import()", "chunk", "loading chunk")) {
                return {
                    md: [
                        "Dynamic import or code splitting issue.",
                        "",
                        "Vite supports dynamic imports for code splitting:",
                        "",
                        js(`// Basic dynamic import
const module = await import('./MyComponent.tsx');

// With React.lazy
const LazyComponent = lazy(() => import('./HeavyComponent.tsx'));

// Conditional imports
const moduleName = condition ? './moduleA' : './moduleB';
const module = await import(moduleName);`),
                        "",
                        "Common issues:",
                        "• Wrong file path in dynamic import",
                        "• Missing file extension (may be required)",
                        "• Circular dependencies preventing code splitting",
                        "• Dynamic imports in server-side code",
                        "",
                        "Tips:",
                        "• Use relative paths for better bundling",
                        "• Consider using Vite's glob import for multiple files",
                        "• Dynamic imports work only in client-side code",
                    ].join("\n"),
                    title: "Dynamic Import/Code Splitting",
                };
            }

            return undefined;
        },
    },
    {
        name: "vite-typescript-config",
        test: (error): RuleMatch | undefined => {
            const message = (error?.message || String(error || "")).toString();

            if (has(message, "typescript", "tsconfig", "compilerOptions", "target", "moduleResolution")) {
                return {
                    md: [
                        "TypeScript configuration issue detected.",
                        "",
                        "Ensure your tsconfig.json is compatible with Vite:",
                        "",
                        ts(`{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}`),
                        "",
                        "Key settings for Vite:",
                        "• `moduleResolution: \"bundler\"` - Required for Vite",
                        "• `allowImportingTsExtensions: true` - Allows .ts/.tsx imports",
                        "• `module: \"ESNext\"` - Modern module syntax",
                        "• Separate tsconfig.node.json for build scripts",
                    ].join("\n"),
                    title: "TypeScript Configuration",
                };
            }

            return undefined;
        },
    },
];

/**
 * Vite-specific solution finder that provides helpful hints for common Vite errors.
 */
export const viteRuleBasedFinder: SolutionFinder = {
    handle: async (error: Error, file: SolutionFinderFile): Promise<Solution | undefined> => {
        try {
            const matches = viteRules
                .map((r) => {
                    return {
                        match: r.test(error, file),
                        rule: r,
                    };
                })
                .filter((x) => Boolean(x.match)) as { match: RuleMatch; rule: Rule }[];

            if (matches.length === 0) {
                return undefined;
            }

            const sections = matches
                .sort((a, b) => (a.match.priority || 0) - (b.match.priority || 0))
                .map((m) => `#### ${m.match.title}\n\n${m.match.md}`)
                .join("\n\n---\n\n");

            return {
                body: sections,
                header: "### Vite-Specific Issues Detected",
            };
        } catch {
            return undefined;
        }
    },
    name: "viteRuleBasedHints",
    priority: 2, // Higher priority than general rules
};
