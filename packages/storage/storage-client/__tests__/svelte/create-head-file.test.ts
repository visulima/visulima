import { waitFor } from "@testing-library/svelte";
import { get } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createHeadFile } from "../../src/svelte/create-head-file";
import { mountFactory } from "./test-utils";

const mockFetch = vi.fn();
let originalFetch: typeof globalThis.fetch | undefined;

describe(createHeadFile, () => {
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

    it("extracts content-length and upload-offset from HEAD response headers", async () => {
        expect.hasAssertions();

        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "Content-Length": "1024",
                "X-Upload-Offset": "500",
            }),
            ok: true,
        });

        const result = mountFactory(() =>
            createHeadFile({
                endpoint: "https://api.example.com",
                id: "file-123",
            }),
        );

        await waitFor(() => {
            expect(get(result.data)?.contentLength).toBe(1024);
        });

        expect(get(result.data)?.uploadOffset).toBe(500);
        expect(get(result.isLoading)).toBe(false);
    });

    it("does not fetch when id is empty", async () => {
        expect.assertions(1);

        mountFactory(() =>
            createHeadFile({
                endpoint: "https://api.example.com",
                id: "",
            }),
        );

        // Give the query a tick to potentially fire (it shouldn't)
        await new Promise<void>((resolve) => {
            setTimeout(resolve, 30);
        });

        expect(mockFetch).not.toHaveBeenCalled();
    });
});
