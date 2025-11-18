import React, { type ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, type RenderHookOptions } from "@testing-library/react";

/**
 * Creates a new QueryClient for each test to ensure isolation
 */
export const createTestQueryClient = (): QueryClient => {
    return new QueryClient({
        defaultOptions: {
            queries: {
                // Turn off retries for faster tests
                retry: false,
                // Turn off refetch on window focus for tests
                refetchOnWindowFocus: false,
                // Turn off refetch on reconnect for tests
                refetchOnReconnect: false,
            },
            mutations: {
                retry: false,
            },
        },
    });
};

/**
 * Wrapper component for React Query Provider
 */
export const createWrapper = (queryClient?: QueryClient) => {
    const client = queryClient || createTestQueryClient();

    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
};

/**
 * Helper to render hooks with QueryClientProvider
 */
export const renderHookWithQueryClient = <TProps, TResult>(
    hook: (props: TProps) => TResult,
    options?: Omit<RenderHookOptions<TProps>, "wrapper"> & { queryClient?: QueryClient }
) => {
    const { queryClient, ...renderOptions } = options || {};

    return renderHook(hook, {
        ...renderOptions,
        wrapper: createWrapper(queryClient),
    });
};

