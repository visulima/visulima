// @vitest-environment node
/* eslint-disable max-classes-per-file -- each mock module factory defines its own stub class */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { startMcpServer } from "../../src/mcp/server";
import { MAX_THREAD_MESSAGES, readAnnotations, resolvePaths, writeAnnotations } from "../../src/store/annotation-store";
import type { Annotation } from "../../src/types/annotations";

interface ToolResult {
    content: { data?: string; text?: string; type: string }[];
    isError?: boolean;
}

type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>;

const { registeredTools } = vi.hoisted(() => { return { registeredTools: new Map<string, ToolHandler>() }; });

vi.mock(import("@modelcontextprotocol/sdk/server/mcp.js"), () => {
    return {
        McpServer: class {
        // eslint-disable-next-line class-methods-use-this
            public tool(_name: string, _description: string, _schema: unknown, handler: ToolHandler): void {
                registeredTools.set(_name, handler);
            }

            // eslint-disable-next-line class-methods-use-this
            public async connect(): Promise<void> {}
        },
    };
});

vi.mock(import("@modelcontextprotocol/sdk/server/stdio.js"), () => {
    return {
        // eslint-disable-next-line @typescript-eslint/no-extraneous-class -- transport stub is instantiated via `new` by the MCP server
        StdioServerTransport: class {},
    };
});

vi.mock(import("zod"), () => {
    // Minimal fluent stub — the schema is never exercised by the captured handlers.
    const chain: Record<string, unknown> = {};

    chain.describe = () => chain;
    chain.optional = () => chain;

    return { z: { number: () => chain, string: () => chain } };
});

const getTool = (name: string): ToolHandler => {
    const handler = registeredTools.get(name);

    if (!handler) {
        throw new Error(`Tool not registered: ${name}`);
    }

    return handler;
};

const parse = (result: ToolResult): Record<string, unknown> => JSON.parse(result.content[0]!.text!) as Record<string, unknown>;

const makeAnnotation = (overrides: Partial<Annotation>): Annotation => {
    return {
        comment: "test",
        createdAt: "2024-01-01",
        elementTag: "div",
        id: "1",
        intent: "fix",
        severity: "important",
        status: "pending",
        updatedAt: "2024-01-01",
        url: "/",
        x: 0,
        y: 0,
        ...overrides,
    };
};

describe("mcp/server", () => {
    let tmpDir: string;

    beforeEach(async () => {
        registeredTools.clear();
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vdt-mcp-test-"));
        vi.spyOn(process, "cwd").mockReturnValue(tmpDir);

        await startMcpServer();
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await fs.rm(tmpDir, { force: true, recursive: true });
    });

    it("registers all annotation tools", () => {
        expect.assertions(1);

        expect([...registeredTools.keys()].sort()).toStrictEqual([
            "acknowledge_annotation",
            "add_thread_message",
            "get_pending_annotations",
            "get_screenshot",
            "resolve_annotation",
            "watch_annotations",
        ]);
    });

    describe("get_pending_annotations", () => {
        it("returns only pending annotations with screenshot as a boolean", async () => {
            expect.assertions(3);

            await writeAnnotations(tmpDir, [
                makeAnnotation({ id: "p1", screenshot: "screenshots/p1.png", status: "pending" }),
                makeAnnotation({ id: "r1", status: "resolved" }),
            ]);

            const result = parse(await getTool("get_pending_annotations")({}));

            expect(result.count).toBe(1);
            expect((result.annotations as { id: string }[])[0]!.id).toBe("p1");
            expect((result.annotations as { screenshot: unknown }[])[0]!.screenshot).toBe(true);
        });
    });

    describe("resolve_annotation", () => {
        it("marks the annotation resolved and deletes its screenshot", async () => {
            expect.assertions(4);

            const { screenshotsDir } = resolvePaths(tmpDir);

            await fs.mkdir(screenshotsDir, { recursive: true });
            await fs.writeFile(path.join(screenshotsDir, "p1.png"), "fake");
            await writeAnnotations(tmpDir, [makeAnnotation({ id: "p1", screenshot: "screenshots/p1.png", status: "pending" })]);

            const result = await getTool("resolve_annotation")({ annotation_id: "p1" });

            expect(result.isError).toBeUndefined();

            const [stored] = await readAnnotations(tmpDir);

            expect(stored!.status).toBe("resolved");
            expect(stored!.screenshot).toBeUndefined();
            await expect(fs.access(path.join(screenshotsDir, "p1.png"))).rejects.toThrow();
        });

        it("returns an error for an unknown id", async () => {
            expect.assertions(2);

            const result = await getTool("resolve_annotation")({ annotation_id: "missing" });

            expect(result.isError).toBe(true);
            expect(parse(result).error).toBe("Annotation not found");
        });
    });

    describe("add_thread_message", () => {
        it("appends a clamped agent message persisted to disk", async () => {
            expect.assertions(3);

            await writeAnnotations(tmpDir, [makeAnnotation({ id: "p1" })]);

            await getTool("add_thread_message")({ annotation_id: "p1", message: "hello there" });

            const [stored] = await readAnnotations(tmpDir);

            expect(stored!.thread).toHaveLength(1);
            expect(stored!.thread![0]!.role).toBe("agent");
            expect(stored!.thread![0]!.content).toBe("hello there");
        });

        it("enforces the MAX_THREAD_MESSAGES guard the RPC path enforces", async () => {
            expect.assertions(2);

            await writeAnnotations(tmpDir, [
                makeAnnotation({
                    id: "p1",
                    thread: Array.from({ length: MAX_THREAD_MESSAGES }, (_, index) => {
                        return {
                            content: "m",
                            id: String(index),
                            role: "agent",
                            timestamp: "2024-01-01",
                        };
                    }),
                }),
            ]);

            const result = await getTool("add_thread_message")({ annotation_id: "p1", message: "overflow" });

            expect(result.isError).toBe(true);

            const [stored] = await readAnnotations(tmpDir);

            expect(stored!.thread).toHaveLength(MAX_THREAD_MESSAGES);
        });

        it("returns an error for an unknown id", async () => {
            expect.assertions(1);

            const result = await getTool("add_thread_message")({ annotation_id: "missing", message: "hi" });

            expect(result.isError).toBe(true);
        });
    });

    describe("acknowledge_annotation", () => {
        it("marks the annotation acknowledged on disk", async () => {
            expect.assertions(1);

            await writeAnnotations(tmpDir, [makeAnnotation({ id: "p1" })]);

            await getTool("acknowledge_annotation")({ annotation_id: "p1" });

            const [stored] = await readAnnotations(tmpDir);

            expect(stored!.status).toBe("acknowledged");
        });
    });

    describe("get_screenshot", () => {
        it("returns an error for an unknown annotation", async () => {
            expect.assertions(2);

            const result = await getTool("get_screenshot")({ annotation_id: "missing" });

            expect(result.isError).toBe(true);
            expect(parse(result).error).toBe("Annotation not found");
        });
    });

    describe("watch_annotations", () => {
        it("returns timedOut when no new annotations arrive within the timeout", async () => {
            expect.assertions(2);

            const result = parse(await getTool("watch_annotations")({ batch_window_ms: 5, timeout_ms: 20 }));

            expect(result.timedOut).toBe(true);
            expect(result.count).toBe(0);
        });
    });
});
