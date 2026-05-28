import { QueryClient } from "@tanstack/solid-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createHeadFile } from "../../src/solid/create-head-file";
import { runInRoot } from "./test-utils";

const mockFetch = vi.fn();
let originalFetch: typeof globalThis.fetch | undefined;

const flush = (ms = 100): Promise<void> =>
    new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });

describe(createHeadFile, () => {
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

    it("extracts file size and upload offset from headers", async () => {
        expect.assertions(2);

        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "Content-Length": "1024",
                "X-Upload-Offset": "500",
            }),
            ok: true,
        });

        const result = runInRoot(
            () =>
                createHeadFile({
                    endpoint: "https://api.example.com",
                    id: "file-123",
                }),
            queryClient,
        );

        await flush();

        expect(result.data()?.contentLength).toBe(1024);
        expect(result.data()?.uploadOffset).toBe(500);
    });

    it("does not fetch when id is empty", async () => {
        expect.assertions(1);

        runInRoot(
            () =>
                createHeadFile({
                    endpoint: "https://api.example.com",
                    id: "",
                }),
            queryClient,
        );

        await flush(30);

        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("does not fetch when disabled", async () => {
        expect.assertions(1);

        runInRoot(
            () =>
                createHeadFile({
                    enabled: false,
                    endpoint: "https://api.example.com",
                    id: "file-123",
                }),
            queryClient,
        );

        await flush(30);

        expect(mockFetch).not.toHaveBeenCalled();
    });
});
