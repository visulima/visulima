/**
 * Built-in generator template — scaffolds a code generator package
 * inside an existing monorepo workspace.
 *
 * Creates a minimal Node.js CLI package with a bin entry point.
 */

import { chmodSync } from "node:fs";

import { ensureDirSync, writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { pail } from "../../../io/logger";
import type { ExecutionContext } from "./types";

// ── Template files ────────────────────────────────────────────────

const packageJson = (name: string, description: string): string =>
    `${JSON.stringify(
        {
            bin: {
                [name]: "./bin/index.js",
            },
            description,
            devDependencies: {
                typescript: "^5.0.0",
            },
            name,
            private: true,
            scripts: {
                build: "tsc",
                dev: "tsc --watch",
            },
            type: "module",
            version: "0.0.1",
        },
        null,
        4,
    )}\n`;

const binIndex = (name: string): string => `#!/usr/bin/env node

/**
 * ${name} — code generator
 *
 * Usage: npx ${name} [options]
 */

console.log("Hello from ${name}!");
`;

const tsconfigJson = (): string =>
    `${JSON.stringify(
        {
            compilerOptions: {
                declaration: true,
                esModuleInterop: true,
                module: "Node16",
                moduleResolution: "Node16",
                outDir: "./dist",
                rootDir: "./src",
                skipLibCheck: true,
                strict: true,
                target: "ES2022",
            },
            include: ["src/**/*", "bin/**/*"],
        },
        null,
        4,
    )}\n`;

const srcIndex = (): string => `/**
 * Generator core logic — export functions used by the CLI entry point.
 */

export const generate = (): void => {
    // TODO: Implement your generator logic here
};
`;

// ── Executor ──────────────────────────────────────────────────────

/**
 * Scaffold a code generator package with a bin entry point.
 * @param context Runtime context with project name and target directory.
 * @param description Optional generator description for package.json.
 * @returns Exit code — 0 on success.
 */
export const executeGeneratorTemplate = (context: ExecutionContext, description: string = ""): number => {
    const { projectName, targetDir } = context;

    pail.info("Scaffolding code generator...");

    // Create directory structure
    ensureDirSync(targetDir);
    ensureDirSync(join(targetDir, "bin"));
    ensureDirSync(join(targetDir, "src"));

    // Write files
    writeFileSync(join(targetDir, "package.json"), packageJson(projectName, description || `Code generator: ${projectName}`));
    pail.success("Created package.json");

    const binPath = join(targetDir, "bin", "index.js");

    writeFileSync(binPath, binIndex(projectName));
    chmodSync(binPath, 0o755);
    pail.success("Created bin/index.js (executable)");

    writeFileSync(join(targetDir, "tsconfig.json"), tsconfigJson());
    pail.success("Created tsconfig.json");

    writeFileSync(join(targetDir, "src", "index.ts"), srcIndex());
    pail.success("Created src/index.ts");

    return 0;
};
