import type { Solution, SolutionFinder, SolutionFinderFile } from "./types";

type RuleMatch = {
    md: string;
    priority?: number;
    title: string;
};

type Rule = {
    name: string;
    test: (error: Error, file: SolutionFinderFile) => RuleMatch | undefined;
};

const code = (s: string): string => `\`\`\`\n${s.trim()}\n\`\`\``;
const bash = (s: string): string => `\`\`\`bash\n${s.trim()}\n\`\`\``;
const ts = (s: string): string => `\`\`\`ts\n${s.trim()}\n\`\`\``;
const js = (s: string): string => `\`\`\`js\n${s.trim()}\n\`\`\``;

const has = (message: string, ...needles: string[]): boolean => {
    const lower = message.toLowerCase();

    return needles.some((n) => lower.includes(n.toLowerCase()));
};

// Built-in rules for common issues
const rules: Rule[] = [
    {
        name: "esm-cjs-interop",
        test: (error): RuleMatch | undefined => {
            const message = (error?.message || String(error || "")).toString();

            if (
                has(
                    message,
                    "err_require_esm",
                    "cannot use import statement outside a module",
                    "must use import to load es module",
                    "require() of es module",
                    "does not provide an export named",
                )
            ) {
                return {
                    md: [
                        "Your project or a dependency may be mixing CommonJS and ES Modules.",
                        "",
                        "Try:",
                        "- Ensure package.json has the correct `type` (either `module` or `commonjs`).",
                        "- Use dynamic `import()` when requiring ESM from CJS.",
                        "- Prefer ESM-compatible entrypoints from dependencies.",
                        "- In Node, align `module` resolution with your bundler config.",
                        "",
                        "Check Node resolution:",
                        bash("node -v\ncat package.json | jq .type"),
                        "",
                        "Example dynamic import in CJS:",
                        js("(async () => { const mod = await import('some-esm'); mod.default(); })();"),
                    ].join("\n"),
                    title: "ESM/CJS interop",
                };
            }

            return undefined;
        },
    },
    {
        name: "missing-default-export",
        test: (error): RuleMatch | undefined => {
            const message = (error?.message || String(error || "")).toString();

            if (has(message, "default export not found", "has no default export", "does not provide an export named 'default'", "is not exported from")) {
                return {
                    md: [
                        "Verify your import/export shapes.",
                        "",
                        "Default export example:",
                        ts("export default function Component() {}\n// import Component from './file'"),
                        "",
                        "Named export example:",
                        ts("export function Component() {}\n// import { Component } from './file'"),
                    ].join("\n"),
                    title: "Export mismatch (default vs named)",
                };
            }

            return undefined;
        },
    },
    {
        name: "port-in-use",
        test: (error): RuleMatch | undefined => {
            const message = (error?.message || String(error || "")).toString();

            if (has(message, "eaddrinuse", "address already in use", "listen eaddrinuse")) {
                return {
                    md: [
                        "Another process is using the port.",
                        "",
                        "Change the port or stop the other process.",
                        "",
                        "On macOS/Linux:",
                        bash("lsof -i :3000\nkill -9 <PID>"),
                        "",
                        "On Windows (PowerShell):",
                        bash("netstat -ano | findstr :3000\ntaskkill /PID <PID> /F"),
                    ].join("\n"),
                    title: "Port already in use",
                };
            }

            return undefined;
        },
    },
    {
        name: "file-not-found-or-case",
        test: (error, file): RuleMatch | undefined => {
            const message = (error?.message || String(error || "")).toString();

            if (has(message, "enoent", "module not found", "cannot find module")) {
                return {
                    md: [
                        "Check the import path and filename case (Linux/macOS are case-sensitive).",
                        "If using TS path aliases, verify `tsconfig.paths` and bundler aliases.",
                        "",
                        "Current file:",
                        code(`${file.file}:${file.line}`),
                    ].join("\n"),
                    title: "Missing file or path case mismatch",
                };
            }

            return undefined;
        },
    },
    {
        name: "ts-path-mapping",
        test: (error): RuleMatch | undefined => {
            const message = (error?.message || String(error || "")).toString();

            if (has(message, "ts2307", "cannot find module") || message.includes("TS2307")) {
                return {
                    md: [
                        "If you use path aliases, align TS `paths` with Vite/Webpack resolve aliases.",
                        "Ensure file extensions are correct and included in resolver.",
                        "",
                        "tsconfig.json excerpt:",
                        ts(`{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}`),
                    ].join("\n"),
                    title: "TypeScript path mapping / resolution",
                };
            }

            return undefined;
        },
    },
    {
        name: "network-dns-enotfound",
        test: (error): RuleMatch | undefined => {
            const message = (error?.message || String(error || "")).toString();

            if (has(message, "enotfound", "getaddrinfo enotfound", "dns", "fetch failed", "ecconnrefused", "econnrefused")) {
                return {
                    md: [
                        "The host may be unreachable or misconfigured.",
                        "",
                        "Try:",
                        "- Verify the hostname and protocol (http/https).",
                        "- Check VPN/proxy and firewall.",
                        "- Confirm the service is running and listening on the expected port.",
                        "",
                        bash("ping <host>\nnslookup <host>\ncurl -v http://<host>:<port>"),
                    ].join("\n"),
                    title: "Network/DNS connection issue",
                };
            }

            return undefined;
        },
    },
    {
        name: "react-hydration-mismatch",
        test: (error): RuleMatch | undefined => {
            const message = (error?.message || String(error || "")).toString();

            if (has(message, "hydration failed", "did not match", "expected server html", "text content does not match")) {
                return {
                    md: [
                        "Client and server rendered markup differ.",
                        "",
                        "Checklist:",
                        "- Avoid non-deterministic rendering during SSR (dates, random, locale).",
                        "- Ensure feature flags / env checks are consistent between server and client.",
                        "- Wrap browser-only code with guards (e.g., check `typeof window !== 'undefined'`).",
                        "- Ensure data used on server matches client rehydration data.",
                    ].join("\n"),
                    title: "React hydration mismatch",
                };
            }

            return undefined;
        },
    },
    {
        name: "undefined-property",
        test: (error): RuleMatch | undefined => {
            const message = (error?.message || String(error || "")).toString();

            if (has(message, "cannot read properties of undefined", "reading '")) {
                return {
                    md: [
                        "A variable or function returned `undefined`.",
                        "",
                        "Mitigations:",
                        "- Add nullish checks before property access.",
                        "- Validate function return values and input props/state.",
                        "",
                        ts("const value = maybe?.prop; // or: if (maybe) { use(maybe.prop) }"),
                    ].join("\n"),
                    title: "Accessing property of undefined",
                };
            }

            return undefined;
        },
    },
];

const ruleBasedFinder: SolutionFinder = {
    handle: async (error: Error, file: SolutionFinderFile): Promise<Solution | undefined> => {
        try {
            const matches = rules
                .map((r) => {
                    return { match: r.test(error, file), rule: r };
                })
                .filter((x) => Boolean(x.match)) as { match: RuleMatch; rule: Rule }[];

            if (matches.length === 0) {
                return undefined;
            }

            const sections = matches
                .toSorted((a, b) => (a.match.priority || 0) - (b.match.priority || 0))
                .map((m) => `#### ${m.match.title}\n\n${m.match.md}`)
                .join("\n\n---\n\n");

            return { body: sections, header: "### Potential fixes detected" };
        } catch {
            return undefined;
        }
    },
    name: "ruleBasedHints",
    priority: 0,
};

export default ruleBasedFinder;
