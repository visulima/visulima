// @vitest-environment node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from "vitest";

import { createAnnotation, deleteAnnotation, getAnnotations, getScreenshot, saveScreenshot, updateAnnotation } from "../../../src/rpc/functions/annotations";
import { resolvePaths, writeAnnotations } from "../../../src/store/annotation-store";

// Mock ViteDevServer
const makeServer = (root: string) => ({ config: { root } }) as Parameters<typeof getAnnotations>[0];

describe("rpc/functions/annotations", () => {
    let tmpDir: string;
    let server: ReturnType<typeof makeServer>;

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vdt-rpc-test-"));
        server = makeServer(tmpDir);
    });

    afterEach(async () => {
        await fs.rm(tmpDir, { force: true, recursive: true });
    });

    describe(getAnnotations, () => {
        it("returns empty array when no file exists", async () => {
            expect.assertions(1);

            const result = await getAnnotations(server);

            expect(result).toEqual([]);
        });

        it("returns stored annotations", async () => {
            expect.assertions(2);

            await writeAnnotations(tmpDir, [
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
            ] as never[]);

            const result = await getAnnotations(server);

            expect(result).toHaveLength(1);
            expect(result[0]).toHaveProperty("id", "1");
        });
    });

    describe(createAnnotation, () => {
        it("generates id, status, timestamps", async () => {
            expect.assertions(2);

            const result = await createAnnotation(server, {
                comment: "Fix this",
                elementTag: "button",
                intent: "fix",
                severity: "important",
                url: "/page",
                x: 50,
                y: 100,
            });

            expectTypeOf(result.id).toBeString();

            expect(result.id.length).toBeGreaterThan(10); // UUID
            expect(result.status).toBe("pending");

            expectTypeOf(result.createdAt).toBeString();
            expectTypeOf(result.updatedAt).toBeString();
        });

        it("does NOT allow client to inject server fields", async () => {
            expect.assertions(3);

            const result = await createAnnotation(server, {
                comment: "test",
                // These should be ignored (server-generated)
                createdAt: "hacked",
                elementTag: "div",
                id: "injected-id",
                intent: "fix",
                severity: "important",
                status: "resolved" as never,
                url: "/",
                x: 0,
                y: 0,
            } as never);

            expect(result.id).not.toBe("injected-id");
            expect(result.status).toBe("pending");
            expect(result.createdAt).not.toBe("hacked");
        });

        it("persists to disk", async () => {
            expect.assertions(1);

            await createAnnotation(server, {
                comment: "test",
                elementTag: "div",
                intent: "fix",
                severity: "important",
                url: "/",
                x: 0,
                y: 0,
            });

            const all = await getAnnotations(server);

            expect(all).toHaveLength(1);
        });
    });

    describe(updateAnnotation, () => {
        let annotationId: string;

        beforeEach(async () => {
            const a = await createAnnotation(server, {
                comment: "original",
                elementTag: "div",
                intent: "fix",
                severity: "important",
                url: "/",
                x: 0,
                y: 0,
            });

            annotationId = a.id;
        });

        it("returns null for non-existent id", async () => {
            expect.assertions(1);

            const result = await updateAnnotation(server, "nonexistent", { comment: "changed" });

            expect(result).toBeNull();
        });

        it("updates comment", async () => {
            expect.assertions(1);

            const result = await updateAnnotation(server, annotationId, { comment: "updated" });

            expect(result?.comment).toBe("updated");
        });

        it("updates intent and severity", async () => {
            expect.assertions(2);

            const result = await updateAnnotation(server, annotationId, { intent: "question", severity: "suggestion" });

            expect(result?.intent).toBe("question");
            expect(result?.severity).toBe("suggestion");
        });

        it("sets resolvedBy and resolvedAt on resolve", async () => {
            expect.assertions(2);

            const result = await updateAnnotation(server, annotationId, { status: "resolved" });

            expect(result?.status).toBe("resolved");
            expect(result?.resolvedBy).toBe("human");

            expectTypeOf(result?.resolvedAt).toBeString();
        });

        it("sets resolvedBy to agent when specified", async () => {
            expect.assertions(1);

            const result = await updateAnnotation(server, annotationId, { resolvedBy: "agent", status: "resolved" });

            expect(result?.resolvedBy).toBe("agent");
        });

        it("appends thread message with server timestamp", async () => {
            expect.assertions(4);

            const result = await updateAnnotation(server, annotationId, {
                threadMessage: { content: "Hello", role: "human", timestamp: "client-time" },
            });

            expect(result?.thread).toHaveLength(1);
            expect(result?.thread?.[0]?.content).toBe("Hello");
            expect(result?.thread?.[0]?.role).toBe("human");
            // Server overrides timestamp
            expect(result?.thread?.[0]?.timestamp).not.toBe("client-time");
        });

        it("creates thread array if missing", async () => {
            expect.assertions(1);

            const result = await updateAnnotation(server, annotationId, {
                threadMessage: { content: "first", role: "agent", timestamp: "" },
            });

            expect(result?.thread).toHaveLength(1);
        });
    });

    describe(deleteAnnotation, () => {
        it("returns false for non-existent id", async () => {
            expect.assertions(1);

            const result = await deleteAnnotation(server, "nonexistent");

            expect(result).toBe(false);
        });

        it("deletes annotation from disk", async () => {
            expect.assertions(2);

            const a = await createAnnotation(server, {
                comment: "delete me",
                elementTag: "div",
                intent: "fix",
                severity: "important",
                url: "/",
                x: 0,
                y: 0,
            });

            const result = await deleteAnnotation(server, a.id);

            expect(result).toBe(true);

            const all = await getAnnotations(server);

            expect(all).toHaveLength(0);
        });
    });

    describe(saveScreenshot, () => {
        it("saves PNG data URL", async () => {
            expect.assertions(2);

            const a = await createAnnotation(server, {
                comment: "test",
                elementTag: "div",
                intent: "fix",
                severity: "important",
                url: "/",
                x: 0,
                y: 0,
            });

            // Minimal 1x1 red PNG as base64
            const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==";
            const dataUrl = `data:image/png;base64,${pngBase64}`;

            const resultPath = await saveScreenshot(server, a.id, dataUrl);

            expect(resultPath).toMatch(/^screenshots\/.+\.png$/);

            // Verify file exists
            const { base } = resolvePaths(tmpDir);
            const filePath = path.join(base, resultPath);
            const stat = await fs.stat(filePath);

            expect(stat.isFile()).toBe(true);
        });

        it("rejects unsupported formats", async () => {
            expect.assertions(1);

            await expect(saveScreenshot(server, "test-id", "data:image/bmp;base64,abc")).rejects.toThrow("Unsupported screenshot format");
        });

        it("sECURITY: rejects traversal in annotation ID", async () => {
            expect.assertions(1);

            const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==";
            const dataUrl = `data:image/png;base64,${pngBase64}`;

            // Sanitized ID removes path separators
            const resultPath = await saveScreenshot(server, "../../etc/evil", dataUrl);

            // Should NOT create file at ../../etc/evil.png
            expect(resultPath).toMatch(/^screenshots\/etcevil\.png$/);
        });

        it("rejects empty annotation ID", async () => {
            expect.assertions(1);

            await expect(saveScreenshot(server, "", "data:image/png;base64,abc")).rejects.toThrow("Invalid annotation ID");
        });
    });

    describe(getScreenshot, () => {
        it("returns null for non-existent annotation", async () => {
            expect.assertions(1);

            const result = await getScreenshot(server, "nonexistent");

            expect(result).toBeNull();
        });

        it("returns null for annotation without screenshot", async () => {
            expect.assertions(1);

            const a = await createAnnotation(server, {
                comment: "no screenshot",
                elementTag: "div",
                intent: "fix",
                severity: "important",
                url: "/",
                x: 0,
                y: 0,
            });

            const result = await getScreenshot(server, a.id);

            expect(result).toBeNull();
        });

        it("sECURITY: returns null for traversal paths in screenshot field", async () => {
            // Manually write annotation with malicious screenshot path
            expect.assertions(1);

            await writeAnnotations(tmpDir, [
                {
                    comment: "evil",
                    createdAt: "",
                    elementTag: "div",
                    id: "evil-id",
                    intent: "fix",
                    screenshot: "../../../etc/passwd",
                    severity: "important",
                    status: "pending",
                    updatedAt: "",
                    url: "/",
                    x: 0,
                    y: 0,
                },
            ] as never[]);

            const result = await getScreenshot(server, "evil-id");

            expect(result).toBeNull();
        });
    });
});
