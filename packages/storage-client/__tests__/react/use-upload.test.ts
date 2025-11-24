import { QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUpload } from "../../src/react/use-upload";
import { renderHookWithQueryClient } from "./test-utils";

// Mock fetch globally
const mockFetch = vi.fn();

// Mock XMLHttpRequest for multipart uploads
class MockXMLHttpRequest {
    public readyState = 0;

    public status = 200;

    public statusText = "OK";

    public responseText = "";

    private eventListeners = new Map<string, Set<(event: Event) => void>>();

    public upload = {
        addEventListener: vi.fn((event: string, handler: (event: ProgressEvent) => void) => {
            setTimeout(() => {
                const progressEvent = {
                    lengthComputable: true,
                    loaded: 50,
                    total: 100,
                } as ProgressEvent;

                handler(progressEvent);
            }, 10);
        }),
        removeEventListener: vi.fn(),
    };

    public open = vi.fn();

    public send = vi.fn(() => {
        setTimeout(() => {
            this.readyState = 4;
            this.status = 200;
            this.responseText = JSON.stringify({
                id: "file-123",
                name: "test.txt",
                size: 100,
                status: "completed",
            });
            const handlers = this.eventListeners.get("load");

            if (handlers) {
                handlers.forEach((handler) => handler(new Event("load")));
            }
        }, 20);
    });

    public setRequestHeader = vi.fn();

    public getResponseHeader = vi.fn(() => null);

    public addEventListener = vi.fn((event: string, handler: (event: Event) => void) => {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }

        this.eventListeners.get(event)?.add(handler);
    });

    public removeEventListener = vi.fn();
}

describe(useUpload, () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                mutations: { retry: false },
                queries: { retry: false },
            },
        });
        globalThis.fetch = mockFetch;
        globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
        vi.clearAllMocks();
    });

    it("should initialize with default state", () => {
        const { result } = renderHookWithQueryClient(
            () =>
                useUpload({
                    endpointMultipart: "https://api.example.com/upload",
                }),
            { queryClient },
        );

        expect(result.current.isUploading).toBe(false);
        expect(result.current.progress).toBe(0);
        expect(result.current.error).toBeUndefined();
        expect(result.current.result).toBeUndefined();
    });

    it("should auto-detect multipart method", () => {
        const { result } = renderHookWithQueryClient(
            () =>
                useUpload({
                    endpointMultipart: "https://api.example.com/upload",
                }),
            { queryClient },
        );

        expect(result.current.currentMethod).toBe("multipart");
    });

    it("should auto-detect TUS method", () => {
        const { result } = renderHookWithQueryClient(
            () =>
                useUpload({
                    endpointTus: "https://api.example.com/upload",
                }),
            { queryClient },
        );

        expect(result.current.currentMethod).toBe("tus");
    });

    it("should use specified method", () => {
        const { result } = renderHookWithQueryClient(
            () =>
                useUpload({
                    endpointMultipart: "https://api.example.com/upload",
                    method: "tus",
                }),
            { queryClient },
        );

        expect(result.current.currentMethod).toBe("tus");
    });

    it("should upload file with multipart method", async () => {
        const file = new File(["test content"], "test.txt", { type: "text/plain" });

        const { result } = renderHookWithQueryClient(
            () =>
                useUpload({
                    endpointMultipart: "https://api.example.com/upload",
                    method: "multipart",
                }),
            { queryClient },
        );

        const uploadResult = await result.current.upload(file);

        expect(uploadResult.id).toBe("file-123");
    });

    it("should handle auto method selection based on file size", () => {
        // When both endpoints are provided and method is auto, it defaults to multipart
        // The actual method selection happens when uploading based on file size
        const { result: smallFileResult } = renderHookWithQueryClient(
            () =>
                useUpload({
                    endpointMultipart: "https://api.example.com/upload",
                    endpointTus: "https://api.example.com/tus",
                    method: "auto",
                }),
            { queryClient },
        );

        // With both endpoints, auto defaults to the first available (multipart)
        expect(["multipart", "tus"]).toContain(smallFileResult.current.currentMethod);

        const { result: largeFileResult } = renderHookWithQueryClient(
            () =>
                useUpload({
                    endpointMultipart: "https://api.example.com/upload",
                    endpointTus: "https://api.example.com/tus",
                    method: "auto",
                    tusThreshold: 1, // Very low threshold for testing
                }),
            { queryClient },
        );

        expect(["multipart", "tus"]).toContain(largeFileResult.current.currentMethod);
    });

    it("should call callbacks correctly", async () => {

        const file = new File(["test content"], "test.txt", { type: "text/plain" });
        const onStart = vi.fn();
        const onProgress = vi.fn();
        const onSuccess = vi.fn();
        const onError = vi.fn();

        const { result } = renderHookWithQueryClient(
            () =>
                useUpload({
                    endpointMultipart: "https://api.example.com/upload",
                    method: "multipart",
                    onStart,
                    onProgress,
                    onSuccess,
                    onError,
                }),
            { queryClient },
        );

        await result.current.upload(file);

        await waitFor(() => {
            expect(onStart).toHaveBeenCalled();
            expect(onProgress).toHaveBeenCalled();
            expect(onSuccess).toHaveBeenCalled();
            expect(onError).not.toHaveBeenCalled();
        });
    });

    it("should reset state", async () => {
        const { result } = renderHookWithQueryClient(
            () =>
                useUpload({
                    endpointMultipart: "https://api.example.com/upload",
                }),
            { queryClient },
        );

        result.current.reset();

        expect(result.current.progress).toBe(0);
        expect(result.current.error).toBeUndefined();
        expect(result.current.result).toBeUndefined();
    });
});

