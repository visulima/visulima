import { QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTusUpload } from "../../src/react/use-tus-upload";
import { renderHookWithQueryClient } from "./test-utils";

// Mock fetch globally
const mockFetch = vi.fn();

describe(useTusUpload, () => {
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

    it("should initialize with default state", () => {
        const { result } = renderHookWithQueryClient(
            () =>
                useTusUpload({
                    endpoint: "https://api.example.com/upload",
                }),
            { queryClient },
        );

        expect(result.current.isUploading).toBe(false);
        expect(result.current.isPaused).toBe(false);
        expect(result.current.progress).toBe(0);
        expect(result.current.offset).toBe(0);
        expect(result.current.error).toBeUndefined();
        expect(result.current.result).toBeUndefined();
    });

    it("should upload file successfully", async () => {
        const file = new File(["test content"], "test.txt", { type: "text/plain" });
        const uploadUrl = "https://api.example.com/upload/file-123";

        // Mock POST request (create upload) - TUS doesn't use OPTIONS, it directly POSTs
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                Location: uploadUrl,
                "Upload-Offset": "0",
            }),
            ok: true,
            status: 201,
        });

        // Mock PATCH request (upload chunk)
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "Upload-Offset": String(file.size),
            }),
            ok: true,
            status: 204,
        });

        // Mock HEAD request (get final file info after upload completes)
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                Location: uploadUrl,
                "Upload-Metadata": "filename dGVzdC50eHQ=", // base64 encoded "test.txt"
                "Upload-Offset": String(file.size),
            }),
            ok: true,
            status: 200,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useTusUpload({
                    endpoint: "https://api.example.com/upload",
                }),
            { queryClient },
        );

        const uploadResult = await result.current.upload(file);

        expect(uploadResult.id).toBeDefined();
        expect(uploadResult.size).toBe(file.size);
    });

    it("should handle pause and resume", async () => {
        const file = new File(["test content"], "test.txt", { type: "text/plain" });

        // Mock POST (create upload)
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                Location: "https://api.example.com/upload/file-123",
                "Upload-Offset": "0",
            }),
            ok: true,
            status: 201,
        });

        // Mock PATCH and HEAD requests
        let patchCallCount = 0;
        let headCallCount = 0;

        mockFetch.mockImplementation((_url: string, options?: RequestInit) => {
            if (options?.method === "PATCH") {
                patchCallCount += 1;

                if (patchCallCount === 1) {
                    // First PATCH - delay it so we can pause
                    return new Promise((resolve) => {
                        setTimeout(() => {
                            resolve({
                                headers: new Headers({
                                    "Upload-Offset": String(file.size),
                                }),
                                ok: true,
                                status: 204,
                            });
                        }, 200);
                    });
                }

                // Subsequent PATCH calls (when resuming)
                return Promise.resolve({
                    headers: new Headers({
                        "Upload-Offset": String(file.size),
                    }),
                    ok: true,
                    status: 204,
                });
            }

            if (options?.method === "HEAD") {
                headCallCount += 1;

                // HEAD request to get upload offset (when resuming) or final file info
                return Promise.resolve({
                    headers: new Headers({
                        Location: "https://api.example.com/upload/file-123",
                        "Upload-Metadata": "filename dGVzdC50eHQ=",
                        "Upload-Offset": headCallCount === 1 ? "0" : String(file.size),
                    }),
                    ok: true,
                    status: 200,
                });
            }

            return Promise.reject(new Error(`Unexpected method: ${options?.method}`));
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useTusUpload({
                    endpoint: "https://api.example.com/upload",
                }),
            { queryClient },
        );

        const uploadPromise = result.current.upload(file);

        // Wait a bit for upload to start, then pause
        await new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, 50);
        });
        result.current.pause();

        await waitFor(() => {
            expect(result.current.isPaused).toBe(true);
        });

        // Resume the upload
        await result.current.resume();

        await waitFor(
            () => {
                expect(result.current.isPaused).toBe(false);
            },
            { timeout: 3000 },
        );

        await uploadPromise;
    });

    it("should call callbacks correctly", async () => {
        const file = new File(["test content"], "test.txt", { type: "text/plain" });
        const onStart = vi.fn();
        const onProgress = vi.fn();
        const onSuccess = vi.fn();
        const onError = vi.fn();

        // Mock POST (create upload)
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                Location: "https://api.example.com/upload/file-123",
                "Upload-Offset": "0",
            }),
            ok: true,
            status: 201,
        });

        // Mock PATCH (upload chunk)
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "Upload-Offset": String(file.size),
            }),
            ok: true,
            status: 204,
        });

        // Mock HEAD (get final file info)
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                Location: "https://api.example.com/upload/file-123",
                "Upload-Metadata": "filename dGVzdC50eHQ=",
                "Upload-Offset": String(file.size),
            }),
            ok: true,
            status: 200,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useTusUpload({
                    endpoint: "https://api.example.com/upload",
                    onError,
                    onProgress,
                    onStart,
                    onSuccess,
                }),
            { queryClient },
        );

        await result.current.upload(file);

        await waitFor(() => {
            expect(onStart).toHaveBeenCalledWith();
            expect(onProgress).toHaveBeenCalledWith(expect.any(Number));
            expect(onSuccess).toHaveBeenCalledWith(expect.any(Object));
            expect(onError).not.toHaveBeenCalled();
        });
    });

    it("should handle abort", async () => {
        expect.assertions(1);

        const file = new File(["test content"], "test.txt", { type: "text/plain" });

        // Mock requests: POST (create), then PATCH (upload chunk that can be aborted)
        mockFetch.mockImplementation((_url: string, options?: RequestInit) => {
            if (options?.method === "POST") {
                // First call: create upload
                return Promise.resolve({
                    headers: new Headers({
                        Location: "https://api.example.com/upload/file-123",
                        "Upload-Offset": "0",
                    }),
                    ok: true,
                    status: 201,
                });
            }

            if (options?.method === "PATCH") {
                // Second call: upload chunk - check abort signal periodically
                return new Promise((_resolve, reject) => {
                    const signal = options?.signal as AbortSignal | undefined;

                    if (signal) {
                        // Check if already aborted
                        if (signal.aborted) {
                            reject(new DOMException("The operation was aborted.", "AbortError"));

                            return;
                        }

                        // Listen for abort
                        signal.addEventListener("abort", () => {
                            reject(new DOMException("The operation was aborted.", "AbortError"));
                        });
                    }

                    // Otherwise, promise never resolves (simulating slow upload)
                });
            }

            return Promise.reject(new Error(`Unexpected request: ${options?.method}`));
        });

        const { result, unmount } = renderHookWithQueryClient(
            () =>
                useTusUpload({
                    endpoint: "https://api.example.com/upload",
                }),
            { queryClient },
        );

        const uploadPromise = result.current.upload(file);

        // Give upload time to start (POST completes, onStart fires, PATCH begins)
        await new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, 50);
        });

        result.current.abort();

        await expect(uploadPromise).rejects.toThrow("Upload aborted");

        // Cleanup
        unmount();
    });

    it("should reset state", async () => {
        const { result } = renderHookWithQueryClient(
            () =>
                useTusUpload({
                    endpoint: "https://api.example.com/upload",
                }),
            { queryClient },
        );

        result.current.pause();
        result.current.reset();

        expect(result.current.isPaused).toBe(false);
        expect(result.current.progress).toBe(0);
        expect(result.current.error).toBeUndefined();
    });
});
