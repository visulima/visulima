import { rm } from "node:fs/promises";

import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from "vitest";

import { createClaudeFileTools } from "../../src/ai/claude";
import { Files } from "../../src/files";
import DiskStorage from "../../src/storage/local/disk-storage";
import type { File } from "../../src/storage/utils/file";

const makeFiles = (directory: string): Files<DiskStorage> => {
    const adapter = new DiskStorage<File>({ directory, maxUploadSize: "100MB" });

    return new Files({ adapter });
};

describe(createClaudeFileTools, () => {
    let directory: string;
    let files: Files<DiskStorage>;

    beforeEach(() => {
        directory = temporaryDirectory();
        files = makeFiles(directory);
    });

    afterEach(async () => {
        try {
            await rm(directory, { force: true, recursive: true });
        } catch {
            // ignore
        }
    });

    it("exposes the bundled mcpServers, allowedTools, canUseTool, server, serverName", () => {
        const bundle = createClaudeFileTools({ files });

        expect(bundle.serverName).toBe("files");
        expect(bundle.mcpServers).toHaveProperty("files");
        expect(bundle.server).toBe(bundle.mcpServers.files);
        expect(bundle.allowedTools.toSorted()).toEqual([
            "mcp__files__copyFile",
            "mcp__files__deleteFile",
            "mcp__files__downloadFile",
            "mcp__files__getFileMetadata",
            "mcp__files__getFileUrl",
            "mcp__files__listFiles",
            "mcp__files__signUploadUrl",
            "mcp__files__uploadFile",
        ]);

        expectTypeOf(bundle.canUseTool).toBeFunction();
    });

    it("honours a custom serverName in the MCP prefix", () => {
        const bundle = createClaudeFileTools({ files, serverName: "uploads" });

        expect(bundle.serverName).toBe("uploads");
        expect(bundle.mcpServers).toHaveProperty("uploads");
        expect(bundle.allowedTools.every((name) => name.startsWith("mcp__uploads__"))).toBe(true);
    });

    it("omits write tools when readOnly: true", () => {
        const bundle = createClaudeFileTools({ files, readOnly: true });

        expect(bundle.allowedTools.toSorted()).toEqual([
            "mcp__files__downloadFile",
            "mcp__files__getFileMetadata",
            "mcp__files__getFileUrl",
            "mcp__files__listFiles",
        ]);
    });

    it("needsApproval reports approval requirement for write tools (bare & prefixed)", () => {
        const bundle = createClaudeFileTools({ files });

        expect(bundle.needsApproval("uploadFile")).toBe(true);
        expect(bundle.needsApproval("mcp__files__uploadFile")).toBe(true);
        expect(bundle.needsApproval("listFiles")).toBe(false);
        expect(bundle.needsApproval("mcp__files__listFiles")).toBe(false);
        expect(bundle.needsApproval("totallyUnknown")).toBe(false);
    });

    it("respects per-tool requireApproval overrides", () => {
        const bundle = createClaudeFileTools({
            files,
            requireApproval: { copyFile: false, deleteFile: true, signUploadUrl: false, uploadFile: false },
        });

        expect(bundle.needsApproval("uploadFile")).toBe(false);
        expect(bundle.needsApproval("deleteFile")).toBe(true);
        expect(bundle.needsApproval("copyFile")).toBe(false);
        expect(bundle.needsApproval("signUploadUrl")).toBe(false);
    });

    it("canUseTool denies writes that require approval and allows reads", async () => {
        const bundle = createClaudeFileTools({ files });

        const writeDecision = await bundle.canUseTool("mcp__files__uploadFile", { key: "x" }, { signal: new AbortController().signal, suggestions: [] });

        expect(writeDecision.behavior).toBe("deny");

        const readDecision = await bundle.canUseTool("mcp__files__listFiles", {}, { signal: new AbortController().signal, suggestions: [] });

        expect(readDecision.behavior).toBe("allow");
    });

    it("canUseTool allows approved writes when requireApproval: false", async () => {
        const bundle = createClaudeFileTools({ files, requireApproval: false });
        const decision = await bundle.canUseTool(
            "mcp__files__uploadFile",
            { content: "x", key: "x.txt" },
            { signal: new AbortController().signal, suggestions: [] },
        );

        expect(decision.behavior).toBe("allow");
    });
});
