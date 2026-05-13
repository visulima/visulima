import { rm } from "node:fs/promises";

import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createFileTools } from "../../src/ai/ai-sdk";
import { Files } from "../../src/files";
import DiskStorage from "../../src/storage/local/disk-storage";
import type { File } from "../../src/storage/utils/file";

const makeFiles = (directory: string): Files<DiskStorage> => {
    const adapter = new DiskStorage<File>({ directory, maxUploadSize: "100MB" });

    return new Files({ adapter });
};

describe(createFileTools, () => {
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

    it("returns the full tool map keyed by camelCase tool names", () => {
        const tools = createFileTools({ files });

        expect(Object.keys(tools).toSorted()).toEqual([
            "copyFile",
            "deleteFile",
            "downloadFile",
            "getFileMetadata",
            "getFileUrl",
            "listFiles",
            "signUploadUrl",
            "uploadFile",
        ]);
    });

    it("omits write tools when readOnly: true", () => {
        const tools = createFileTools({ files, readOnly: true });

        expect(Object.keys(tools).toSorted()).toEqual(["downloadFile", "getFileMetadata", "getFileUrl", "listFiles"]);
    });

    it("requires approval on write tools by default", () => {
        const tools = createFileTools({ files });

        expect(tools.uploadFile.needsApproval).toBe(true);
        expect(tools.deleteFile.needsApproval).toBe(true);
        expect(tools.copyFile.needsApproval).toBe(true);
        expect(tools.signUploadUrl.needsApproval).toBe(true);
    });

    it("disables all approvals when requireApproval: false", () => {
        const tools = createFileTools({ files, requireApproval: false });

        expect(tools.uploadFile.needsApproval).toBe(false);
        expect(tools.deleteFile.needsApproval).toBe(false);
        expect(tools.copyFile.needsApproval).toBe(false);
        expect(tools.signUploadUrl.needsApproval).toBe(false);
    });

    it("supports per-tool approval overrides", () => {
        const tools = createFileTools({
            files,
            requireApproval: { copyFile: false, deleteFile: true },
        });

        expect(tools.deleteFile.needsApproval).toBe(true);
        expect(tools.copyFile.needsApproval).toBe(false);
        // Unspecified writes still default to true
        expect(tools.uploadFile.needsApproval).toBe(true);
    });

    it("applies per-tool description overrides", () => {
        const tools = createFileTools({
            files,
            overrides: {
                listFiles: { description: "Custom list description" },
            },
        });

        expect(tools.listFiles.description).toBe("Custom list description");
    });

    it("executes uploadFile + getFileMetadata round-trip", async () => {
        const tools = createFileTools({ files });
        const uploadResult = await tools.uploadFile.execute({ content: "hi", contentType: "text/plain", key: "ai-sdk.txt" }, { messages: [], toolCallId: "1" });

        expect(uploadResult).toMatchObject({ key: "ai-sdk.txt" });

        const head = (await tools.getFileMetadata.execute({ key: "ai-sdk.txt" }, { messages: [], toolCallId: "2" })) as {
            contentType: string;
            key: string;
            size: number;
        };

        expect(head.key).toBe("ai-sdk.txt");
        expect(head.contentType).toBe("text/plain");
        expect(head.size).toBe(2);
    });
});
