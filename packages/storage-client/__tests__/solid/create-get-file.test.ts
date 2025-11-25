import { QueryClient } from "@tanstack/solid-query";
import { createSignal } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createGetFile } from "../../src/solid/create-get-file";
import { runInRoot } from "./test-utils";

// Mock fetch globally
const mockFetch = vi.fn();

describe(createGetFile, () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                mutations: { retry: false },
                queries: { retry: false },
            },
        });
        globalThis.fetch = mockFetch;
        vi.clearAllMocks();
    });

    it("should fetch file successfully", async () => {
        expect.assertions(4);

        const mockBlob = new Blob(["test content"], { type: "image/jpeg" });
        const mockHeaders = new Headers({
            "Content-Length": "12",
            "Content-Type": "image/jpeg",
        });

        mockFetch.mockResolvedValueOnce({
            blob: () => Promise.resolve(mockBlob),
            headers: mockHeaders,
            ok: true,
        });

        const result = runInRoot(() =>
            createGetFile({
                endpoint: "https://api.example.com",
                id: "file-123",
                queryClient,
            }),
        );

        // Wait for query to complete
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(mockFetch).toHaveBeenCalledWith(
            "https://api.example.com/file-123",
            expect.objectContaining({
                method: "GET",
            }),
        );

        if (result.error()) {
            console.error("Query Error:", result.error());
        }

        expect(result.data()).toBeDefined();
        expect(result.data()?.size).toBe(mockBlob.size);
        expect(result.error()).toBeUndefined();
    });

    it("should handle reactive id changes", async () => {
        // expect.assertions(2);

        const [id, setId] = createSignal("file-123");
        const mockBlob1 = new Blob(["content 1"], { type: "image/jpeg" });
        const mockBlob2 = new Blob(["content 2"], { type: "image/jpeg" });

        mockFetch
            .mockResolvedValueOnce({
                blob: () => Promise.resolve(mockBlob1),
                headers: new Headers({ "Content-Type": "image/jpeg" }),
                ok: true,
            })
            .mockResolvedValueOnce({
                blob: () => Promise.resolve(mockBlob2),
                headers: new Headers({ "Content-Type": "image/jpeg" }),
                ok: true,
            });

        const result = runInRoot(() =>
            createGetFile({
                endpoint: "https://api.example.com",
                id,
                queryClient,
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(result.data()).toBeDefined();
        expect(result.data()?.size).toBe(mockBlob1.size);

        setId("file-456");

        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(result.data()).toBeDefined();
        expect(result.data()?.size).toBe(mockBlob2.size);
    });

    it("should respect enabled option", async () => {
        expect.assertions(1);

        const [enabled, setEnabled] = createSignal(false);

        runInRoot(() =>
            createGetFile({
                enabled,
                endpoint: "https://api.example.com",
                id: "file-123",
                queryClient,
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 50));

        // Query should not run when disabled
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should support transformation parameters", async () => {
        expect.assertions(1);

        const mockBlob = new Blob(["transformed"], { type: "image/png" });

        mockFetch.mockResolvedValueOnce({
            blob: () => Promise.resolve(mockBlob),
            headers: new Headers({ "Content-Type": "image/png" }),
            ok: true,
        });

        runInRoot(() =>
            createGetFile({
                endpoint: "https://api.example.com",
                id: "file-123",
                queryClient,
                transform: { format: "png", width: 200 },
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("format=png"), expect.any(Object));
    });
});
