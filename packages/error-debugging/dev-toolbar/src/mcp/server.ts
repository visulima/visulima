/**
 * MCP (Model Context Protocol) server for AI agent integration.
 *
 * Provides tools for AI agents (e.g. Claude Code) to read, resolve, and
 * interact with visual annotations created through the dev toolbar.
 *
 * Usage:
 *   npx visulima-dev-toolbar-mcp
 *
 * Requires: @modelcontextprotocol/sdk (optional peer dependency)
 */

import fs from "node:fs/promises";
import path from "node:path";

import {
    appendThreadMessage,
    deleteScreenshotFile,
    isPathInsideBase,
    readAnnotations,
    resolvePaths,
    SCREENSHOTS_DIR,
    withLock,
    writeAnnotations,
} from "../store/annotation-store";

// ─── MCP Server ──────────────────────────────────────────────────────────────

export const startMcpServer = async (): Promise<void> => {
    // Dynamic import — only available when @modelcontextprotocol/sdk is installed
    const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
    const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
    const { z } = await import("zod");

    const root = process.cwd();

    const server = new McpServer({
        name: "visulima-dev-toolbar",
        version: "1.0.0-alpha.5",
    });

    // ── Tool: get_pending_annotations ──

    server.tool(
        "get_pending_annotations",
        "Get all pending visual annotations from the dev toolbar. Returns annotations with metadata but not screenshot binary data — use get_screenshot for that.",
        {},
        async () => {
            const annotations = await readAnnotations(root);
            const pending = annotations.filter((a) => a.status === "pending");

            const result = pending.map((a) => {
                return {
                    ...a,
                    // Replace screenshot path with boolean to avoid sending large base64 data
                    screenshot: Boolean(a.screenshot),
                };
            });

            return {
                content: [
                    {
                        text: JSON.stringify({ annotations: result, count: result.length }, undefined, 2),
                        type: "text" as const,
                    },
                ],
            };
        },
    );

    // ── Tool: get_screenshot ──

    server.tool(
        "get_screenshot",
        "Get the screenshot image for an annotation as base64 data. Use this after get_pending_annotations to see what the user annotated.",
        {
            annotation_id: z.string().describe("The annotation ID to get the screenshot for"),
        },
        async ({ annotation_id }: { annotation_id: string }) => {
            const annotations = await readAnnotations(root);
            const annotation = annotations.find((a) => a.id === annotation_id);

            if (!annotation) {
                return {
                    content: [{ text: JSON.stringify({ error: "Annotation not found" }), type: "text" as const }],
                    isError: true,
                };
            }

            if (!annotation.screenshot) {
                return {
                    content: [{ text: JSON.stringify({ error: "No screenshot for this annotation" }), type: "text" as const }],
                    isError: true,
                };
            }

            // Validate screenshot path
            if (!annotation.screenshot.startsWith(`${SCREENSHOTS_DIR}/`)) {
                return {
                    content: [{ text: JSON.stringify({ error: "Invalid screenshot path" }), type: "text" as const }],
                    isError: true,
                };
            }

            const { base } = resolvePaths(root);
            const filepath = path.join(base, annotation.screenshot);

            // Prevent directory traversal
            if (!isPathInsideBase(filepath, base)) {
                return {
                    content: [{ text: JSON.stringify({ error: "Invalid screenshot path" }), type: "text" as const }],
                    isError: true,
                };
            }

            try {
                const buffer = await fs.readFile(filepath);
                const extension = path.extname(filepath).slice(1);
                const mimeType = extension === "svg" ? "image/svg+xml" : extension === "jpg" ? "image/jpeg" : `image/${extension}`;

                return {
                    content: [
                        {
                            data: buffer.toString("base64"),
                            mimeType,
                            type: "image" as const,
                        },
                    ],
                };
            } catch {
                return {
                    content: [{ text: JSON.stringify({ error: "Screenshot file not found" }), type: "text" as const }],
                    isError: true,
                };
            }
        },
    );

    // ── Tool: resolve_annotation ──

    server.tool(
        "resolve_annotation",
        "Mark an annotation as resolved after fixing the issue. Automatically deletes the associated screenshot.",
        {
            annotation_id: z.string().describe("The annotation ID to resolve"),
        },
        async ({ annotation_id }: { annotation_id: string }) =>
            withLock(async () => {
                const annotations = await readAnnotations(root);
                const index = annotations.findIndex((a) => a.id === annotation_id);

                if (index === -1) {
                    return {
                        content: [{ text: JSON.stringify({ error: "Annotation not found" }), type: "text" as const }],
                        isError: true,
                    };
                }

                const annotation = annotations[index]!;

                annotation.status = "resolved";
                annotation.resolvedBy = "agent";
                annotation.updatedAt = new Date().toISOString();

                // Delete screenshot safely
                if (annotation.screenshot) {
                    await deleteScreenshotFile(root, annotation.screenshot);
                    annotation.screenshot = undefined;
                }

                annotations[index] = annotation;
                await writeAnnotations(root, annotations);

                return {
                    content: [
                        {
                            text: JSON.stringify({ annotation, ok: true }, undefined, 2),
                            type: "text" as const,
                        },
                    ],
                };
            }, root),
    );

    // ── Tool: add_thread_message ──

    server.tool(
        "add_thread_message",
        "Add a message to an annotation's conversation thread. Use this to communicate with the developer about the annotation.",
        {
            annotation_id: z.string().describe("The annotation ID to add a message to"),
            message: z.string().describe("The message content"),
        },
        async ({ annotation_id, message }: { annotation_id: string; message: string }) =>
            withLock(async () => {
                const annotations = await readAnnotations(root);
                const index = annotations.findIndex((a) => a.id === annotation_id);

                if (index === -1) {
                    return {
                        content: [{ text: JSON.stringify({ error: "Annotation not found" }), type: "text" as const }],
                        isError: true,
                    };
                }

                const annotation = annotations[index]!;

                try {
                    appendThreadMessage(annotation, { content: message, role: "agent" });
                } catch (error) {
                    return {
                        content: [{ text: JSON.stringify({ error: (error as Error).message }), type: "text" as const }],
                        isError: true,
                    };
                }

                annotation.updatedAt = new Date().toISOString();
                annotations[index] = annotation;
                await writeAnnotations(root, annotations);

                return {
                    content: [
                        {
                            text: JSON.stringify({ annotation, ok: true }, undefined, 2),
                            type: "text" as const,
                        },
                    ],
                };
            }, root),
    );

    // ── Tool: acknowledge_annotation ──

    server.tool(
        "acknowledge_annotation",
        "Mark an annotation as acknowledged — signals to the developer that the agent has seen it and will work on it. Use this before starting to fix an issue.",
        {
            annotation_id: z.string().describe("The annotation ID to acknowledge"),
        },
        async ({ annotation_id }: { annotation_id: string }) =>
            withLock(async () => {
                const annotations = await readAnnotations(root);
                const index = annotations.findIndex((a) => a.id === annotation_id);

                if (index === -1) {
                    return {
                        content: [{ text: JSON.stringify({ error: "Annotation not found" }), type: "text" as const }],
                        isError: true,
                    };
                }

                const annotation = annotations[index]!;

                annotation.status = "acknowledged";
                annotation.updatedAt = new Date().toISOString();
                annotations[index] = annotation;
                await writeAnnotations(root, annotations);

                return {
                    content: [
                        {
                            text: JSON.stringify({ annotation, ok: true }, undefined, 2),
                            type: "text" as const,
                        },
                    ],
                };
            }, root),
    );

    // ── Tool: watch_annotations ──

    server.tool(
        "watch_annotations",
        "Block until new pending annotations appear. Use this for hands-free mode: call in a loop to automatically detect when the developer adds feedback. Returns after the batch window (default 10s) to collect multiple annotations submitted in quick succession.",
        {
            batch_window_ms: z.number().optional().describe("How long to wait for additional annotations after the first one arrives (default: 10000ms)"),
            timeout_ms: z.number().optional().describe("Maximum time to wait before returning empty (default: 300000ms = 5 minutes)"),
        },
        async ({ batch_window_ms, timeout_ms }: { batch_window_ms?: number; timeout_ms?: number }) => {
            const batchWindow = batch_window_ms ?? 10_000;
            const timeout = timeout_ms ?? 300_000;
            const POLL_INTERVAL = 2000;

            // Track annotation IDs instead of counts to detect new annotations
            // even when others are resolved simultaneously
            const knownIds = new Set((await readAnnotations(root)).filter((a) => a.status === "pending").map((a) => a.id));

            // Use a timer-based approach with proper cleanup
            let pollInterval: ReturnType<typeof setInterval> | undefined;
            let timeoutTimer: ReturnType<typeof setTimeout> | undefined;

            const result = await Promise.race([
                // Timeout promise
                new Promise<{ timedOut: true }>((resolve) => {
                    timeoutTimer = setTimeout(resolve, timeout, { timedOut: true });
                }),
                // Polling promise using setInterval
                new Promise<{ annotations: Record<string, unknown>[]; newIds: string[] }>((resolve, reject) => {
                    pollInterval = setInterval(() => {
                        readAnnotations(root)
                            .then((current) => {
                                const pending = current.filter((a) => a.status === "pending");
                                const newIds = pending.filter((a) => !knownIds.has(a.id)).map((a) => a.id);

                                if (newIds.length > 0) {
                                    clearInterval(pollInterval);
                                    clearTimeout(timeoutTimer);

                                    // Batch window: wait for additional annotations
                                    setTimeout(() => {
                                        readAnnotations(root)
                                            .then((final) => {
                                                const finalPending = final.filter((a) => a.status === "pending");
                                                const allNewIds = finalPending.filter((a) => !knownIds.has(a.id)).map((a) => a.id);

                                                resolve({
                                                    annotations: finalPending.map((a) => {
                                                        return { ...a, screenshot: Boolean(a.screenshot) };
                                                    }),
                                                    newIds: allNewIds,
                                                });
                                            })
                                            .catch(reject);
                                    }, batchWindow);
                                }
                            })
                            .catch((error) => {
                                clearInterval(pollInterval);
                                clearTimeout(timeoutTimer);
                                reject(error);
                            });
                    }, POLL_INTERVAL);
                }),
            ]);

            // Clean up any remaining timers
            clearInterval(pollInterval);
            clearTimeout(timeoutTimer);

            if ("timedOut" in result) {
                return {
                    content: [
                        {
                            text: JSON.stringify({ annotations: [], count: 0, newCount: 0, timedOut: true }),
                            type: "text" as const,
                        },
                    ],
                };
            }

            return {
                content: [
                    {
                        text: JSON.stringify(
                            {
                                annotations: result.annotations,
                                count: result.annotations.length,
                                newCount: result.newIds.length,
                            },
                            undefined,
                            2,
                        ),
                        type: "text" as const,
                    },
                ],
            };
        },
    );

    // ── Start server ──

    const transport = new StdioServerTransport();

    await server.connect(transport);
};
