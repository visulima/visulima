import { existsSync, mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";

import { ensureDir, ensureDirSync, writeJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { findCacheDir as findCacheDirectory } from "../../src";

// Wrap the real @visulima/fs module so the resolution helpers (findUp,
// isAccessible, W_OK) keep working while ensureDir/ensureDirSync become spies
// over their real implementations. This lets us assert that the async create
// path is genuinely non-blocking: it must call the async `ensureDir` and must
// never touch the sync `ensureDirSync`.
vi.mock(import("@visulima/fs"), async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        ensureDir: vi.fn<typeof actual.ensureDir>(actual.ensureDir),
        ensureDirSync: vi.fn<typeof actual.ensureDirSync>(actual.ensureDirSync),
    };
});

describe("async create path (non-blocking)", () => {
    let distribution: string;

    beforeEach(() => {
        delete process.env.CACHE_DIR;
        distribution = mkdtempSync(join(tmpdir(), "find-cache-dir-async-create-"));
        vi.mocked(ensureDir).mockClear();
        vi.mocked(ensureDirSync).mockClear();
    });

    afterEach(async () => {
        delete process.env.CACHE_DIR;
        await rm(distribution, { force: true, recursive: true });
    });

    it("creates the cache directory via async ensureDir without any sync FS in the create path", async () => {
        expect.assertions(4);

        const packageDirectory = join(distribution, "package");
        const target = join(packageDirectory, "node_modules", ".cache", "test");

        // Seed node_modules + package.json via the async ensureDir spy so the
        // setup itself does not pollute the sync-call assertion.
        await ensureDir(join(packageDirectory, "node_modules"));
        writeJsonSync(join(packageDirectory, "package.json"), { name: "test" });

        vi.mocked(ensureDir).mockClear();
        vi.mocked(ensureDirSync).mockClear();

        const result = await findCacheDirectory("test", { create: true, cwd: packageDirectory });

        expect(result).toStrictEqual(target);
        expect(existsSync(target)).toBe(true);
        expect(vi.mocked(ensureDir)).toHaveBeenCalledWith(target);
        expect(vi.mocked(ensureDirSync)).not.toHaveBeenCalled();
    });
});
