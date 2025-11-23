import { QueryClient } from "@tanstack/svelte-query";
import { render, waitFor } from "@testing-library/svelte";
import { writable } from "svelte/store";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
        // expect.assertions(4);

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
        // Since result is an object with getters, we access properties directly
        // We need to poll for changes since we are outside Svelte's reactivity system
        await waitFor(() => {
            expect(component.result.isLoading).toBe(false);
        });

        expect(component.result.data).toBeDefined();
        expect(component.result.data?.size).toBe(mockBlob.size);
        expect(component.result.error).toBeUndefined();
    });

    it("should handle reactive id changes", async () => {
        // expect.assertions(2);

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

        await waitFor(() => {
            expect(component.result.isLoading).toBe(false);
        });

        expect(component.result.data?.size).toBe(mockBlob1.size);

        id.set("file-456");

        await waitFor(() => {
            expect(component.result.data?.size).toBe(mockBlob2.size);
        });
    });

    it("should respect enabled option", async () => {
        // expect.assertions(1);

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

        await new Promise((resolve) => setTimeout(resolve, 50));

        // Query should not run when disabled
        expect(mockFetch).not.toHaveBeenCalled();
    });
});
