import { RunContext } from "@openai/agents";
import { describe, expect, it } from "vitest";

import { createFileTools } from "../../src/ai/ai-sdk";
import {
    claudeCopyFile,
    claudeDeleteFile,
    claudeDownloadFile,
    claudeGetFileMetadata,
    claudeGetFileUrl,
    claudeListFiles,
    claudeSearchFiles,
    claudeSignUploadUrl,
    claudeUploadFile,
    createClaudeFileTools,
} from "../../src/ai/claude";
import type { FileToolName } from "../../src/ai/internal/schemas";
import { createAgentsFileTools, createResponsesFileTools } from "../../src/ai/openai";
import { createTanstackFileTools } from "../../src/ai/tanstack";
import { Files } from "../../src/files";
import MemoryStorage from "../../src/storage/memory/memory-storage";

type Run = (name: FileToolName, input: Record<string, unknown>) => Promise<unknown>;

/** Tool output is JSON, except an error some SDKs answer with as plain text. */
const parse = (value: unknown): unknown => {
    if (typeof value !== "string") {
        return value;
    }

    try {
        return JSON.parse(value);
    } catch {
        throw new Error(value);
    }
};

/** Each integration's way of executing one tool call, all over the same executors. */
const runners: Record<string, (files: Files) => Run> = {
    "ai-sdk": (files) => {
        const tools = createFileTools({ files, requireApproval: false }) as Record<string, { execute: (input: unknown, options: unknown) => Promise<unknown> }>;

        return async (name, input) => tools[name]?.execute(input, { messages: [], toolCallId: "1" });
    },
    claude: (files) => {
        const tools = Object.fromEntries(
            [
                claudeCopyFile,
                claudeDeleteFile,
                claudeDownloadFile,
                claudeGetFileMetadata,
                claudeGetFileUrl,
                claudeListFiles,
                claudeSearchFiles,
                claudeSignUploadUrl,
                claudeUploadFile,
            ].map((create) => {
                const tool = create(files);

                return [tool.name, tool];
            }),
        ) as Record<string, { handler: (input: unknown, extra: unknown) => Promise<{ content: { text: string }[]; isError?: boolean }> }>;

        return async (name, input) => {
            const result = await tools[name]?.handler(input, {});

            if (result?.isError) {
                throw new Error(result.content[0]?.text);
            }

            return parse(result?.content[0]?.text);
        };
    },
    "openai-agents": (files) => {
        const tools = createAgentsFileTools({ files, requireApproval: false }) as unknown as Record<
            string,
            { invoke: (context: RunContext, input: string) => Promise<unknown> }
        >;

        return async (name, input) => parse(await tools[name]?.invoke(new RunContext(), JSON.stringify(input)));
    },
    "openai-responses": (files) => {
        const tools = createResponsesFileTools({ files, requireApproval: false });

        return async (name, input) => {
            const output = await tools.execute({ arguments: JSON.stringify(input), call_id: "1", name, type: "function_call" });

            return parse(output.output);
        };
    },
    tanstack: (files) => {
        const tools = createTanstackFileTools({ files, requireApproval: false }) as unknown as Record<
            string,
            { execute: (input: unknown, context: unknown) => Promise<unknown> }
        >;

        return async (name, input) => tools[name]?.execute(input, undefined);
    },
};

describe.each(Object.keys(runners))("%s file tools", (integration) => {
    const setup = (): { run: Run; storage: MemoryStorage } => {
        const storage = new MemoryStorage();

        return { run: (runners[integration] as (files: Files) => Run)(new Files({ adapter: storage })), storage };
    };

    it("should upload, describe, list, search and download a file", async () => {
        expect.assertions(7);

        const { run } = setup();

        await expect(
            run("uploadFile", { content: "aGVsbG8=", contentType: "text/plain", encoding: "base64", key: "docs/a.txt", metadata: { owner: "u1" } }),
        ).resolves.toStrictEqual(expect.objectContaining({ key: "docs/a.txt", size: 5 }));
        await expect(run("getFileMetadata", { key: "docs/a.txt" })).resolves.toStrictEqual(
            expect.objectContaining({ contentType: "text/plain", key: "docs/a.txt", lastModified: expect.stringMatching(/^\d{4}-\d\d-\d\dT/u), size: 5 }),
        );
        await expect(run("listFiles", { prefix: "docs/" })).resolves.toStrictEqual({ items: [expect.objectContaining({ key: "docs/a.txt", size: 5 })] });
        await expect(run("searchFiles", { pattern: "docs/*.txt" })).resolves.toStrictEqual({
            items: [expect.objectContaining({ key: "docs/a.txt", size: 5 })],
        });
        await expect(run("searchFiles", { match: "substring", pattern: "nope" })).resolves.toStrictEqual({ items: [] });
        await expect(run("downloadFile", { key: "docs/a.txt" })).resolves.toStrictEqual(
            expect.objectContaining({ content: "hello", encoding: "text", key: "docs/a.txt", size: 5 }),
        );
        await expect(run("downloadFile", { binary: true, key: "docs/a.txt" })).resolves.toStrictEqual(
            expect.objectContaining({ content: "aGVsbG8=", encoding: "base64" }),
        );
    });

    it("should copy and delete files, and sign URLs", async () => {
        expect.assertions(5);

        const { run, storage } = setup();

        await run("uploadFile", { content: "hello", key: "a.txt" });

        await expect(run("copyFile", { from: "a.txt", to: "b.txt" })).resolves.toStrictEqual(
            expect.objectContaining({ copied: true, from: "a.txt", key: "b.txt", to: "b.txt" }),
        );
        await expect(run("deleteFile", { key: "a.txt" })).resolves.toStrictEqual({ deleted: true, key: "a.txt" });
        await expect(storage.exists({ id: "a.txt" })).resolves.toBe(false);
        await expect(run("getFileUrl", { key: "b.txt" })).resolves.toStrictEqual({ key: "b.txt", url: "memory://b.txt" });
        await expect(run("signUploadUrl", { expiresIn: 60, key: "c.txt" })).resolves.toStrictEqual({ key: "c.txt", url: "memory://c.txt" });
    });

    it("should refuse to download more than maxBytes", async () => {
        expect.assertions(1);

        const { run } = setup();

        await run("uploadFile", { content: "x".repeat(100), key: "big.txt" });

        // Integrations either reject or answer with the error text; both carry the refusal.
        const outcome = await run("downloadFile", { key: "big.txt", maxBytes: 10 }).catch((error: unknown) => error);

        expect(JSON.stringify(outcome instanceof Error ? outcome.message : outcome)).toContain("exceeds the maxBytes limit");
    });
});

describe("approval gating", () => {
    const files = new Files({ adapter: new MemoryStorage() });

    it("should gate every write tool by default and none of the read tools, in every integration", async () => {
        expect.assertions(6);

        const writes = ["copyFile", "deleteFile", "signUploadUrl", "uploadFile"];
        const sdk = createFileTools({ files }) as unknown as Record<string, { needsApproval?: boolean }>;
        const tanstack = createTanstackFileTools({ files }) as unknown as Record<string, { needsApproval?: boolean }>;
        const responses = createResponsesFileTools({ files });
        const claude = createClaudeFileTools({ files });
        const gated = (check: (name: string) => boolean | undefined): string[] =>
            ["copyFile", "deleteFile", "downloadFile", "getFileMetadata", "getFileUrl", "listFiles", "searchFiles", "signUploadUrl", "uploadFile"].filter(
                (name) => check(name),
            );

        expect(gated((name) => sdk[name]?.needsApproval)).toStrictEqual(writes);
        expect(gated((name) => tanstack[name]?.needsApproval)).toStrictEqual(writes);
        expect(gated((name) => responses.needsApproval(name))).toStrictEqual(writes);
        expect(gated((name) => claude.needsApproval(name))).toStrictEqual(writes);

        const denied = await claude.canUseTool("mcp__files__deleteFile", { key: "a.txt" }, { signal: new AbortController().signal, suggestions: [] });
        const agents = createAgentsFileTools({ files }) as unknown as Record<
            string,
            { needsApproval: (context: RunContext, input: unknown) => Promise<boolean> }
        >;

        expect(denied.behavior).toBe("deny");
        await expect(agents.deleteFile?.needsApproval(new RunContext(), { key: "a.txt" })).resolves.toBe(true);
    });

    it("should drop write tools in read-only mode", () => {
        expect.assertions(3);

        expect(Object.keys(createFileTools({ files, readOnly: true })).toSorted()).toStrictEqual([
            "downloadFile",
            "getFileMetadata",
            "getFileUrl",
            "listFiles",
            "searchFiles",
        ]);
        expect(Object.keys(createTanstackFileTools({ files, readOnly: true })).toSorted()).toStrictEqual([
            "downloadFile",
            "getFileMetadata",
            "getFileUrl",
            "listFiles",
            "searchFiles",
        ]);
        expect(
            createResponsesFileTools({ files, readOnly: true })
                .definitions.map(({ name }) => name)
                .toSorted(),
        ).toStrictEqual(["downloadFile", "getFileMetadata", "getFileUrl", "listFiles", "searchFiles"]);
    });

    it("should refuse to execute a write tool left out in read-only mode", async () => {
        expect.assertions(1);

        const responses = createResponsesFileTools({ files, readOnly: true });
        const output = await responses.execute({ arguments: JSON.stringify({ key: "a.txt" }), call_id: "1", name: "deleteFile", type: "function_call" });

        expect(JSON.parse(output.output)).toStrictEqual({ error: "Unknown tool: deleteFile" });
    });
});
