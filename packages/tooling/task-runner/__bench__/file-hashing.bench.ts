/**
 * Benchmark: File hashing throughput
 *
 * Compares:
 * - Node.js SHA-256 (what Nx uses internally)
 * - Node.js xxHash via wasm/js (if available)
 * - Native Rust xxHash3 via napi (our native addon)
 * - Incremental hasher (mtime-based skip, simulates warm cache)
 *
 * Nx uses SHA-256 for file hashing in its daemon.
 * Turborepo uses Go's xxHash for file hashing.
 * We use Rust xxHash3-128 via rayon for parallel hashing.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, bench, describe } from "vitest";

import { IncrementalFileHasher } from "../src/incremental-hasher";
import { loadNativeBindings } from "../src/native-binding";
import { hashFile } from "../src/utils";
import { cleanupFixture, createFixtureFiles } from "./setup";

// ─── Small project (50 files × 1KB) ────────────────────────────────
describe("file hashing - small project (50 files × 1KB)", () => {
    let fixtureDir: string;
    let srcDir: string;

    beforeAll(() => {
        fixtureDir = createFixtureFiles(50, 1024);
        srcDir = join(fixtureDir, "src");
    });

    afterAll(() => {
        cleanupFixture(fixtureDir);
    });

    bench("node:crypto SHA-256 (Nx-style)", async () => {
        const { readdirSync } = await import("node:fs");
        const files = readdirSync(srcDir);

        for (const file of files) {
            const content = readFileSync(join(srcDir, file));

            createHash("sha256").update(content).digest("hex");
        }
    });

    bench("JS hashFile (our SHA-256 fallback)", async () => {
        const { readdirSync } = await import("node:fs");
        const files = readdirSync(srcDir);

        await Promise.all(files.map((file) => hashFile(join(srcDir, file))));
    });

    bench("native Rust xxHash3 parallel (our addon)", async () => {
        const native = loadNativeBindings();

        if (!native) {
            return; // Skip if native not available
        }

        native.hashFilesInDirectory(srcDir, fixtureDir);
    });

    bench("incremental hasher (warm cache)", async () => {
        const hasher = new IncrementalFileHasher({ workspaceRoot: fixtureDir });

        // First run populates cache
        await hasher.hashDirectory(srcDir);
        // Second run uses mtime cache
        await hasher.hashDirectory(srcDir);
    });
});

// ─── Medium project (500 files × 4KB) ──────────────────────────────
describe("file hashing - medium project (500 files × 4KB)", () => {
    let fixtureDir: string;
    let srcDir: string;

    beforeAll(() => {
        fixtureDir = createFixtureFiles(500, 4096);
        srcDir = join(fixtureDir, "src");
    });

    afterAll(() => {
        cleanupFixture(fixtureDir);
    });

    bench("node:crypto SHA-256 (Nx-style)", async () => {
        const { readdirSync } = await import("node:fs");
        const files = readdirSync(srcDir);

        for (const file of files) {
            const content = readFileSync(join(srcDir, file));

            createHash("sha256").update(content).digest("hex");
        }
    });

    bench("JS hashFile (our SHA-256 fallback)", async () => {
        const { readdirSync } = await import("node:fs");
        const files = readdirSync(srcDir);

        await Promise.all(files.map((file) => hashFile(join(srcDir, file))));
    });

    bench("native Rust xxHash3 parallel (our addon)", async () => {
        const native = loadNativeBindings();

        if (!native) {
            return;
        }

        native.hashFilesInDirectory(srcDir, fixtureDir);
    });

    bench("incremental hasher (warm cache)", async () => {
        const hasher = new IncrementalFileHasher({ workspaceRoot: fixtureDir });

        await hasher.hashDirectory(srcDir);
        await hasher.hashDirectory(srcDir);
    });
});

// ─── Large project (2000 files × 8KB) ──────────────────────────────
describe("file hashing - large project (2000 files × 8KB)", () => {
    let fixtureDir: string;
    let srcDir: string;

    beforeAll(() => {
        fixtureDir = createFixtureFiles(2000, 8192);
        srcDir = join(fixtureDir, "src");
    });

    afterAll(() => {
        cleanupFixture(fixtureDir);
    });

    bench("node:crypto SHA-256 (Nx-style)", async () => {
        const { readdirSync } = await import("node:fs");
        const files = readdirSync(srcDir);

        for (const file of files) {
            const content = readFileSync(join(srcDir, file));

            createHash("sha256").update(content).digest("hex");
        }
    });

    bench("JS hashFile (our SHA-256 fallback)", async () => {
        const { readdirSync } = await import("node:fs");
        const files = readdirSync(srcDir);

        await Promise.all(files.map((file) => hashFile(join(srcDir, file))));
    });

    bench("native Rust xxHash3 parallel (our addon)", async () => {
        const native = loadNativeBindings();

        if (!native) {
            return;
        }

        native.hashFilesInDirectory(srcDir, fixtureDir);
    });

    bench("incremental hasher (warm cache)", async () => {
        const hasher = new IncrementalFileHasher({ workspaceRoot: fixtureDir });

        await hasher.hashDirectory(srcDir);
        await hasher.hashDirectory(srcDir);
    });
});
