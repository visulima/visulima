import { QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithQueryClient } from "./test-utils";
import { useGetFile } from "../use-get-file";

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
        expect.assertions(4);

        const mockBlob = new Blob(["test content"], { type: "image/jpeg" });
        const mockHeaders = new Headers({
            "Content-Type": "image/jpeg",
            "Content-Length": "12",
            "ETag": '"test-etag"',
            "Last-Modified": "Wed, 21 Oct 2015 07:28:00 GMT",
        });

        mockFetch.mockResolvedValueOnce({
            ok: true,
            blob: () => Promise.resolve(mockBlob),
            headers: mockHeaders,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useGetFile({
                    endpoint: "https://api.example.com",
                    id: "file-123",
                }),
            { queryClient }
        );

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data).toBe(mockBlob);
        expect(result.current.error).toBeNull();
        expect(result.current.meta).toMatchObject({
            contentType: "image/jpeg",
            id: "file-123",
            size: 12,
        });
    });

    it("should handle fetch errors", async () => {
        expect.assertions(3);

        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: "Not Found",
            json: () => Promise.resolve({ error: { message: "File not found" } }),
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useGetFile({
                    endpoint: "https://api.example.com",
                    id: "non-existent",
                }),
            { queryClient }
        );

        await waitFor(() => {
            expect(result.current.error).not.toBeNull();
        });

        expect(result.current.error?.message).toContain("File not found");
        expect(result.current.data).toBeUndefined();
    });

    it("should support transformation parameters", async () => {
        expect.assertions(2);

        const mockBlob = new Blob(["transformed content"], { type: "image/png" });

        mockFetch.mockResolvedValueOnce({
            ok: true,
            blob: () => Promise.resolve(mockBlob),
            headers: new Headers({ "Content-Type": "image/png" }),
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useGetFile({
                    endpoint: "https://api.example.com",
                    id: "file-123",
                    transform: { format: "png", width: 200, quality: 90 },
                }),
            { queryClient }
        );

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining("format=png"),
            expect.any(Object)
        );
        expect(result.current.data).toBe(mockBlob);
    });

    it("should respect enabled option", async () => {
        expect.assertions(1);

        const { result } = renderHookWithQueryClient(
            () =>
                useGetFile({
                    endpoint: "https://api.example.com",
                    id: "file-123",
                    enabled: false,
                }),
            { queryClient }
        );

        // Query should not run when disabled
        expect(mockFetch).not.toHaveBeenCalled();
        expect(result.current.isLoading).toBe(false);
    });

    it("should call onSuccess callback", async () => {
        expect.assertions(2);

        const onSuccess = vi.fn();
        const mockBlob = new Blob(["test"], { type: "image/jpeg" });

        mockFetch.mockResolvedValueOnce({
            ok: true,
            blob: () => Promise.resolve(mockBlob),
            headers: new Headers({ "Content-Type": "image/jpeg" }),
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useGetFile({
                    endpoint: "https://api.example.com",
                    id: "file-123",
                    onSuccess,
                }),
            { queryClient }
        );

        await waitFor(() => {
            expect(result.current.data).toBeDefined();
        });

        await waitFor(() => {
            expect(onSuccess).toHaveBeenCalledWith(mockBlob, expect.any(Object));
        });
    });

    it("should call onError callback", async () => {
        expect.assertions(1);

        const onError = vi.fn();

        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
            json: () => Promise.resolve({ error: { message: "Server error" } }),
        });

        renderHookWithQueryClient(
            () =>
                useGetFile({
                    endpoint: "https://api.example.com",
                    id: "file-123",
                    onError,
                }),
            { queryClient }
        );

        await waitFor(() => {
            expect(onError).toHaveBeenCalledWith(expect.any(Error));
        });
    });

    it("should refetch when refetch is called", async () => {
        expect.assertions(2);

        const mockBlob = new Blob(["test"], { type: "image/jpeg" });

        mockFetch.mockResolvedValue({
            ok: true,
            blob: () => Promise.resolve(mockBlob),
            headers: new Headers({ "Content-Type": "image/jpeg" }),
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useGetFile({
                    endpoint: "https://api.example.com",
                    id: "file-123",
                }),
            { queryClient }
        );

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        const initialCallCount = mockFetch.mock.calls.length;

        result.current.refetch();

        await waitFor(() => {
            expect(mockFetch.mock.calls.length).toBeGreaterThan(initialCallCount);
        });
    });
});

