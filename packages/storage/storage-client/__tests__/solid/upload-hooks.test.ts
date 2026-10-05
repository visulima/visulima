import { createRoot } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createBatchUpload } from "../../src/solid/create-batch-upload";
import { createChunkedRestUpload } from "../../src/solid/create-chunked-rest-upload";
import { createFileInput } from "../../src/solid/create-file-input";
import { createMultipartUpload } from "../../src/solid/create-multipart-upload";
import { createPasteUpload } from "../../src/solid/create-paste-upload";
import { createTusUpload } from "../../src/solid/create-tus-upload";
import { createUpload } from "../../src/solid/create-upload";
import { createFailingFetch, createHangingPatchFetch, FailingXMLHttpRequest, HangingXMLHttpRequest, patchSignal } from "../upload-mocks";

// Runs a primitive inside a root so its `onMount` / `onCleanup` fire; `unmount` disposes the root.
const withRoot = async <T>(primitive: () => T): Promise<{ result: T; unmount: () => void }> => {
    let result: T | undefined;
    let unmount: () => void = () => {};

    createRoot((dispose) => {
        unmount = dispose;
        result = primitive();
    });

    // onMount runs after the root is created — flush microtasks.
    await Promise.resolve();
    await Promise.resolve();

    return { result: result as T, unmount };
};

const waitForReady = async (check: () => boolean): Promise<void> => {
    for (let index = 0; index < 50 && !check(); index += 1) {
        await new Promise((resolve) => {
            setTimeout(resolve, 20);
        });
    }
};

const endpoint = "https://api.example.com/upload";

describe("solid upload primitives", () => {
    const originalFetch = globalThis.fetch;
    const originalXHR = globalThis.XMLHttpRequest;

    beforeEach(() => {
        vi.spyOn(console, "debug").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        globalThis.XMLHttpRequest = originalXHR;
        vi.restoreAllMocks();
    });

    describe.each([
        ["createTusUpload", createTusUpload],
        ["createChunkedRestUpload", createChunkedRestUpload],
    ] as const)("%s", (_name, createHook) => {
        it("should call onError once when the upload fails", async () => {
            expect.assertions(2);

            globalThis.fetch = createFailingFetch();

            const onError = vi.fn();
            const { result } = await withRoot(() => createHook({ endpoint, onError }));

            await expect(result.upload(new File(["test content"], "test.txt"))).rejects.toThrow("400");
            expect(onError).toHaveBeenCalledTimes(1);
        });

        it("should abort the in-flight upload on unmount", async () => {
            expect.assertions(1);

            const fetchMock = createHangingPatchFetch();

            globalThis.fetch = fetchMock;

            const { result, unmount } = await withRoot(() => createHook({ endpoint }));
            const uploadPromise = result.upload(new File(["test content"], "test.txt"));

            await waitForReady(() => patchSignal(fetchMock) !== undefined);

            unmount();

            await expect(uploadPromise).rejects.toThrow(/abort/i);
        });
    });

    describe(createMultipartUpload, () => {
        it("should call onError once when the upload fails", async () => {
            expect.assertions(2);

            globalThis.XMLHttpRequest = FailingXMLHttpRequest as unknown as typeof XMLHttpRequest;

            const onError = vi.fn();
            const { result } = await withRoot(() => createMultipartUpload({ endpoint, onError }));

            await expect(result.upload(new File(["test content"], "test.jpg"))).rejects.toThrow("Network error");
            expect(onError).toHaveBeenCalledTimes(1);
        });

        it("should abort the in-flight upload on unmount", async () => {
            expect.assertions(1);

            globalThis.XMLHttpRequest = HangingXMLHttpRequest as unknown as typeof XMLHttpRequest;
            HangingXMLHttpRequest.sent.length = 0;

            const { result, unmount } = await withRoot(() => createMultipartUpload({ endpoint }));
            const uploadPromise = result.upload(new File(["test content"], "test.jpg"));

            await waitForReady(() => HangingXMLHttpRequest.sent.length > 0);

            unmount();

            await expect(uploadPromise).rejects.toThrow("Upload aborted");
        });
    });

    describe(createBatchUpload, () => {
        it("should abort the in-flight batch on unmount", async () => {
            expect.assertions(1);

            globalThis.XMLHttpRequest = HangingXMLHttpRequest as unknown as typeof XMLHttpRequest;
            HangingXMLHttpRequest.sent.length = 0;

            const { result, unmount } = await withRoot(() => createBatchUpload({ endpoint }));

            result.uploadBatch([new File(["test1"], "test1.jpg")]);

            await waitForReady(() => HangingXMLHttpRequest.sent.length > 0);

            unmount();

            expect(HangingXMLHttpRequest.sent[0]?.abort).toHaveBeenCalledWith();
        });
    });

    describe(createUpload, () => {
        it("should report the method of the latest upload in auto mode", async () => {
            expect.assertions(2);

            const chunkedFetch = createHangingPatchFetch();
            const tusFile = new File(["large file"], "large.txt");

            globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
                if (!url.startsWith("https://api.example.com/tus")) {
                    return chunkedFetch(url, init);
                }

                if (init?.method === "POST") {
                    return { headers: new Headers({ Location: "https://api.example.com/tus/file-1" }), ok: true, status: 201 };
                }

                return { headers: new Headers({ "Upload-Offset": String(tusFile.size) }), ok: true, status: init?.method === "PATCH" ? 204 : 200 };
            }) as unknown as typeof fetch;

            const { result, unmount } = await withRoot(() =>
                createUpload({ endpointChunkedRest: "https://api.example.com/chunked", endpointTus: "https://api.example.com/tus", tusThreshold: 5 }),
            );

            await result.upload(tusFile);

            result.upload(new File(["abc"], "small.txt")).catch(() => {});

            await waitForReady(() => result.isUploading());

            expect(result.currentMethod()).toBe("chunked-rest");
            expect(result.isUploading()).toBe(true);

            unmount();
        });
    });

    describe(createPasteUpload, () => {
        it("should handle a paste inside the element once", async () => {
            expect.assertions(1);

            const onFilesPasted = vi.fn();
            const { result, unmount } = await withRoot(() => createPasteUpload({ onFilesPasted }));
            const target = document.createElement("div");

            target.addEventListener("paste", result.handlePaste);
            document.body.append(target);

            const pasteEvent = new ClipboardEvent("paste", { bubbles: true, cancelable: true });

            Object.defineProperty(pasteEvent, "clipboardData", {
                value: { items: [{ getAsFile: () => new File(["test"], "test.jpg"), kind: "file" }] },
            });

            target.dispatchEvent(pasteEvent);

            expect(onFilesPasted).toHaveBeenCalledTimes(1);

            target.remove();
            unmount();
        });
    });

    describe(createFileInput, () => {
        it("should stop dragging once the drag leaves the page outside the drop zone", async () => {
            expect.assertions(2);

            const { result, unmount } = await withRoot(() => createFileInput());
            const outside = document.createElement("div");

            document.body.append(outside);
            outside.dispatchEvent(new Event("dragenter", { bubbles: true }));

            expect(result.isDragging()).toBe(true);

            outside.dispatchEvent(new Event("dragleave", { bubbles: true }));

            expect(result.isDragging()).toBe(false);

            outside.remove();
            unmount();
        });
    });
});
