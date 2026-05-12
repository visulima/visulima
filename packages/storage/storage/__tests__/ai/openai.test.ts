import { rm } from "node:fs/promises";

import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from "vitest";

import type { FunctionCallItem } from "../../src/ai/openai";
import { createAgentsFileTools, createResponsesFileTools } from "../../src/ai/openai";
import { Files } from "../../src/files";
import DiskStorage from "../../src/storage/local/disk-storage";
import type { File } from "../../src/storage/utils/file";

const makeFiles = (directory: string): Files<DiskStorage> => {
    const adapter = new DiskStorage<File>({ directory, maxUploadSize: "100MB" });

    return new Files({ adapter });
};

const fakeCall = (name: string, args: Record<string, unknown>): FunctionCallItem => {
    return {
        arguments: JSON.stringify(args),
        call_id: `call_${name}`,
        name,
        type: "function_call",
    };
};

describe("openAI adapters", () => {
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

    describe(createResponsesFileTools, () => {
        it("emits function-tool definitions for all 8 tools", () => {
            const { definitions } = createResponsesFileTools({ files });

            expect(definitions).toHaveLength(8);
            expect(definitions.map((definition) => definition.name).toSorted()).toEqual([
                "copyFile",
                "deleteFile",
                "downloadFile",
                "getFileMetadata",
                "getFileUrl",
                "listFiles",
                "signUploadUrl",
                "uploadFile",
            ]);

            for (const definition of definitions) {
                expect(definition.type).toBe("function");
                expect(definition.parameters).toMatchObject({ type: "object" });
                expect(definition.strict).toBe(false);
            }
        });

        it("strips $schema from generated JSON Schema", () => {
            const { definitions } = createResponsesFileTools({ files });

            for (const definition of definitions) {
                expect(definition.parameters).not.toHaveProperty("$schema");
            }
        });

        it("omits writes when readOnly: true", () => {
            const { definitions } = createResponsesFileTools({ files, readOnly: true });

            expect(definitions.map((definition) => definition.name).toSorted()).toEqual([
                "downloadFile",
                "getFileMetadata",
                "getFileUrl",
                "listFiles",
            ]);
        });

        it("reports needsApproval for write tools", () => {
            const tools = createResponsesFileTools({ files });

            expect(tools.needsApproval("uploadFile")).toBe(true);
            expect(tools.needsApproval("deleteFile")).toBe(true);
            expect(tools.needsApproval("listFiles")).toBe(false);
            expect(tools.needsApproval("unknown")).toBe(false);
        });

        it("execute round-trips a function_call", async () => {
            const tools = createResponsesFileTools({ files, requireApproval: false });

            const uploadOut = await tools.execute(
                fakeCall("uploadFile", { content: "hi", contentType: "text/plain", key: "responses.txt" }),
            );

            expect(uploadOut.type).toBe("function_call_output");
            expect(uploadOut.call_id).toBe("call_uploadFile");

            const headOut = await tools.execute(fakeCall("getFileMetadata", { key: "responses.txt" }));
            const parsed = JSON.parse(headOut.output) as { contentType: string; key: string };

            expect(parsed.key).toBe("responses.txt");
            expect(parsed.contentType).toBe("text/plain");
        });

        it("returns an error output for unknown tool names", async () => {
            const tools = createResponsesFileTools({ files });
            const result = await tools.execute(fakeCall("nope", {}));
            const parsed = JSON.parse(result.output) as { error: string };

            expect(parsed.error).toMatch(/Unknown tool/);
        });

        it("returns an error output for invalid JSON arguments", async () => {
            const tools = createResponsesFileTools({ files });
            const result = await tools.execute({
                arguments: "{not json",
                call_id: "broken",
                name: "getFileMetadata",
                type: "function_call",
            });
            const parsed = JSON.parse(result.output) as { error: string };

            expect(parsed.error).toMatch(/Invalid JSON/);
        });

        it("returns validation issues for malformed input", async () => {
            const tools = createResponsesFileTools({ files });
            const result = await tools.execute(fakeCall("getFileMetadata", {}));
            const parsed = JSON.parse(result.output) as { error: string; issues: unknown };

            expect(parsed.error).toBe("Argument validation failed");
            expect(parsed.issues).toBeDefined();
        });
    });

    describe(createAgentsFileTools, () => {
        it("returns a tool record keyed by camelCase tool names", () => {
            const tools = createAgentsFileTools({ files });

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

        it("requires approval on write tools by default", () => {
            const tools = createAgentsFileTools({ files });

            // The Agents SDK normalizes `needsApproval` to a callback. Just
            // assert that writes have one and reads do not.
            expectTypeOf(tools.uploadFile.needsApproval).toBeFunction();
            expectTypeOf(tools.deleteFile.needsApproval).toBeFunction();
            expectTypeOf(tools.copyFile.needsApproval).toBeFunction();
            expectTypeOf(tools.signUploadUrl.needsApproval).toBeFunction();
        });

        it("omits writes when readOnly: true", () => {
            const tools = createAgentsFileTools({ files, readOnly: true });

            expect(Object.keys(tools).toSorted()).toEqual(["downloadFile", "getFileMetadata", "getFileUrl", "listFiles"]);
        });
    });
});
