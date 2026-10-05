import { render } from "@testing-library/svelte";
import { get } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createBatchUpload } from "../../src/svelte/create-batch-upload";
import { createChunkedRestUpload } from "../../src/svelte/create-chunked-rest-upload";
import { createFileInput } from "../../src/svelte/create-file-input";
import { createMultipartUpload } from "../../src/svelte/create-multipart-upload";
import { createPasteUpload } from "../../src/svelte/create-paste-upload";
import { createTusUpload } from "../../src/svelte/create-tus-upload";
import { createUpload } from "../../src/svelte/create-upload";
import { createFailingFetch, createHangingPatchFetch, FailingXMLHttpRequest, HangingXMLHttpRequest, patchSignal } from "../upload-mocks";
import ListenerHost from "./ListenerHost.svelte";

// Runs a factory inside a mounted component so its `onMount` / `onDestroy` fire.
const withComponent = <T>(factory: () => T): { result: T; unmount: () => void } => {
    let result: T | undefined;
    const { unmount } = render(ListenerHost, {
        props: {
            listener: () => {
                result = factory();
            },
        },
    });

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

describe("svelte upload factories", () => {
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
            const { result } = withComponent(() => createHook({ endpoint, onError }));

            await expect(result.upload(new File(["test content"], "test.txt"))).rejects.toThrow("400");
            expect(onError).toHaveBeenCalledTimes(1);
        });

        it("should abort the in-flight upload on unmount", async () => {
            expect.assertions(1);

            const fetchMock = createHangingPatchFetch();

            globalThis.fetch = fetchMock;

            const { result, unmount } = withComponent(() => createHook({ endpoint }));
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
            const { result } = withComponent(() => createMultipartUpload({ endpoint, onError }));

            await expect(result.upload(new File(["test content"], "test.jpg"))).rejects.toThrow("Network error");
            expect(onError).toHaveBeenCalledTimes(1);
        });

        it("should abort the in-flight upload on unmount", async () => {
            expect.assertions(1);

            globalThis.XMLHttpRequest = HangingXMLHttpRequest as unknown as typeof XMLHttpRequest;
            HangingXMLHttpRequest.sent.length = 0;

            const { result, unmount } = withComponent(() => createMultipartUpload({ endpoint }));
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

            const { result, unmount } = withComponent(() => createBatchUpload({ endpoint }));

            result.uploadBatch([new File(["test1"], "test1.jpg")]);

            await waitForReady(() => HangingXMLHttpRequest.sent.length > 0);

            unmount();

            expect(HangingXMLHttpRequest.sent[0]?.abort).toHaveBeenCalledWith();
        });
    });

    describe(createUpload, () => {
        it("should report the idle state for a method whose endpoint is missing", () => {
            expect.assertions(1);

            const { result, unmount } = withComponent(() => createUpload({ endpointMultipart: endpoint, method: "tus" }));
            const emitted: Record<string, unknown> = {};

            for (const key of ["error", "isPaused", "isUploading", "offset", "progress", "result"] as const) {
                result[key].subscribe((value: unknown) => {
                    emitted[key] = value;
                })();
            }

            expect(emitted).toStrictEqual({
                error: undefined,
                isPaused: undefined,
                isUploading: false,
                offset: undefined,
                progress: 0,
                result: undefined,
            });

            unmount();
        });

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

            const { result, unmount } = withComponent(() =>
                createUpload({
                    endpointChunkedRest: "https://api.example.com/chunked",
                    endpointMultipart: endpoint,
                    endpointTus: "https://api.example.com/tus",
                    tusThreshold: 5,
                }),
            );

            await result.upload(tusFile);

            result.upload(new File(["abc"], "small.txt")).catch(() => {});

            await waitForReady(() => get(result.isUploading));

            expect(get(result.currentMethod)).toBe("chunked-rest");
            expect(get(result.isUploading)).toBe(true);

            unmount();
        });
    });

    describe(createPasteUpload, () => {
        it("should handle a paste inside the element once", () => {
            expect.assertions(1);

            const onFilesPasted = vi.fn();
            const { result, unmount } = withComponent(() => createPasteUpload({ onFilesPasted }));
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
        it("should remove its document dragenter listener on destroy", () => {
            expect.assertions(1);

            const removeEventListener = vi.spyOn(document, "removeEventListener");
            const { unmount } = withComponent(() => createFileInput());

            unmount();

            expect(removeEventListener).toHaveBeenCalledWith("dragenter", expect.any(Function));
        });
    });
});
