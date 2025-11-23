import { QueryClient } from "@tanstack/solid-query";
import { createRoot } from "solid-js";

/**
 * Creates a new QueryClient for each test to ensure isolation
 */
export const createTestQueryClient = (): QueryClient =>
    new QueryClient({
        defaultOptions: {
            mutations: {
                retry: false,
            },
            queries: {
                refetchOnReconnect: false,
                refetchOnWindowFocus: false,
                retry: false,
            },
        },
    });

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
