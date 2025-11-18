import { QueryClient } from "@tanstack/vue-query";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useGetFile } from "../use-get-file";
import { withQueryClient } from "./test-utils";

// Mock fetch globally
const mockFetch = vi.fn();

describe("useGetFile", () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        });
        globalThis.fetch = mockFetch;
        vi.clearAllMocks();
    });

    it("should fetch file successfully", async () => {
        expect.assertions(5);

        const mockBlob = new Blob(["test content"], { type: "image/jpeg" });
        const mockHeaders = new Headers({
            "Content-Type": "image/jpeg",
            "Content-Length": "12",
        });

        mockFetch.mockResolvedValueOnce({
            ok: true,
            blob: () => Promise.resolve(mockBlob),
            headers: mockHeaders,
        });

        const { result } = withQueryClient(
            () =>
                useGetFile({
                    endpoint: "https://api.example.com",
                    id: "file-123",
                }),
            queryClient
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Compare blob content instead of reference
        expect(result.data.value).toBeDefined();
        expect(result.data.value?.type).toBe(mockBlob.type);
        expect(result.data.value?.size).toBe(mockBlob.size);
        expect(result.error.value).toBeNull();
        expect(result.isLoading.value).toBe(false);
    });

    it("should handle reactive id changes", async () => {
        expect.assertions(4);

        const id = ref("file-123");
        const mockBlob1 = new Blob(["content 1"], { type: "image/jpeg" });
        const mockBlob2 = new Blob(["content 2"], { type: "image/jpeg" });

        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                blob: () => Promise.resolve(mockBlob1),
                headers: new Headers({ "Content-Type": "image/jpeg" }),
            })
            .mockResolvedValueOnce({
                ok: true,
                blob: () => Promise.resolve(mockBlob2),
                headers: new Headers({ "Content-Type": "image/jpeg" }),
            });

        const { result } = withQueryClient(
            () =>
                useGetFile({
                    endpoint: "https://api.example.com",
                    id,
                }),
            queryClient
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Compare blob content instead of reference
        expect(result.data.value).toBeDefined();
        expect(result.data.value?.size).toBe(mockBlob1.size);

        id.value = "file-456";

        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(result.data.value).toBeDefined();
        expect(result.data.value?.size).toBe(mockBlob2.size);
    });

    it("should respect enabled option", async () => {
        expect.assertions(1);

        const enabled = ref(false);

        withQueryClient(
            () =>
                useGetFile({
                    endpoint: "https://api.example.com",
                    id: "file-123",
                    enabled,
                }),
            queryClient
        );

        await new Promise((resolve) => setTimeout(resolve, 50));

        // Query should not run when disabled
        expect(mockFetch).not.toHaveBeenCalled();
    });
});

