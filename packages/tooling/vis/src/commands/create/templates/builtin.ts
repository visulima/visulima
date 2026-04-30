/**
 * Built-in template executor — routes `vis:app` and `vis:library`
 * to appropriate scaffolding strategies.
 *
 * - `vis:app` delegates to `create-vite` via dlx
 * - `vis:library` scaffolds a minimal TypeScript library package
 */

import { ensureDirSync, writeFileSync } from "@visulima/fs";
import { join, relative } from "@visulima/path";

import { pail } from "../../../io/logger";
import { runDlx } from "../../../pm/pm-runner";
import type { ExecutionContext, TemplateConfig } from "./types";

// ── vis:app — delegate to create-vite ─────────────────────────────

const executeApp = (config: TemplateConfig, context: ExecutionContext): number => {
    pail.info("Scaffolding application via create-vite...");

    // create-vite expects a relative directory name, not an absolute path
    const relativeTarget = relative(context.cwd, context.targetDir) || ".";
    const args = [relativeTarget, ...config.args];

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
    `${JSON.stringify(
        {
            devDependencies: {
                typescript: "^5.0.0",
                vitest: "^3.0.0",
            },
            exports: {
                ".": {
                    default: "./dist/index.js",
                    types: "./dist/index.d.ts",
                },
            },
            files: ["dist"],
            main: "./dist/index.js",
            name,
            scripts: {
                build: "tsc",
                dev: "tsc --watch",
                test: "vitest run",
                "test:watch": "vitest",
            },
            type: "module",
            types: "./dist/index.d.ts",
            version: "0.0.1",
        },
        null,
        4,
    )}\n`;

const libraryTsconfig = (): string =>
    `${JSON.stringify(
        {
            compilerOptions: {
                declaration: true,
                declarationMap: true,
                esModuleInterop: true,
                module: "Node16",
                moduleResolution: "Node16",
                outDir: "./dist",
                rootDir: "./src",
                skipLibCheck: true,
                sourceMap: true,
                strict: true,
                target: "ES2022",
            },
            include: ["src/**/*"],
        },
        null,
        4,
    )}\n`;

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

    pail.info("Scaffolding library package...");

    ensureDirSync(targetDir);
    ensureDirSync(join(targetDir, "src"));
    ensureDirSync(join(targetDir, "__tests__"));

    writeFileSync(join(targetDir, "package.json"), libraryPackageJson(projectName));
    pail.success("Created package.json");

    writeFileSync(join(targetDir, "tsconfig.json"), libraryTsconfig());
    pail.success("Created tsconfig.json");

    writeFileSync(join(targetDir, "src", "index.ts"), librarySrcIndex(projectName));
    pail.success("Created src/index.ts");

    writeFileSync(join(targetDir, "__tests__", "index.test.ts"), libraryTestIndex(projectName));
    pail.success("Created __tests__/index.test.ts");

    writeFileSync(join(targetDir, ".gitignore"), "node_modules/\ndist/\n.env\n.DS_Store\n");
    pail.success("Created .gitignore");

    return 0;
};

// ── Router ────────────────────────────────────────────────────────

/**
 * Execute a built-in template (vis:app or vis:library).
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
