import { QueryClient } from "@tanstack/vue-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePutFile } from "../../src/vue/use-put-file";
import { MockXMLHttpRequest } from "../mock-xhr";
import { waitForReady, withQueryClient } from "./test-utils";

class SuccessXHR extends MockXMLHttpRequest {
    public override send = vi.fn(() => {
        setTimeout(() => {
            const progressHandlers = this.uploadEventListeners.get("progress");

            if (progressHandlers) {
                const progressEvent = {
                    lengthComputable: true,
                    loaded: 50,
                    total: 100,
                } as ProgressEvent;

                progressHandlers.forEach((handler) => {
                    handler(progressEvent);
                });
            }
        }, 10);

        setTimeout(() => {
            this.readyState = 4;
            this.status = 200;
            this.responseText = JSON.stringify({ id: "file-123" });

            const handlers = this.eventListeners.get("load");

            if (handlers) {
                handlers.forEach((handler) => {
                    handler(new Event("load"));
                });
            }
        }, 50);
    });

    public override getResponseHeader = vi.fn((header: string) => {
        if (header === "Location") {
            return "https://api.example.com/files/file-123";
        }

        if (header === "ETag") {
            return "\"test-etag\"";
        }

        return undefined;
    });
}

describe(usePutFile, () => {
    let queryClient: QueryClient;
    let originalXHR: typeof XMLHttpRequest;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                mutations: { retry: false },
                queries: { retry: false },
            },
        });
        originalXHR = globalThis.XMLHttpRequest;
        // @ts-expect-error - Mock XMLHttpRequest
        globalThis.XMLHttpRequest = SuccessXHR as unknown as typeof XMLHttpRequest;
        vi.clearAllMocks();
    });

    afterEach(() => {
        globalThis.XMLHttpRequest = originalXHR;
    });

    it("uploads a file and exposes its result", async () => {
        expect.assertions(2);

        const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });

        const { result, unmount } = withQueryClient(
            () =>
                usePutFile({
                    endpoint: "https://api.example.com",
                }),
            queryClient,
        );

        const uploaded = await result.putFile("file-123", file);

        expect(uploaded.id).toBe("file-123");
        expect(uploaded.url).toContain("file-123");

        unmount();
    });

    it("forwards progress events to onProgress", async () => {
        expect.assertions(1);

        const onProgress = vi.fn();
        const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });

        const { result, unmount } = withQueryClient(
            () =>
                usePutFile({
                    endpoint: "https://api.example.com",
                    onProgress,
                }),
            queryClient,
        );

        await result.putFile("file-123", file);

        expect(onProgress).toHaveBeenCalledWith(50);

        unmount();
    });

    it("resets state", async () => {
        expect.assertions(2);

        const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });

        const { result, unmount } = withQueryClient(
            () =>
                usePutFile({
                    endpoint: "https://api.example.com",
                }),
            queryClient,
        );

        await result.putFile("file-123", file);

        result.reset();

        await waitForReady(() => result.data.value === undefined);

        expect(result.data.value).toBeUndefined();
        expect(result.progress.value).toBe(0);

        unmount();
    });
});
