import { QueryClient } from "@tanstack/solid-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTransformFile } from "../../src/solid/create-transform-file";
import { runInRoot } from "./test-utils";

const mockFetch = vi.fn();
let originalFetch: typeof globalThis.fetch | undefined;

const flush = (ms = 100): Promise<void> =>
    new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });

describe(createTransformFile, () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                mutations: { retry: false },
                queries: { retry: false },
            },
        });
        originalFetch = globalThis.fetch;
        globalThis.fetch = mockFetch;
        vi.clearAllMocks();
    });

    afterEach(() => {
        if (originalFetch) {
            globalThis.fetch = originalFetch;
        } else {
            delete (globalThis as { fetch?: typeof fetch }).fetch;
        }

        vi.restoreAllMocks();
    });

    it("returns the transformed blob and header metadata", async () => {
        expect.assertions(2);

        const mockBlob = new Blob(["transformed content"], { type: "image/jpeg" });

        mockFetch.mockResolvedValueOnce({
            blob: () => Promise.resolve(mockBlob),
            headers: new Headers({
                "Content-Length": "18",
                "Content-Type": "image/jpeg",
            }),
            ok: true,
            status: 200,
        });

        const result = runInRoot(
            () =>
                createTransformFile({
                    endpoint: "https://api.example.com",
                    id: "file-123",
                    transform: { width: 800 },
                }),
            queryClient,
        );

        await flush();

        expect(result.data()).toBeInstanceOf(Blob);
        expect(result.meta()?.contentType).toBe("image/jpeg");
    });

    it("does not fetch when id is empty", async () => {
        expect.assertions(1);

        runInRoot(
            () =>
                createTransformFile({
                    endpoint: "https://api.example.com",
                    id: "",
                    transform: { width: 800 },
                }),
            queryClient,
        );

        await flush(30);

        expect(mockFetch).not.toHaveBeenCalled();
    });
});
