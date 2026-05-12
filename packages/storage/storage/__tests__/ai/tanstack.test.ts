import { rm } from "node:fs/promises";

import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from "vitest";

import { createTanstackFileTools } from "../../src/ai/tanstack";
import { Files } from "../../src/files";
import DiskStorage from "../../src/storage/local/disk-storage";
import type { File } from "../../src/storage/utils/file";

const makeFiles = (directory: string): Files<DiskStorage> => {
    const adapter = new DiskStorage<File>({ directory, maxUploadSize: "100MB" });

    return new Files({ adapter });
};

describe(createTanstackFileTools, () => {
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
        const tools = createTanstackFileTools({ files });

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

    it("produces server tools with the expected shape", () => {
        const tools = createTanstackFileTools({ files });

        expect(tools.listFiles.__toolSide).toBe("server");
        expect(tools.listFiles.name).toBe("listFiles");

        expectTypeOf(tools.listFiles.description).toBeString();
        expectTypeOf(tools.listFiles.execute).toBeFunction();

        expect(tools.listFiles.inputSchema).toBeDefined();
    });

    it("omits write tools when readOnly: true", () => {
        const tools = createTanstackFileTools({ files, readOnly: true });

        expect(Object.keys(tools).toSorted()).toEqual(["downloadFile", "getFileMetadata", "getFileUrl", "listFiles"]);
    });

    it("requires approval on write tools by default", () => {
        const tools = createTanstackFileTools({ files });

        expect(tools.uploadFile.needsApproval).toBe(true);
        expect(tools.deleteFile.needsApproval).toBe(true);
        expect(tools.copyFile.needsApproval).toBe(true);
        expect(tools.signUploadUrl.needsApproval).toBe(true);
    });

    it("disables all approvals when requireApproval: false", () => {
        const tools = createTanstackFileTools({ files, requireApproval: false });

        expect(tools.uploadFile.needsApproval).toBe(false);
        expect(tools.deleteFile.needsApproval).toBe(false);
        expect(tools.copyFile.needsApproval).toBe(false);
        expect(tools.signUploadUrl.needsApproval).toBe(false);
    });

    it("supports per-tool approval overrides", () => {
        const tools = createTanstackFileTools({
            files,
            requireApproval: { copyFile: false, deleteFile: true },
        });

        expect(tools.deleteFile.needsApproval).toBe(true);
        expect(tools.copyFile.needsApproval).toBe(false);
        // Unspecified writes still default to true
        expect(tools.uploadFile.needsApproval).toBe(true);
    });

    it("applies per-tool description overrides", () => {
        const tools = createTanstackFileTools({
            files,
            overrides: {
                listFiles: { description: "Custom list description" },
            },
        });

        expect(tools.listFiles.description).toBe("Custom list description");
    });

    it("executes uploadFile + getFileMetadata round-trip", async () => {
        const tools = createTanstackFileTools({ files });
        const uploadResult = await tools.uploadFile.execute!(
            { content: "hi", contentType: "text/plain", key: "tanstack.txt" },
            undefined,
        );

        expect(uploadResult).toMatchObject({ key: "tanstack.txt" });

        const head = (await tools.getFileMetadata.execute!(
            { key: "tanstack.txt" },
            undefined,
        )) as { contentType: string; key: string; size: number };

        expect(head.key).toBe("tanstack.txt");
        expect(head.contentType).toBe("text/plain");
        expect(head.size).toBe(2);
    });
});
