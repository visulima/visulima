/**
 * Built-in generator template — scaffolds a code generator package
 * inside an existing monorepo workspace.
 *
 * Creates a minimal Node.js CLI package with a bin entry point.
 */

import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { success } from "../../../output";
import type { ExecutionContext } from "./types";

// ── Template files ────────────────────────────────────────────────

const packageJson = (name: string, description: string): string =>
    JSON.stringify(
        {
            name,
            version: "0.0.1",
            private: true,
            type: "module",
            description,
            bin: {
                [name]: "./bin/index.js",
            },
            scripts: {
                build: "tsc",
                dev: "tsc --watch",
            },
            devDependencies: {
                typescript: "^5.0.0",
            },
        },
        null,
        4,
    ) + "\n";

const binIndex = (name: string): string => `#!/usr/bin/env node

/**
 * ${name} — code generator
 *
 * Usage: npx ${name} [options]
 */

console.log("Hello from ${name}!");
`;

const tsconfigJson = (): string =>
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
            },
            include: ["src/**/*", "bin/**/*"],
        },
        null,
        4,
    ) + "\n";

const srcIndex = (): string => `/**
 * Generator core logic — export functions used by the CLI entry point.
 */

export const generate = (): void => {
    // TODO: Implement your generator logic here
};
`;

// ── Executor ──────────────────────────────────────────────────────

export const executeGeneratorTemplate = (context: ExecutionContext, description: string = ""): number => {
    const { projectName, targetDir } = context;

    // Create directory structure
    mkdirSync(targetDir, { recursive: true });
    mkdirSync(join(targetDir, "bin"), { recursive: true });
    mkdirSync(join(targetDir, "src"), { recursive: true });

    // Write files
    writeFileSync(join(targetDir, "package.json"), packageJson(projectName, description || `Code generator: ${projectName}`));
    success("Created package.json");

    const binPath = join(targetDir, "bin", "index.js");

    writeFileSync(binPath, binIndex(projectName));
    chmodSync(binPath, 0o755);
    success("Created bin/index.js (executable)");

    writeFileSync(join(targetDir, "tsconfig.json"), tsconfigJson());
    success("Created tsconfig.json");

    writeFileSync(join(targetDir, "src", "index.ts"), srcIndex());
    success("Created src/index.ts");

    return 0;
};
