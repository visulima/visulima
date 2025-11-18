import { QueryClient } from "@tanstack/svelte-query";
import { get } from "svelte/store";

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
 * Helper to wait for store value to change
 */
export const waitForStore = async <T>(
    store: { subscribe: (fn: (value: T) => void) => () => void },
    predicate: (value: T) => boolean,
    timeout = 1000
): Promise<T> => {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const unsubscribe = store.subscribe((value) => {
            if (predicate(value)) {
                unsubscribe();
                resolve(value);
            } else if (Date.now() - startTime > timeout) {
                unsubscribe();
                reject(new Error(`Timeout waiting for store predicate after ${timeout}ms`));
            }
        });
    });
};

/**
 * Helper to get current store value synchronously
 */
export const getStoreValue = <T>(store: { subscribe: (fn: (value: T) => void) => () => void }): T => {
    return get(store as any);
};


