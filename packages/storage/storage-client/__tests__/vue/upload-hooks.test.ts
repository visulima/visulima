import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBatchUpload } from "../../src/vue/use-batch-upload";
import { useChunkedRestUpload } from "../../src/vue/use-chunked-rest-upload";
import { useMultipartUpload } from "../../src/vue/use-multipart-upload";
import { usePasteUpload } from "../../src/vue/use-paste-upload";
import { useTusUpload } from "../../src/vue/use-tus-upload";
import { useUpload } from "../../src/vue/use-upload";
import { createFailingFetch, createHangingPatchFetch, FailingXMLHttpRequest, HangingXMLHttpRequest, patchSignal } from "../upload-mocks";
import { waitForReady, withQueryClient } from "./test-utils";

const endpoint = "https://api.example.com/upload";

describe("vue upload composables", () => {
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
        ["useTusUpload", useTusUpload],
        ["useChunkedRestUpload", useChunkedRestUpload],
    ] as const)("%s", (_name, useHook) => {
        it("should call onError once when the upload fails", async () => {
            expect.assertions(2);

            globalThis.fetch = createFailingFetch();

            const onError = vi.fn();
            const { result } = withQueryClient(() => useHook({ endpoint, onError }));

            await expect(result.upload(new File(["test content"], "test.txt"))).rejects.toThrow("400");
            expect(onError).toHaveBeenCalledTimes(1);
        });

        it("should abort the in-flight upload on unmount", async () => {
            expect.assertions(1);

            const fetchMock = createHangingPatchFetch();

            globalThis.fetch = fetchMock;

            const { result, unmount } = withQueryClient(() => useHook({ endpoint }));
            const uploadPromise = result.upload(new File(["test content"], "test.txt"));

            await waitForReady(() => patchSignal(fetchMock) !== undefined);

            unmount();

            await expect(uploadPromise).rejects.toThrow(/abort/i);
        });
    });

    describe(useMultipartUpload, () => {
        it("should call onError once when the upload fails", async () => {
            expect.assertions(2);

            globalThis.XMLHttpRequest = FailingXMLHttpRequest as unknown as typeof XMLHttpRequest;

            const onError = vi.fn();
            const { result } = withQueryClient(() => useMultipartUpload({ endpoint, onError }));

            await expect(result.upload(new File(["test content"], "test.jpg"))).rejects.toThrow("Network error");
            expect(onError).toHaveBeenCalledTimes(1);
        });

        it("should abort the in-flight upload on unmount", async () => {
            expect.assertions(1);

            globalThis.XMLHttpRequest = HangingXMLHttpRequest as unknown as typeof XMLHttpRequest;
            HangingXMLHttpRequest.sent.length = 0;

            const { result, unmount } = withQueryClient(() => useMultipartUpload({ endpoint }));
            const uploadPromise = result.upload(new File(["test content"], "test.jpg"));

            await waitForReady(() => HangingXMLHttpRequest.sent.length > 0);

            unmount();

            await expect(uploadPromise).rejects.toThrow("Upload aborted");
        });
    });

    describe(useBatchUpload, () => {
        it("should abort the in-flight batch on unmount", async () => {
            expect.assertions(1);

            globalThis.XMLHttpRequest = HangingXMLHttpRequest as unknown as typeof XMLHttpRequest;
            HangingXMLHttpRequest.sent.length = 0;

            const { result, unmount } = withQueryClient(() => useBatchUpload({ endpoint }));

            result.uploadBatch([new File(["test1"], "test1.jpg")]);

            await waitForReady(() => HangingXMLHttpRequest.sent.length > 0);

            unmount();

            expect(HangingXMLHttpRequest.sent[0]?.abort).toHaveBeenCalledWith();
        });
    });

    describe(useUpload, () => {
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

            const { result, unmount } = withQueryClient(() =>
                useUpload({ endpointChunkedRest: "https://api.example.com/chunked", endpointTus: "https://api.example.com/tus", tusThreshold: 5 }),
            );

            await result.upload(tusFile);

            result.upload(new File(["abc"], "small.txt")).catch(() => {});

            await waitForReady(() => result.isUploading.value);

            expect(result.currentMethod.value).toBe("chunked-rest");
            expect(result.isUploading.value).toBe(true);

            unmount();
        });
    });

    describe(usePasteUpload, () => {
        it("should handle a paste inside the element once", () => {
            expect.assertions(1);

            const onFilesPasted = vi.fn();
            const { result, unmount } = withQueryClient(() => usePasteUpload({ onFilesPasted }));
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
});
