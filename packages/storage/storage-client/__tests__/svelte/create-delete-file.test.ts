import { waitFor } from "@testing-library/svelte";
import { get } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDeleteFile } from "../../src/svelte/create-delete-file";
import { mountFactory } from "./test-utils";

const mockFetch = vi.fn();
let originalFetch: typeof globalThis.fetch | undefined;

describe(createDeleteFile, () => {
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

    it("should delete file successfully", async () => {
        expect.hasAssertions();

        mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

        const result = mountFactory(() => createDeleteFile({ endpoint: "https://api.example.com" }));

        await result.deleteFile("file-123");

        await waitFor(() => {
            expect(get(result.isLoading)).toBe(false);
        });

        expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/file-123", expect.objectContaining({ method: "DELETE" }));
    });

    it("exposes the error and resets it", async () => {
        expect.hasAssertions();

        mockFetch.mockResolvedValueOnce({
            json: async () => {
                return { error: { code: "NotFound", message: "File not found" } };
            },
            ok: false,
            status: 404,
            statusText: "Not Found",
        });

        const result = mountFactory(() => createDeleteFile({ endpoint: "https://api.example.com" }));

        await expect(result.deleteFile("file-123")).rejects.toBeDefined();

        await waitFor(() => {
            expect(get(result.error)?.message).toBe("File not found");
        });

        result.reset();

        await waitFor(() => {
            expect(get(result.error)).toBeUndefined();
        });
    });

    it("reports isLoading while the request is in flight", async () => {
        expect.hasAssertions();

        let release: (value: unknown) => void = () => {};

        mockFetch.mockReturnValueOnce(
            new Promise((resolve) => {
                release = resolve;
            }),
        );

        const result = mountFactory(() => createDeleteFile({ endpoint: "https://api.example.com" }));
        const pending = result.deleteFile("file-123");

        await waitFor(() => {
            expect(get(result.isLoading)).toBe(true);
        });

        release({ ok: true, status: 204 });
        await pending;

        await waitFor(() => {
            expect(get(result.isLoading)).toBe(false);
        });
    });
});
