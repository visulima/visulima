import { waitFor } from "@testing-library/svelte";
import { get, writable } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CreateGetFileOptions, CreateGetFileReturn } from "../../src/svelte/create-get-file";
import { createGetFile } from "../../src/svelte/create-get-file";
import { mountFactory } from "./test-utils";

const mockFetch = vi.fn();
let originalFetch: typeof globalThis.fetch | undefined;

const mountGetFile = (options: CreateGetFileOptions): CreateGetFileReturn => mountFactory(() => createGetFile(options));

const fileResponse = (content: string): Record<string, unknown> => {
    return {
        blob: async () => new Blob([content], { type: "image/jpeg" }),
        headers: new Headers({ "Content-Length": String(content.length), "Content-Type": "image/jpeg" }),
        ok: true,
    };
};

describe(createGetFile, () => {
    beforeEach(() => {
        originalFetch = globalThis.fetch;
        // @ts-expect-error - Mocking fetch for tests
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

    it("exposes the fetched blob, meta and loading state, and calls onSuccess", async () => {
        expect.hasAssertions();

        mockFetch.mockResolvedValueOnce(fileResponse("test content"));

        const onSuccess = vi.fn();
        const result = mountGetFile({ endpoint: "https://api.example.com", id: "file-123", onSuccess });

        await waitFor(() => {
            expect(get(result.data)?.size).toBe(12);
        });

        expect(get(result.isLoading)).toBe(false);
        expect(get(result.meta)?.contentType).toBe("image/jpeg");
        expect(get(result.error)).toBeUndefined();
        expect(onSuccess).toHaveBeenCalledWith(expect.any(Blob), expect.objectContaining({ id: "file-123" }));
    });

    it("exposes the error and calls onError when the request fails", async () => {
        expect.hasAssertions();

        mockFetch.mockResolvedValueOnce({
            json: async () => {
                return { error: { code: "NotFound", message: "File not found" } };
            },
            ok: false,
            status: 404,
            statusText: "Not Found",
        });

        const onError = vi.fn();
        const result = mountGetFile({ endpoint: "https://api.example.com", id: "missing", onError });

        await waitFor(() => {
            expect(get(result.error)?.message).toBe("File not found");
        });

        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "File not found" }));
    });

    it("refetches when the id store changes", async () => {
        expect.hasAssertions();

        mockFetch.mockResolvedValueOnce(fileResponse("content 1")).mockResolvedValueOnce(fileResponse("content 22"));

        const id = writable("file-123");
        const result = mountGetFile({ endpoint: "https://api.example.com", id });

        await waitFor(() => {
            expect(get(result.data)?.size).toBe(9);
        });

        id.set("file-456");

        await waitFor(() => {
            expect(get(result.data)?.size).toBe(10);
        });

        expect(mockFetch).toHaveBeenLastCalledWith("https://api.example.com/file-456", expect.objectContaining({ method: "GET" }));
    });

    it("does not fetch while disabled", async () => {
        expect.hasAssertions();

        mountGetFile({ enabled: writable(false), endpoint: "https://api.example.com", id: "file-123" });

        await new Promise<void>((resolve) => {
            setTimeout(resolve, 50);
        });

        expect(mockFetch).not.toHaveBeenCalled();
    });
});
