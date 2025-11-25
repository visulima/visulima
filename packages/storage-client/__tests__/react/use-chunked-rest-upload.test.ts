import { QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { useChunkedRestUpload } from "../../src/react/use-chunked-rest-upload";
import { renderHookWithQueryClient } from "./test-utils";

// Mock fetch globally
const mockFetch = vi.fn();
// Capture original fetch once before the suite
const originalFetch = globalThis.fetch;

describe(useChunkedRestUpload, () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                mutations: { retry: false },
                queries: { retry: false },
            },
        });
        globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;
        mockFetch.mockReset();
    });

    afterAll(() => {
        if (originalFetch) {
            globalThis.fetch = originalFetch;
        } else {
            delete (globalThis as any).fetch;
        }
    });

    it("should initialize with default state", () => {
        const { result } = renderHookWithQueryClient(
            () =>
                useChunkedRestUpload({
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
        const fileId = "file-123";

        // Mock create upload (POST)
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Upload-ID": fileId,
            }),
            ok: true,
        });

        // Mock get upload status (HEAD)
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Upload-Offset": "0",
            }),
            ok: true,
        });

        // Mock chunk upload (PATCH)
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Upload-Offset": String(file.size),
            }),
            ok: true,
        });

        // Mock final status check (HEAD)
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Upload-Offset": String(file.size),
            }),
            ok: true,
        });

        // Mock get upload result (GET)
        mockFetch.mockResolvedValueOnce({
            json: async () => {
                return {
                    contentType: "text/plain",
                    id: fileId,
                    name: "test.txt",
                    originalName: "test.txt",
                    size: file.size,
                    status: "completed",
                };
            },
            ok: true,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useChunkedRestUpload({
                    endpoint: "https://api.example.com/upload",
                }),
            { queryClient },
        );

        const uploadResult = await result.current.upload(file);

        expect(uploadResult.id).toBe(fileId);
        expect(uploadResult.status).toBe("completed");
    });

    it("should handle pause and resume", async () => {
        const file = new File(["test content"], "test.txt", { type: "text/plain" });

        // Mock create upload
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Upload-ID": "file-123",
            }),
            ok: true,
        });

        // Use a counter to track different request types
        let headCallCount = 0;
        let patchCallCount = 0;
        let getCallCount = 0;

        mockFetch.mockImplementation((_url: string, options?: RequestInit) => {
            if (options?.method === "HEAD") {
                headCallCount++;

                if (headCallCount === 1) {
                    // Initial status check
                    return Promise.resolve({
                        headers: new Headers({
                            "X-Upload-Offset": "0",
                        }),
                        ok: true,
                    });
                }

                // Status check when resuming or final check
                return Promise.resolve({
                    headers: new Headers({
                        "X-Upload-Offset": String(file.size),
                    }),
                    ok: true,
                });
            }

            if (options?.method === "PATCH") {
                patchCallCount++;

                // Delay first PATCH so we can pause
                if (patchCallCount === 1) {
                    return new Promise((resolve) => {
                        setTimeout(() => {
                            resolve({
                                headers: new Headers({
                                    "X-Upload-Offset": String(file.size),
                                }),
                                ok: true,
                            });
                        }, 200);
                    });
                }

                // Subsequent PATCH calls (when resuming)
                return Promise.resolve({
                    headers: new Headers({
                        "X-Upload-Offset": String(file.size),
                    }),
                    ok: true,
                });
            }

            if (options?.method === "GET") {
                getCallCount++;

                return Promise.resolve({
                    json: async () => {
                        return {
                            id: "file-123",
                            size: file.size,
                            status: "completed",
                        };
                    },
                    ok: true,
                });
            }

            return Promise.reject(new Error(`Unexpected method: ${options?.method}`));
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useChunkedRestUpload({
                    endpoint: "https://api.example.com/upload",
                }),
            { queryClient },
        );

        const uploadPromise = result.current.upload(file);

        // Wait for upload to start
        await waitFor(
            () => {
                expect(result.current.isUploading).toBe(true);
            },
            { timeout: 2000 },
        );

        // Pause the upload
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

        // Mock successful upload
        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Upload-ID": "file-123",
            }),
            ok: true,
        });

        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Upload-Offset": "0",
            }),
            ok: true,
        });

        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Upload-Offset": String(file.size),
            }),
            ok: true,
        });

        mockFetch.mockResolvedValueOnce({
            headers: new Headers({
                "X-Upload-Offset": String(file.size),
            }),
            ok: true,
        });

        mockFetch.mockResolvedValueOnce({
            json: async () => {
                return {
                    id: "file-123",
                    size: file.size,
                    status: "completed",
                };
            },
            ok: true,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useChunkedRestUpload({
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
            expect(onProgress).toHaveBeenCalledWith(expect.any(Number), expect.any(Number));
            expect(onSuccess).toHaveBeenCalledWith(expect.any(Object));
            expect(onError).not.toHaveBeenCalled();
        });
    });

    it("should handle abort", async () => {
        const file = new File(["test content"], "test.txt", { type: "text/plain" });

        // Use mockImplementation to handle all requests, especially PATCH with abort signal
        let headCallCount = 0;
        let getCallCount = 0;

        mockFetch.mockImplementation((_url: string, options?: RequestInit) => {
            if (options?.method === "HEAD") {
                headCallCount++;

                return Promise.resolve({
                    headers: new Headers({
                        "X-Upload-Offset": headCallCount === 1 ? "0" : String(file.size),
                    }),
                    ok: true,
                });
            }

            if (options?.method === "PATCH") {
                return new Promise((resolve, reject) => {
                    const timeoutId = setTimeout(() => {
                        // If aborted, reject; otherwise resolve
                        if (options?.signal?.aborted) {
                            reject(new Error("Upload aborted"));
                        } else {
                            resolve({
                                headers: new Headers({
                                    "X-Upload-Offset": String(file.size),
                                }),
                                ok: true,
                            });
                        }
                    }, 200);

                    // Listen for abort signal
                    if (options?.signal) {
                        options.signal.addEventListener("abort", () => {
                            clearTimeout(timeoutId);
                            reject(new Error("Upload aborted"));
                        });
                    }
                });
            }

            if (options?.method === "GET") {
                getCallCount++;

                return Promise.resolve({
                    json: async () => {
                        return {
                            id: "file-123",
                            size: file.size,
                            status: "completed",
                        };
                    },
                    ok: true,
                });
            }

            // For POST (create upload)
            return Promise.resolve({
                headers: new Headers({
                    "X-Upload-ID": "file-123",
                }),
                ok: true,
            });
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useChunkedRestUpload({
                    endpoint: "https://api.example.com/upload",
                }),
            { queryClient },
        );

        const uploadPromise = result.current.upload(file);

        // Wait for upload to start, then abort
        await waitFor(
            () => {
                expect(result.current.isUploading).toBe(true);
            },
            { timeout: 2000 },
        );

        result.current.abort();

        await expect(uploadPromise).rejects.toThrow();
    }, 10_000);

    it("should reset state", async () => {
        const { result } = renderHookWithQueryClient(
            () =>
                useChunkedRestUpload({
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
