import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createChunkedRestAdapter } from "../../src/core/chunked-rest-adapter";
import { createTusAdapter } from "../../src/core/tus-adapter";
import type { UploadRestrictions, UploadResult } from "../../src/core/types";
import type { UrlStorage } from "../../src/core/url-storage";
import { MemoryUrlStorage } from "../../src/core/url-storage";
import type { LiveServer } from "./server";
import { BACKENDS, LIVE, PART_SIZE, pattern, startServer, storedBytes } from "./server";

/** Three chunks: two full 5 MiB parts and a shorter final one. */
const SIZE = 2 * PART_SIZE + 1024 * 1024;

interface ResumableAdapter {
    abort: () => void;
    setOnProgress: (callback: (() => void) | undefined) => void;
    upload: (file: File) => Promise<UploadResult>;
}

type CreateAdapter = (options: { endpoint: string; restrictions?: UploadRestrictions; retry: boolean; urlStorage?: UrlStorage }) => ResumableAdapter;

/** The adapters that send a file in chunks, and where the server mounts their handler. */
const ADAPTERS: Record<string, { create: CreateAdapter; path: string }> = {
    "chunked REST": { create: createChunkedRestAdapter, path: "/rest" },
    tus: { create: createTusAdapter, path: "/tus" },
};

describe.runIf(LIVE).each(Object.entries(ADAPTERS))("%s adapter (live)", (_adapterName, { create: createAdapter, path }) => {
    describe.each(Object.entries(BACKENDS))("against %s", (_name, createBackend) => {
        let cleanup: () => Promise<void>;
        let server: LiveServer;

        beforeEach(async () => {
            const backend = await createBackend();

            server = await startServer(backend.storage);
            cleanup = async () => {
                await server.close();
                await backend.cleanup();
            };
        });

        afterEach(async () => {
            await cleanup();
        });

        const endpoint = (): string => `${server.origin}${path}`;
        const createFile = (content: Uint8Array): File => new File([content], "upload.bin", { type: "application/octet-stream" });
        const patchedBytes = (): number =>
            server.requests.filter(({ method }) => method === "PATCH").reduce((sum, { contentLength }) => sum + contentLength, 0);
        const uploadId = (): string =>
            server.requests
                .find(({ method }) => method === "PATCH")
                ?.url
                .split("/")
                .pop() ?? "";

        it("uploads a multi-chunk file intact", async () => {
            expect.assertions(4);

            const content = pattern(SIZE);
            const result = await createAdapter({ endpoint: endpoint(), retry: false }).upload(createFile(content));

            expect(server.requests.filter(({ method }) => method === "PATCH")).toHaveLength(3);
            expect(result).toMatchObject({ bytesWritten: SIZE, size: SIZE, status: "completed" });
            expect(server.completed).toStrictEqual([result.id]);
            expect(Buffer.compare(await storedBytes(server.storage, result.id), content)).toBe(0);
        });

        it("rejects with an abort when aborted mid-chunk, and the server never completes the upload", async () => {
            expect.assertions(3);

            const adapter = createAdapter({ endpoint: endpoint(), retry: false });

            // Abort while the second chunk is on the wire.
            server.onRequest = (request) => {
                if (request.method === "PATCH" && server.requests.filter(({ method }) => method === "PATCH").length === 2) {
                    adapter.abort();
                }
            };

            await expect(adapter.upload(createFile(pattern(SIZE)))).rejects.toThrow("Upload aborted");

            expect(server.completed).toHaveLength(0);

            const { status } = await server.storage.getMeta(uploadId());

            expect(status).not.toBe("completed");
        });

        it("resumes an interrupted upload from the server's offset, without resending stored bytes", async () => {
            expect.assertions(5);

            const content = pattern(SIZE, 7);
            const file = createFile(content);
            const urlStorage = new MemoryUrlStorage();
            const interrupted = createAdapter({ endpoint: endpoint(), retry: false, urlStorage });

            // Stop once the first chunk is stored.
            interrupted.setOnProgress(() => {
                interrupted.abort();
            });

            await expect(interrupted.upload(file)).rejects.toThrow("Upload aborted");

            expect(patchedBytes()).toBe(PART_SIZE);

            server.requests.length = 0;

            const result = await createAdapter({ endpoint: endpoint(), retry: false, urlStorage }).upload(file);

            // No new upload: the stored one was found and only the missing bytes were sent.
            expect(server.requests.some(({ method }) => method === "POST")).toBe(false);
            expect(patchedBytes()).toBe(SIZE - PART_SIZE);
            expect(Buffer.compare(await storedBytes(server.storage, result.id), content)).toBe(0);
        });

        it("refuses a file over maxFileSize before sending any request", async () => {
            expect.assertions(2);

            const adapter = createAdapter({ endpoint: endpoint(), restrictions: { maxFileSize: 1024 }, retry: false });

            await expect(adapter.upload(createFile(pattern(2048)))).rejects.toThrow("too large");

            expect(server.requests).toHaveLength(0);
        });
    });
});
