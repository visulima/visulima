import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { RenderHookOptions, RenderHookResult } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import React from "react";

/**
 * Creates a new QueryClient for each test to ensure isolation.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const createTestQueryClient = (): QueryClient =>
    new QueryClient({
        defaultOptions: {
            mutations: {
                retry: false,
            },
            queries: {
                // Turn off refetch on reconnect for tests
                refetchOnReconnect: false,
                // Turn off refetch on window focus for tests
                refetchOnWindowFocus: false,
                // Turn off retries for faster tests
                retry: false,
            },
        },
    });

/**
 * Wrapper component for React Query Provider.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const createWrapper = (queryClient?: QueryClient): (props: { children: ReactNode }) => React.JSX.Element => {
    const client = queryClient || createTestQueryClient();

    // eslint-disable-next-line solid/no-destructure
    return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

/**
 * Helper to render hooks with QueryClientProvider.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const renderHookWithQueryClient = <TProps, TResult>(
    hook: (props: TProps) => TResult,
    options?: Omit<RenderHookOptions<TProps>, "wrapper"> & { queryClient?: QueryClient },
): RenderHookResult<TResult, TProps> => {
    const { queryClient, ...renderOptions } = options || {};

    return renderHook<TResult, TProps>(hook, {
        ...renderOptions,
        wrapper: createWrapper(queryClient),
    }) as RenderHookResult<TResult, TProps>;
};

// Re-export MockXMLHttpRequest from shared location
export { default as MockXMLHttpRequest } from "../mock-xhr";
