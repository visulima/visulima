import { QueryClient } from "@tanstack/svelte-query";
import { get } from "svelte/store";

/**
 * Creates a new QueryClient for each test to ensure isolation.
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
 * Helper to wait for store value to change.
 */
export const waitForStore = async <T>(
    store: { subscribe: (function_: (value: T) => void) => () => void },
    predicate: (value: T) => boolean,
    timeout = 1000,
): Promise<T> =>
    new Promise((resolve, reject) => {
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        const unsubscribe = store.subscribe((value) => {
            if (predicate(value)) {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }

                unsubscribe();
                resolve(value);
            }
        });

        timeoutId = setTimeout(() => {
            unsubscribe();
            reject(new Error(`Timeout waiting for store predicate after ${timeout}ms`));
        }, timeout);
    });

/**
 * Helper to get current store value synchronously
 */
export const getStoreValue = <T>(store: { subscribe: (function_: (value: T) => void) => () => void }): T => get(store as Parameters<typeof get>[0]);
