import { QueryClient } from "@tanstack/solid-query";
import { createRoot } from "solid-js";

/**
 * Creates a new QueryClient for each test to ensure isolation
 */
export const createTestQueryClient = (): QueryClient => {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                refetchOnWindowFocus: false,
                refetchOnReconnect: false,
            },
            mutations: {
                retry: false,
            },
        },
    });
};

/**
 * Helper to run a test with a QueryClient
 * Solid.js requires running inside a root context
 */
export const runInQueryClientRoot = <T>(callback: (queryClient: QueryClient) => T): T => {
    const queryClient = createTestQueryClient();
    let result: T;

    createRoot(() => {
        result = callback(queryClient);
    });

    return result!;
};

