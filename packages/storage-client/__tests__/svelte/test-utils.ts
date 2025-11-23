import { QueryClient } from "@tanstack/svelte-query";
import { get } from "svelte/store";

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
 * Helper to wait for store value to change
 */
export const waitForStore = async <T>(
    store: { subscribe: (function_: (value: T) => void) => () => void },
    predicate: (value: T) => boolean,
    timeout = 1000,
): Promise<T> =>
    new Promise((resolve, reject) => {
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

/**
 * Helper to get current store value synchronously
 */
export const getStoreValue = <T>(store: { subscribe: (function_: (value: T) => void) => () => void }): T => get(store as any);
