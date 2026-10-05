import { Window } from "happy-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMultipartAdapter } from "../../src/core/multipart-adapter";
import type { BatchState, UploaderEventType, UploadItem } from "../../src/core/uploader";
import { dispatch, subscribe } from "../../src/core/uploader";
import type { LiveServer } from "./server";
import { BACKENDS, LIVE, pattern, startServer, storedBytes } from "./server";

/** The stored upload's id, from the handler's JSON response. */
const responseId = (item: UploadItem): string => (item.uploadResponse?.data as { id: string }).id;

describe.runIf(LIVE).each(Object.entries(BACKENDS))("multipart adapter against %s (live)", (_name, createBackend) => {
    let cleanup: () => Promise<void>;
    let server: LiveServer;
    let page: Window;

    beforeEach(async () => {
        const backend = await createBackend();

        server = await startServer(backend.storage);
        // The uploader's XMLHttpRequest and FormData come from a page on the server's origin, so the
        // uploads are same-origin. Only those are swapped in: the storage keeps Node's fetch.
        page = new Window({ url: server.origin });
        vi.stubGlobal("XMLHttpRequest", page.XMLHttpRequest);
        vi.stubGlobal("FormData", page.FormData);
        cleanup = async () => {
            vi.unstubAllGlobals();
            await page.happyDOM.close();
            await server.close();
            await backend.cleanup();
        };
    });

    afterEach(async () => {
        await cleanup();
    });

    const endpoint = (): string => `${server.origin}/multipart`;
    const createFile = (content: Uint8Array, name = "upload.bin"): File =>
        new page.File([content], name, { type: "application/octet-stream" }) as unknown as File;

    it("uploads a small file intact", async () => {
        expect.assertions(2);

        const content = pattern(64 * 1024);
        const result = await createMultipartAdapter({ endpoint: endpoint() }).upload(createFile(content));

        expect(server.completed).toStrictEqual([result.id]);
        expect(Buffer.compare(await storedBytes(server.storage, result.id), content)).toBe(0);
    });

    it("uploads a batch, each file intact", async () => {
        expect.assertions(5);

        const contents = [pattern(1024, 1), pattern(32 * 1024, 2), pattern(256 * 1024, 3)];
        const { uploadBatch, uploader } = createMultipartAdapter({ endpoint: endpoint() });
        const finished = new Promise<BatchState>((resolve) => {
            uploader.on("BATCH_FINISH", (batch) => {
                resolve(batch as BatchState);
            });
        });

        const itemIds = uploadBatch(contents.map((content, index) => createFile(content, `file-${String(index)}.bin`)));

        await expect(finished).resolves.toMatchObject({ completedCount: 3, status: "completed" });

        const ids = itemIds.map((itemId) => responseId(uploader.getItem(itemId) as UploadItem));

        expect(server.completed).toStrictEqual(expect.arrayContaining(ids));
        expect(server.completed).toHaveLength(3);

        const stored = await Promise.all(ids.map(async (id) => storedBytes(server.storage, id)));

        expect(stored.map((bytes, index) => Buffer.compare(bytes, contents[index] as Uint8Array))).toStrictEqual([0, 0, 0]);
        expect(server.requests.filter(({ method }) => method === "POST")).toHaveLength(3);
    });

    it("lets subscribe() observe a real upload's events", async () => {
        expect.assertions(3);

        const events: { event: UploaderEventType; item: UploadItem }[] = [];
        const unsubscribes = (["ITEM_START", "ITEM_FINISH"] as const).map((event) =>
            subscribe(endpoint(), event, (item) => {
                events.push({ event, item: item as UploadItem });
            }),
        );

        try {
            const result = await createMultipartAdapter({ endpoint: endpoint() }).upload(createFile(pattern(8 * 1024)));

            expect(events.map(({ event }) => event)).toStrictEqual(["ITEM_START", "ITEM_FINISH"]);
            expect(events[1]?.item.status).toBe("completed");
            expect(responseId(events[1]?.item as UploadItem)).toBe(result.id);
        } finally {
            for (const unsubscribe of unsubscribes) {
                unsubscribe();
            }
        }
    });

    it("stops a real in-flight upload on dispatch(abortAll), and nothing is stored as completed", async () => {
        expect.assertions(3);

        const aborted: UploadItem[] = [];
        const unsubscribe = subscribe(endpoint(), "ITEM_ABORT", (item) => {
            aborted.push(item as UploadItem);
        });

        // Abort once the request reached the server, while its body is still on the wire.
        server.onRequest = (request) => {
            if (request.method === "POST") {
                dispatch(endpoint(), { type: "abortAll" });
            }
        };

        try {
            await expect(createMultipartAdapter({ endpoint: endpoint() }).upload(createFile(pattern(8 * 1024 * 1024)))).rejects.toThrow("Upload aborted");
        } finally {
            unsubscribe();
        }

        // Let the handler finish reading the broken request.
        await new Promise((resolve) => {
            setTimeout(resolve, 200);
        });

        expect(aborted).toHaveLength(1);
        expect(server.completed).toHaveLength(0);
    });

    it("refuses a file over maxFileSize before sending any request", async () => {
        expect.assertions(2);

        const adapter = createMultipartAdapter({ endpoint: endpoint(), restrictions: { maxFileSize: 1024 } });

        await expect(adapter.upload(createFile(pattern(2048)))).rejects.toThrow("too large");

        expect(server.requests).toHaveLength(0);
    });
});
