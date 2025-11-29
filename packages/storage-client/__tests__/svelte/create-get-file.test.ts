import { QueryClient } from "@tanstack/svelte-query";
import { render, waitFor } from "@testing-library/svelte";
import { get, writable } from "svelte/store";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { createGetFile } from "../../src/svelte/create-get-file";
import TestComponent from "./TestComponent.svelte";

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
        expect.assertions(8);

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

        // Wrap in QueryClientProvider component for Svelte context
        // Svelte Query needs component context for getContext()
        const { component } = render(TestComponent, {
            props: {
                client: queryClient,
                options: {
                    endpoint: "https://api.example.com",
                    id: "file-123",
                },
            },
        });

        // Access result from component instance
        // Wait for result to be initialized and stores to be available
        let result: ReturnType<typeof component.getResult>;

        await waitFor(
            () => {
                const r = component.getResult();

                expect(r).toBeDefined();
                expect(r?.isLoading).toBeDefined();

                expectTypeOf(r?.isLoading?.subscribe).toBeFunction();

                expect(r?.data).toBeDefined();

                expectTypeOf(r?.data?.subscribe).toBeFunction();

                result = r!;
            },
            { timeout: 2000 },
        );

        // Wait for query to complete and data to be available
        await waitFor(
            () => {
                expect(get(result.isLoading)).toBe(false);
                expect(get(result.data)).toBeDefined();
            },
            { timeout: 2000 },
        );

        expect(get(result.data)?.size).toBe(mockBlob.size);
        expect(get(result.error)).toBeUndefined();
    });

    it("should handle reactive id changes", async () => {
        expect.assertions(9);

        const id = writable("file-123");
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

        const { component } = render(TestComponent, {
            props: {
                client: queryClient,
                options: {
                    endpoint: "https://api.example.com",
                    id,
                },
            },
        });

        // Wait for result to be initialized and stores to be available
        let result: ReturnType<typeof component.getResult>;

        await waitFor(
            () => {
                const r = component.getResult();

                expect(r).toBeDefined();
                expect(r?.isLoading).toBeDefined();

                expectTypeOf(r?.isLoading?.subscribe).toBeFunction();

                expect(r?.data).toBeDefined();

                expectTypeOf(r?.data?.subscribe).toBeFunction();

                result = r!;
            },
            { timeout: 2000 },
        );

        await waitFor(
            () => {
                expect(get(result.isLoading)).toBe(false);
                expect(get(result.data)).toBeDefined();
            },
            { timeout: 2000 },
        );

        expect(get(result.data)?.size).toBe(mockBlob1.size);

        id.set("file-456");

        // Wait for the query to refetch with the new id
        await waitFor(
            () => {
                expect(get(result.isLoading)).toBe(false);
                expect(get(result.data)?.size).toBe(mockBlob2.size);
            },
            { timeout: 2000 },
        );
    });

    it("should respect enabled option", async () => {
        expect.assertions(1);

        const enabled = writable(false);

        render(TestComponent, {
            props: {
                client: queryClient,
                options: {
                    enabled,
                    endpoint: "https://api.example.com",
                    id: "file-123",
                },
            },
        });

        await new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, 50);
        });

        // Query should not run when disabled
        expect(mockFetch).not.toHaveBeenCalled();
    });
});
