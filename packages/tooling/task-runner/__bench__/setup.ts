/**
 * Shared setup utilities for benchmarks.
 * Generates realistic monorepo-like file structures.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ProjectGraph, Task, TaskGraph } from "../src/types";

/**
 * Creates a temporary directory with N files of a given size.
 * Simulates a real project's source directory.
 */
export const createFixtureFiles = (fileCount: number, fileSizeBytes: number): string => {
    const dir = mkdtempSync(join(tmpdir(), "task-runner-bench-"));
    const srcDir = join(dir, "src");

    mkdirSync(srcDir, { recursive: true });

    const content = "a".repeat(fileSizeBytes);

    for (let i = 0; i < fileCount; i++) {
        writeFileSync(join(srcDir, `file-${i}.ts`), content);
    }

    // Add a package.json
    writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({
            dependencies: { lodash: "^4.17.21" },
            name: "bench-fixture",
            version: "1.0.0",
        }),
    );

    return dir;
};

/**
 * Removes fixture directory.
 */
export const cleanupFixture = (dir: string): void => {
    rmSync(dir, { force: true, recursive: true });
};

/**
 * Creates a synthetic monorepo workspace with multiple packages.
 */
export const createMonorepoFixture = (packageCount: number, filesPerPackage: number, fileSizeBytes: number): string => {
    const root = mkdtempSync(join(tmpdir(), "task-runner-bench-mono-"));
    const packagesDir = join(root, "packages");

    mkdirSync(packagesDir, { recursive: true });

    // Root lockfile
    writeFileSync(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    writeFileSync(join(root, "tsconfig.base.json"), JSON.stringify({ compilerOptions: { target: "es2022" } }));

    const content = "a".repeat(fileSizeBytes);

    for (let p = 0; p < packageCount; p++) {
        const pkgDir = join(packagesDir, `pkg-${p}`);
        const srcDir = join(pkgDir, "src");

        mkdirSync(srcDir, { recursive: true });

        writeFileSync(
            join(pkgDir, "package.json"),
            JSON.stringify({
                dependencies: p > 0 ? { [`@bench/pkg-${p - 1}`]: "^1.0.0" } : {},
                name: `@bench/pkg-${p}`,
                version: "1.0.0",
            }),
        );

        for (let f = 0; f < filesPerPackage; f++) {
            writeFileSync(join(srcDir, `module-${f}.ts`), `${content}\n// pkg-${p} file-${f}`);
        }
    }

    return root;
};

/**
 * Builds a linear task graph: pkg-0:build -> pkg-1:build -> ... -> pkg-N:build
 */
export const buildTaskGraph = (packageCount: number): TaskGraph => {
    const tasks: Record<string, Task> = {};
    const dependencies: Record<string, string[]> = {};

    for (let i = 0; i < packageCount; i++) {
        const taskId = `pkg-${i}:build`;

        tasks[taskId] = {
            id: taskId,
            outputs: [`packages/pkg-${i}/dist`],
            overrides: {},
            projectRoot: `packages/pkg-${i}`,
            target: { project: `pkg-${i}`, target: "build" },
        };
        dependencies[taskId] = i > 0 ? [`pkg-${i - 1}:build`] : [];
    }

    const roots = [`pkg-${packageCount - 1}:build`];

    return { dependencies, roots, tasks };
};

/**
 * Builds a project graph with linear dependencies.
 */
export const buildProjectGraph = (packageCount: number): ProjectGraph => {
    const nodes: ProjectGraph["nodes"] = {};
    const deps: ProjectGraph["dependencies"] = {};

    for (let i = 0; i < packageCount; i++) {
        const name = `pkg-${i}`;

        nodes[name] = {
            data: {
                root: `packages/${name}`,
                targets: {
                    build: { command: "tsc -b" },
                },
            },
            name,
            type: "library",
        };
        deps[name] = i > 0 ? [{ source: name, target: `pkg-${i - 1}`, type: "static" }] : [];
    }

    return { dependencies: deps, nodes };
};
