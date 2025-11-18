import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { createRoot, type JSX } from "solid-js";

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
 * Helper to run a test in a reactive root
 */
export const runInRoot = <T>(callback: () => T): T => {
    let result: T;
    createRoot((dispose) => {
        result = callback();
        // We do NOT dispose immediately to allow async updates
        // This might leak memory in long running processes but is fine for short-lived tests
    });
    return result!;
};
