import { QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTransformMetadata } from "../../src/react/use-transform-metadata";
import { renderHookWithQueryClient } from "./test-utils";

// Mock fetch globally
const mockFetch = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();
let originalFetch: typeof globalThis.fetch | undefined;

describe(useTransformMetadata, () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                mutations: { retry: false },
                queries: { retry: false },
            },
        });
        originalFetch = globalThis.fetch;
        globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;
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

    it("should fetch transform metadata successfully", async () => {
        expect.assertions(5);

        const mockMetadata = {
            formats: ["jpeg", "png", "webp"],
            parameters: ["width", "height", "quality", "format"],
        };

        mockFetch.mockResolvedValueOnce({
            json: async () => mockMetadata,
            ok: true,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useTransformMetadata({
                    endpoint: "https://api.example.com",
                }),
            { queryClient },
        );

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data).toStrictEqual(mockMetadata);
        expect(result.current.error).toBeUndefined();
        expect(result.current.data?.formats).toStrictEqual(["jpeg", "png", "webp"]);
    });

    it("should call onSuccess callback", async () => {
        expect.assertions(2);

        const onSuccess = vi.fn<[unknown], void>();
        const mockMetadata = {
            formats: ["jpeg", "png"],
            parameters: ["width", "height"],
        };

        mockFetch.mockResolvedValueOnce({
            json: async () => mockMetadata,
            ok: true,
        });

        renderHookWithQueryClient(
            () =>
                useTransformMetadata({
                    endpoint: "https://api.example.com",
                    onSuccess,
                }),
            { queryClient },
        );

        await waitFor(() => {
            expect(onSuccess).toHaveBeenCalledWith(mockMetadata);
        });
    });

    it("should handle error and call onError callback", async () => {
        expect.assertions(2);

        const onError = vi.fn<[Error], void>();

        mockFetch.mockResolvedValueOnce({
            json: async () => {
                return {
                    error: {
                        code: "RequestFailed",
                        message: "Failed to fetch metadata",
                    },
                };
            },
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
        });

        renderHookWithQueryClient(
            () =>
                useTransformMetadata({
                    endpoint: "https://api.example.com",
                    onError,
                }),
            { queryClient },
        );

        await waitFor(() => {
            expect(onError).toHaveBeenCalledWith(expect.any(Error));
        });
    });

    it("should handle metadata with partial data", async () => {
        expect.assertions(3);

        const mockMetadata = {
            formats: ["jpeg"],
        };

        mockFetch.mockResolvedValueOnce({
            json: async () => mockMetadata,
            ok: true,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useTransformMetadata({
                    endpoint: "https://api.example.com",
                }),
            { queryClient },
        );

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data).toStrictEqual({
            formats: ["jpeg"],
            parameters: undefined,
        });
    });

    it("should respect enabled option", async () => {
        expect.assertions(2);

        const { result } = renderHookWithQueryClient(
            () =>
                useTransformMetadata({
                    enabled: false,
                    endpoint: "https://api.example.com",
                }),
            { queryClient },
        );

        expect(result.current.isLoading).toBe(false);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should refetch transform metadata", async () => {
        expect.assertions(3);

        const mockMetadata = {
            formats: ["jpeg", "png"],
            parameters: ["width", "height"],
        };

        mockFetch.mockResolvedValue({
            json: async () => mockMetadata,
            ok: true,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useTransformMetadata({
                    endpoint: "https://api.example.com",
                }),
            { queryClient },
        );

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        result.current.refetch();

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });
});
