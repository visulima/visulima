/**
 * Benchmark: Cache read/write operations
 *
 * Measures the overhead of the caching layer:
 * - Writing a task result to cache (put)
 * - Reading a cached result (get)
 * - Cache with output archiving (dist dirs)
 *
 * Nx and Turborepo both use file-based caching with similar
 * get/put patterns. This benchmark verifies our cache layer
 * doesn't add meaningful overhead.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, bench, describe } from "vitest";

import { Cache } from "../src/cache";
import { cleanupFixture, createFixtureFiles } from "./setup";

describe("cache operations - small result (1KB output)", () => {
    let fixtureDir: string;
    let cache: Cache;
    const hash = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    const terminalOutput = "Build succeeded in 1.2s\n".repeat(40); // ~1KB

    beforeAll(async () => {
        fixtureDir = createFixtureFiles(10, 512);
        cache = new Cache({ workspaceRoot: fixtureDir });
        // Pre-populate cache for read benchmarks
        await cache.put(hash, terminalOutput, [], 0);
    });

    afterAll(() => {
        cleanupFixture(fixtureDir);
    });

    bench("cache.put (write)", async () => {
        await cache.put(`bench-${Date.now()}`, terminalOutput, [], 0);
    });

    bench("cache.get (hit)", async () => {
        await cache.get(hash);
    });

    bench("cache.get (miss)", async () => {
        await cache.get("0000000000000000000000000000000000000000000000000000000000000000");
    });
});

describe("cache operations - large result (100KB output)", () => {
    let fixtureDir: string;
    let cache: Cache;
    const hash = "fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321";
    const terminalOutput = "x".repeat(102_400); // 100KB

    beforeAll(async () => {
        fixtureDir = createFixtureFiles(10, 512);
        cache = new Cache({ workspaceRoot: fixtureDir });
        await cache.put(hash, terminalOutput, [], 0);
    });

    afterAll(() => {
        cleanupFixture(fixtureDir);
    });

    bench("cache.put (write 100KB)", async () => {
        await cache.put(`bench-${Date.now()}`, terminalOutput, [], 0);
    });

    bench("cache.get (hit 100KB)", async () => {
        await cache.get(hash);
    });
});

describe("cache operations - with output archiving", () => {
    let fixtureDir: string;
    let cache: Cache;
    const hash = "1111111111111111111111111111111111111111111111111111111111111111";

    beforeAll(async () => {
        fixtureDir = createFixtureFiles(10, 512);

        // Create a mock dist/ directory with build outputs
        const distDir = join(fixtureDir, "dist");

        mkdirSync(distDir, { recursive: true });

        for (let i = 0; i < 20; i++) {
            writeFileSync(join(distDir, `chunk-${i}.js`), `// chunk ${i}\n${"var x=1;\n".repeat(200)}`);
        }

        cache = new Cache({ workspaceRoot: fixtureDir });
        await cache.put(hash, "Built 20 chunks", ["dist"], 0);
    });

    afterAll(() => {
        cleanupFixture(fixtureDir);
    });

    bench("cache.put with outputs (20 files)", async () => {
        await cache.put(`bench-out-${Date.now()}`, "Built 20 chunks", ["dist"], 0);
    });

    bench("cache.get + restoreOutputs", async () => {
        const result = await cache.get(hash);

        if (result) {
            await cache.restoreOutputs(hash, ["dist"]);
        }
    });
});
