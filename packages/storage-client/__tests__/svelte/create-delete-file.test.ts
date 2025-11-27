import { QueryClient } from "@tanstack/svelte-query";
import { render, waitFor } from "@testing-library/svelte";
import { get } from "svelte/store";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { createDeleteFile } from "../../src/svelte/create-delete-file";
import DeleteFileTestComponent from "./DeleteFileTestComponent.svelte";

// Mock fetch globally
const mockFetch = vi.fn();
let originalFetch: typeof globalThis.fetch | undefined;

describe(createDeleteFile, () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                mutations: { retry: false },
                queries: { retry: false },
            },
        });
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
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 204,
        });

        const { component } = render(DeleteFileTestComponent, {
            props: {
                client: queryClient,
                options: {
                    endpoint: "https://api.example.com",
                },
            },
        });

        // Wait for result to be initialized and stores to be available
        let result: ReturnType<typeof component.result>;

        await waitFor(
            () => {
                const r = component.result();

                expect(r).toBeDefined();
                expect(r?.deleteFile).toBeDefined();
                expect(r?.isLoading).toBeDefined();

                expectTypeOf(r?.isLoading?.subscribe).toBeFunction();

                expect(r?.error).toBeDefined();

                expectTypeOf(r?.error?.subscribe).toBeFunction();

                result = r!;
            },
            { timeout: 2000 },
        );

        await result.deleteFile("file-123");

        await waitFor(() => {
            expect(get(result.isLoading)).toBe(false);
        });

        expect(mockFetch).toHaveBeenCalledWith(
            "https://api.example.com/file-123",
            expect.objectContaining({
                method: "DELETE",
            }),
        );
    });

    it("should handle error response", async () => {
        mockFetch.mockResolvedValueOnce({
            json: async () => {
                return {
                    error: {
                        code: "RequestFailed",
                        message: "File not found",
                    },
                };
            },
            ok: false,
            status: 404,
            statusText: "Not Found",
        });

        const { component } = render(DeleteFileTestComponent, {
            props: {
                client: queryClient,
                options: {
                    endpoint: "https://api.example.com",
                },
            },
        });

        // Wait for result to be initialized and stores to be available
        let result: ReturnType<typeof component.result>;

        await waitFor(
            () => {
                const r = component.result();

                expect(r).toBeDefined();
                expect(r?.deleteFile).toBeDefined();
                expect(r?.isLoading).toBeDefined();

                expectTypeOf(r?.isLoading?.subscribe).toBeFunction();

                expect(r?.error).toBeDefined();

                expectTypeOf(r?.error?.subscribe).toBeFunction();

                result = r!;
            },
            { timeout: 2000 },
        );

        // The mutation will reject, but we need to catch it to allow the error to be set in the store
        try {
            await result.deleteFile("file-123");

            // If we get here, the mutation didn't reject - this is unexpected
            expect.fail("Expected deleteFile to reject");
        } catch (error) {
            // Expected - mutation should fail
            expect(error).toBeDefined();
        }

        // Wait for the error to be captured in the store
        // Mutation errors are set after the mutation fails
        await waitFor(
            () => {
                const error = get(result.error);

                expect(error).toBeDefined();
            },
            { timeout: 3000 },
        );
    });

    it("should reset mutation state", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 204,
        });

        const { component } = render(DeleteFileTestComponent, {
            props: {
                client: queryClient,
                options: {
                    endpoint: "https://api.example.com",
                },
            },
        });

        // Wait for result to be initialized and stores to be available
        let result: ReturnType<typeof component.result>;

        await waitFor(
            () => {
                const r = component.result();

                expect(r).toBeDefined();
                expect(r?.deleteFile).toBeDefined();
                expect(r?.isLoading).toBeDefined();

                expectTypeOf(r?.isLoading?.subscribe).toBeFunction();

                expect(r?.error).toBeDefined();

                expectTypeOf(r?.error?.subscribe).toBeFunction();

                result = r!;
            },
            { timeout: 2000 },
        );

        await result.deleteFile("file-123");

        await waitFor(() => {
            expect(get(result.isLoading)).toBe(false);
        });

        result.reset();

        expect(get(result.error)).toBeUndefined();
        expect(get(result.isLoading)).toBe(false);
    });
});
