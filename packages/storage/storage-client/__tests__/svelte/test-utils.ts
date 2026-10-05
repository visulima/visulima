import { QueryClient } from "@tanstack/svelte-query";
import { render } from "@testing-library/svelte";
import { get } from "svelte/store";

import FactoryTestComponent from "./FactoryTestComponent.svelte";

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

/**
 * Runs a store factory inside a component (under a fresh QueryClientProvider) and returns its result.
 */
export const mountFactory = <T>(factory: () => T): T => {
    const { component } = render(FactoryTestComponent, {
        props: {
            client: createTestQueryClient(),
            factory,
        },
    });

    return component.result();
};
