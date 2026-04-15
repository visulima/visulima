// @vitest-environment node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    deleteScreenshotFile,
    ensureStoreDir,
    isPathInsideBase,
    readAnnotations,
    resolvePaths,
    sanitizeId,
    withLock,
    writeAnnotations,
} from "../../src/store/annotation-store";

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
            const paths = resolvePaths("/root");

            expect(paths.base).toBe("/root/.devtoolbar");
            expect(paths.annotationsFile).toBe("/root/.devtoolbar/annotations.json");
            expect(paths.screenshotsDir).toBe("/root/.devtoolbar/screenshots");
        });
    });

    describe(isPathInsideBase, () => {
        it("returns true for paths inside base", () => {
            expect(isPathInsideBase("/base/sub/file.txt", "/base")).toBe(true);
        });

        it("returns false for paths outside base", () => {
            expect(isPathInsideBase("/other/file.txt", "/base")).toBe(false);
        });

        it("returns false for directory traversal", () => {
            expect(isPathInsideBase("/base/../etc/passwd", "/base")).toBe(false);
        });

        it("returns true for the base path itself", () => {
            expect(isPathInsideBase("/base", "/base")).toBe(true);
        });

        it("returns true when .. resolves back inside base", () => {
            expect(isPathInsideBase("/base/sub/../sub/file.txt", "/base")).toBe(true);
        });

        it("returns false when .. escapes base", () => {
            expect(isPathInsideBase("/base/sub/../../etc/passwd", "/base")).toBe(false);
        });
    });

    describe(sanitizeId, () => {
        it("keeps alphanumeric and hyphens", () => {
            expect(sanitizeId("abc-123")).toBe("abc-123");
        });

        it("strips path separators", () => {
            expect(sanitizeId("../../etc/passwd")).toBe("etcpasswd");
        });

        it("strips special characters", () => {
            expect(sanitizeId("a@b#c$d")).toBe("abcd");
        });

        it("handles UUIDs", () => {
            expect(sanitizeId("550e8400-e29b-41d4-a716-446655440000")).toBe("550e8400-e29b-41d4-a716-446655440000");
        });

        it("returns empty string for empty input", () => {
            expect(sanitizeId("")).toBe("");
        });

        it("returns empty string for all-special-chars input", () => {
            expect(sanitizeId("@#$%^&")).toBe("");
        });
    });

    describe(ensureStoreDir, () => {
        it("creates directories recursively", async () => {
            await ensureStoreDir(tmpDir);

            const screenshotsDir = path.join(tmpDir, ".devtoolbar", "screenshots");
            const stat = await fs.stat(screenshotsDir);

            expect(stat.isDirectory()).toBe(true);
        });

        it("is idempotent", async () => {
            await ensureStoreDir(tmpDir);
            await ensureStoreDir(tmpDir);

            const screenshotsDir = path.join(tmpDir, ".devtoolbar", "screenshots");
            const stat = await fs.stat(screenshotsDir);

            expect(stat.isDirectory()).toBe(true);
        });
    });

    describe("readAnnotations / writeAnnotations", () => {
        it("returns empty array when file does not exist", async () => {
            const result = await readAnnotations(tmpDir);

            expect(result).toEqual([]);
        });

        it("writes and reads annotations", async () => {
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
            await ensureStoreDir(tmpDir);
            const { annotationsFile } = resolvePaths(tmpDir);

            await fs.writeFile(annotationsFile, "not json", "utf8");

            const result = await readAnnotations(tmpDir);

            expect(result).toEqual([]);
        });

        it("returns empty array for non-array JSON", async () => {
            await ensureStoreDir(tmpDir);
            const { annotationsFile } = resolvePaths(tmpDir);

            await fs.writeFile(annotationsFile, '{"not": "an array"}', "utf8");

            const result = await readAnnotations(tmpDir);

            expect(result).toEqual([]);
        });
    });

    describe(withLock, () => {
        it("releases lock even when function throws", async () => {
            // First operation throws
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
            await ensureStoreDir(tmpDir);

            const { screenshotsDir } = resolvePaths(tmpDir);
            const filePath = path.join(screenshotsDir, "test.png");

            await fs.writeFile(filePath, "fake png data");
            await deleteScreenshotFile(tmpDir, "screenshots/test.png");

            await expect(fs.access(filePath)).rejects.toThrow();
        });

        it("ignores paths that don't start with screenshots/", async () => {
            await ensureStoreDir(tmpDir);

            const { base } = resolvePaths(tmpDir);
            const filePath = path.join(base, "annotations.json");

            await fs.writeFile(filePath, "[]");
            await deleteScreenshotFile(tmpDir, "annotations.json");

            // File should still exist (not deleted)
            const stat = await fs.stat(filePath);

            expect(stat.isFile()).toBe(true);
        });

        it("ignores traversal attempts", async () => {
            await deleteScreenshotFile(tmpDir, "screenshots/../../etc/passwd");
            // Should not throw
        });

        it("ignores missing files", async () => {
            await deleteScreenshotFile(tmpDir, "screenshots/nonexistent.png");
            // Should not throw
        });
    });
});
