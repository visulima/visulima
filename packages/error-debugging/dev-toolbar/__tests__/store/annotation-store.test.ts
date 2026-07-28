// @vitest-environment node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    appendThreadMessage,
    deleteScreenshotFile,
    ensureStoreDir,
    isPathInsideBase,
    LOCK_DIR,
    MAX_TEXT_FIELD_LENGTH,
    MAX_THREAD_MESSAGES,
    readAnnotations,
    resolvePaths,
    sanitizeId,
    STORE_DIR,
    withLock,
    writeAnnotations,
} from "../../src/store/annotation-store";
import type { Annotation } from "../../src/types/annotations";

describe("annotation-store", () => {
    let tmpDir: string;

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vdt-test-"));
    });

    afterEach(async () => {
        await fs.rm(tmpDir, { force: true, recursive: true });
    });

    describe(resolvePaths, () => {
        it("returns correct paths", () => {
            expect.assertions(3);

            const paths = resolvePaths("/root");

            // resolvePaths uses node:path which yields backslash separators
            // on Windows; compare against path.join() so the test is OS-agnostic.
            expect(paths.base).toBe(path.join("/root", ".devtoolbar"));
            expect(paths.annotationsFile).toBe(path.join("/root", ".devtoolbar", "annotations.json"));
            expect(paths.screenshotsDir).toBe(path.join("/root", ".devtoolbar", "screenshots"));
        });
    });

    describe(isPathInsideBase, () => {
        it("returns true for paths inside base", () => {
            expect.assertions(1);

            expect(isPathInsideBase("/base/sub/file.txt", "/base")).toBe(true);
        });

        it("returns false for paths outside base", () => {
            expect.assertions(1);

            expect(isPathInsideBase("/other/file.txt", "/base")).toBe(false);
        });

        it("returns false for directory traversal", () => {
            expect.assertions(1);

            expect(isPathInsideBase("/base/../etc/passwd", "/base")).toBe(false);
        });

        it("returns true for the base path itself", () => {
            expect.assertions(1);

            expect(isPathInsideBase("/base", "/base")).toBe(true);
        });

        it("returns true when .. resolves back inside base", () => {
            expect.assertions(1);

            expect(isPathInsideBase("/base/sub/../sub/file.txt", "/base")).toBe(true);
        });

        it("returns false when .. escapes base", () => {
            expect.assertions(1);

            expect(isPathInsideBase("/base/sub/../../etc/passwd", "/base")).toBe(false);
        });
    });

    describe(sanitizeId, () => {
        it("keeps alphanumeric and hyphens", () => {
            expect.assertions(1);

            expect(sanitizeId("abc-123")).toBe("abc-123");
        });

        it("strips path separators", () => {
            expect.assertions(1);

            expect(sanitizeId("../../etc/passwd")).toBe("etcpasswd");
        });

        it("strips special characters", () => {
            expect.assertions(1);

            expect(sanitizeId("a@b#c$d")).toBe("abcd");
        });

        it("handles UUIDs", () => {
            expect.assertions(1);

            expect(sanitizeId("550e8400-e29b-41d4-a716-446655440000")).toBe("550e8400-e29b-41d4-a716-446655440000");
        });

        it("returns empty string for empty input", () => {
            expect.assertions(1);

            expect(sanitizeId("")).toBe("");
        });

        it("returns empty string for all-special-chars input", () => {
            expect.assertions(1);

            expect(sanitizeId("@#$%^&")).toBe("");
        });
    });

    describe(ensureStoreDir, () => {
        it("creates directories recursively", async () => {
            expect.assertions(1);

            await ensureStoreDir(tmpDir);

            const screenshotsDir = path.join(tmpDir, ".devtoolbar", "screenshots");
            const stat = await fs.stat(screenshotsDir);

            expect(stat.isDirectory()).toBe(true);
        });

        it("is idempotent", async () => {
            expect.assertions(1);

            await ensureStoreDir(tmpDir);
            await ensureStoreDir(tmpDir);

            const screenshotsDir = path.join(tmpDir, ".devtoolbar", "screenshots");
            const stat = await fs.stat(screenshotsDir);

            expect(stat.isDirectory()).toBe(true);
        });
    });

    describe("readAnnotations / writeAnnotations", () => {
        it("returns empty array when file does not exist", async () => {
            expect.assertions(1);

            const result = await readAnnotations(tmpDir);

            expect(result).toEqual([]);
        });

        it("writes and reads annotations", async () => {
            expect.assertions(2);

            const annotations = [
                {
                    comment: "test",
                    createdAt: "2024-01-01",
                    elementTag: "div",
                    id: "1",
                    intent: "fix",
                    severity: "important",
                    status: "pending",
                    updatedAt: "2024-01-01",
                    url: "/",
                    x: 50,
                    y: 100,
                },
            ];

            await writeAnnotations(tmpDir, annotations as never[]);
            const result = await readAnnotations(tmpDir);

            expect(result).toHaveLength(1);
            expect(result[0]).toHaveProperty("id", "1");
        });

        it("returns empty array for corrupted JSON", async () => {
            expect.assertions(1);

            await ensureStoreDir(tmpDir);
            const { annotationsFile } = resolvePaths(tmpDir);

            await fs.writeFile(annotationsFile, "not json", "utf8");

            const result = await readAnnotations(tmpDir);

            expect(result).toEqual([]);
        });

        it("returns empty array for non-array JSON", async () => {
            expect.assertions(1);

            await ensureStoreDir(tmpDir);
            const { annotationsFile } = resolvePaths(tmpDir);

            await fs.writeFile(annotationsFile, "{\"not\": \"an array\"}", "utf8");

            const result = await readAnnotations(tmpDir);

            expect(result).toEqual([]);
        });
    });

    describe(withLock, () => {
        it("releases lock even when function throws", async () => {
            // First operation throws
            expect.assertions(2);

            await expect(
                withLock(async () => {
                    throw new Error("boom");
                }),
            ).rejects.toThrow("boom");

            // Second operation should still complete (lock released)
            const result = await withLock(async () => 42);

            expect(result).toBe(42);
        });

        it("serializes concurrent operations", async () => {
            expect.assertions(3);

            const order: number[] = [];

            const op1 = withLock(async () => {
                await new Promise((r) => {
                    setTimeout(r, 50);
                });
                order.push(1);

                return 1;
            });

            const op2 = withLock(async () => {
                order.push(2);

                return 2;
            });

            const [r1, r2] = await Promise.all([op1, op2]);

            expect(r1).toBe(1);
            expect(r2).toBe(2);
            expect(order).toEqual([1, 2]); // op2 waits for op1
        });
    });

    describe(deleteScreenshotFile, () => {
        it("deletes a screenshot file", async () => {
            expect.assertions(1);

            await ensureStoreDir(tmpDir);

            const { screenshotsDir } = resolvePaths(tmpDir);
            const filePath = path.join(screenshotsDir, "test.png");

            await fs.writeFile(filePath, "fake png data");
            await deleteScreenshotFile(tmpDir, "screenshots/test.png");

            await expect(fs.access(filePath)).rejects.toThrow();
        });

        it("ignores paths that don't start with screenshots/", async () => {
            expect.assertions(1);

            await ensureStoreDir(tmpDir);

            const { base } = resolvePaths(tmpDir);
            const filePath = path.join(base, "annotations.json");

            await fs.writeFile(filePath, "[]");
            await deleteScreenshotFile(tmpDir, "annotations.json");

            // File should still exist (not deleted)
            const stat = await fs.stat(filePath);

            expect(stat.isFile()).toBe(true);
        });

        // eslint-disable-next-line vitest/prefer-expect-assertions -- smoke test; verifies no throw
        it("ignores traversal attempts", async () => {
            await deleteScreenshotFile(tmpDir, "screenshots/../../etc/passwd");
            // Should not throw
        });

        // eslint-disable-next-line vitest/prefer-expect-assertions -- smoke test; verifies no throw
        it("ignores missing files", async () => {
            await deleteScreenshotFile(tmpDir, "screenshots/nonexistent.png");
            // Should not throw
        });
    });

    describe("writeAnnotations atomicity", () => {
        it("leaves no temp file behind after writing", async () => {
            expect.assertions(1);

            await writeAnnotations(tmpDir, [{ id: "a", status: "pending" }] as never[]);

            const { base } = resolvePaths(tmpDir);
            const entries = await fs.readdir(base);
            const temporaries = entries.filter((name) => name.endsWith(".tmp"));

            expect(temporaries).toEqual([]);
        });

        it("does not truncate the previous file when a concurrent reader observes mid-write", async () => {
            expect.assertions(1);

            // Seed a valid file, then interleave a second write with reads: the
            // atomic rename means every read sees a complete (non-empty) array.
            await writeAnnotations(tmpDir, [{ id: "seed", status: "pending" }] as never[]);

            const writes = writeAnnotations(tmpDir, [
                { id: "1", status: "pending" },
                { id: "2", status: "pending" },
            ] as never[]);

            const reads = Promise.all(Array.from({ length: 20 }, async () => readAnnotations(tmpDir)));

            const [, results] = await Promise.all([writes, reads]);

            // No read ever observed a torn/empty file.
            expect(results.every((r) => r.length > 0)).toBe(true);
        });
    });

    describe(appendThreadMessage, () => {
        it("generates id/timestamp and clamps message text", () => {
            expect.assertions(4);

            const annotation = { id: "1", status: "pending" } as Annotation;

            const entry = appendThreadMessage(annotation, { content: "x".repeat(MAX_TEXT_FIELD_LENGTH + 100), role: "agent" });

            expect(entry.content).toHaveLength(MAX_TEXT_FIELD_LENGTH);
            expect(entry.id).toBeTypeOf("string");
            expect(entry.timestamp).toBeTypeOf("string");
            expect(annotation.thread).toHaveLength(1);
        });

        it("throws once the thread reaches MAX_THREAD_MESSAGES", () => {
            expect.assertions(2);

            const annotation = {
                id: "1",
                status: "pending",
                thread: Array.from({ length: MAX_THREAD_MESSAGES }, (_, index) => {
                    return {
                        content: "m",
                        id: String(index),
                        role: "agent",
                        timestamp: "2024-01-01",
                    };
                }),
            } as Annotation;

            expect(() => appendThreadMessage(annotation, { content: "overflow", role: "agent" })).toThrow(
                `Thread message limit reached (${String(MAX_THREAD_MESSAGES)})`,
            );
            expect(annotation.thread).toHaveLength(MAX_THREAD_MESSAGES);
        });
    });

    describe("withLock cross-process file lock", () => {
        it("holds the lock directory while the function runs and removes it after", async () => {
            expect.assertions(2);

            const lockPath = path.join(tmpDir, STORE_DIR, LOCK_DIR);

            let heldDuringRun = false;

            await withLock(async () => {
                heldDuringRun = await fs
                    .stat(lockPath)
                    .then((s) => s.isDirectory())
                    .catch(() => false);
            }, tmpDir);

            expect(heldDuringRun).toBe(true);
            await expect(fs.access(lockPath)).rejects.toThrow();
        });

        it("reclaims a stale lock left by a crashed process", async () => {
            expect.assertions(1);

            const lockPath = path.join(tmpDir, STORE_DIR, LOCK_DIR);

            await fs.mkdir(lockPath, { recursive: true });

            // Backdate the lock well beyond the stale threshold.
            const stale = new Date(Date.now() - 60_000);

            await fs.utimes(lockPath, stale, stale);

            const result = await withLock(async () => "ran", tmpDir);

            expect(result).toBe("ran");
        });
    });
});
