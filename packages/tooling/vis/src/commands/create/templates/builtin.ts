/**
 * Built-in template executor — routes `vis:app` and `vis:library`
 * to appropriate scaffolding strategies.
 *
 * - `vis:app` delegates to `create-vite` via dlx
 * - `vis:library` scaffolds a minimal TypeScript library package
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { info, success } from "../../../output";
import { runDlx } from "../../../pm-runner";
import type { ExecutionContext, TemplateConfig } from "./types";

// ── vis:app — delegate to create-vite ─────────────────────────────

const executeApp = (config: TemplateConfig, context: ExecutionContext): number => {
    info("Scaffolding application via create-vite...");

    const args = [context.targetDir, ...config.args];

    // Add --no-immediate to avoid auto-install
    if (!args.includes("--no-immediate")) {
        args.push("--no-immediate");
    }

    return runDlx(
        context.pm,
        {
            additionalPackages: [],
            args,
            package: "create-vite",
            shellMode: false,
            silent: false,
        },
        context.cwd,
        context.logger,
    );
};

// ── vis:library — scaffold a TS library package ───────────────────

const libraryPackageJson = (name: string): string =>
    JSON.stringify(
        {
            name,
            version: "0.0.1",
            type: "module",
            exports: {
                ".": {
                    types: "./dist/index.d.ts",
                    default: "./dist/index.js",
                },
            },
            main: "./dist/index.js",
            types: "./dist/index.d.ts",
            files: ["dist"],
            scripts: {
                build: "tsc",
                dev: "tsc --watch",
                test: "vitest run",
                "test:watch": "vitest",
            },
            devDependencies: {
                typescript: "^5.0.0",
                vitest: "^3.0.0",
            },
        },
        null,
        4,
    ) + "\n";

const libraryTsconfig = (): string =>
    JSON.stringify(
        {
            compilerOptions: {
                target: "ES2022",
                module: "Node16",
                moduleResolution: "Node16",
                outDir: "./dist",
                rootDir: "./src",
                strict: true,
                esModuleInterop: true,
                skipLibCheck: true,
                declaration: true,
                declarationMap: true,
                sourceMap: true,
            },
            include: ["src/**/*"],
        },
        null,
        4,
    ) + "\n";

const librarySrcIndex = (name: string): string => `/**
 * ${name} — library entry point.
 */

export const greet = (name: string): string => \`Hello from ${name}, \${name}!\`;
`;

const libraryTestIndex = (name: string): string => `import { describe, expect, it } from "vitest";

import { greet } from "../src/index";

describe("${name}", () => {
    it("should greet", () => {
        expect(greet("world")).toBe("Hello from ${name}, world!");
    });
});
`;

const executeLibrary = (_config: TemplateConfig, context: ExecutionContext): number => {
    const { projectName, targetDir } = context;

    info("Scaffolding library package...");

    mkdirSync(targetDir, { recursive: true });
    mkdirSync(join(targetDir, "src"), { recursive: true });
    mkdirSync(join(targetDir, "__tests__"), { recursive: true });

    writeFileSync(join(targetDir, "package.json"), libraryPackageJson(projectName));
    success("Created package.json");

    writeFileSync(join(targetDir, "tsconfig.json"), libraryTsconfig());
    success("Created tsconfig.json");

    writeFileSync(join(targetDir, "src", "index.ts"), librarySrcIndex(projectName));
    success("Created src/index.ts");

    writeFileSync(join(targetDir, "__tests__", "index.test.ts"), libraryTestIndex(projectName));
    success("Created __tests__/index.test.ts");

    return 0;
};

// ── Router ────────────────────────────────────────────────────────

/**
 * Execute a built-in template (vis:app or vis:library).
 *
 * @param config Resolved template config with type and extra args.
 * @param context Runtime context with PM info, target dir, and project name.
 * @returns Exit code — 0 on success, non-zero on failure.
 */
export const executeBuiltin = (config: TemplateConfig, context: ExecutionContext): number => {
    switch (config.type) {
        case "builtin:app": {
            return executeApp(config, context);
        }
        case "builtin:library": {
            return executeLibrary(config, context);
        }
        default: {
            throw new Error(`Unknown built-in template type: ${config.type}`);
        }
    }
};
