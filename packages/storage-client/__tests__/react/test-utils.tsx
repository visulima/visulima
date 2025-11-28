import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { RenderHookOptions } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import React from "react";

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
export const createWrapper = (queryClient?: QueryClient): (props: { children: ReactNode }) => JSX.Element => {
    const client = queryClient || createTestQueryClient();

    return (props: { children: ReactNode }) => <QueryClientProvider client={client}>{props.children}</QueryClientProvider>;
};

/**
 * Helper to render hooks with QueryClientProvider.
 */
export const renderHookWithQueryClient = <TProps, TResult>(
    hook: (props: TProps) => TResult,
    options?: Omit<RenderHookOptions<TProps>, "wrapper"> & { queryClient?: QueryClient },
) => {
    const { queryClient, ...renderOptions } = options || {};

    return renderHook(hook, {
        ...renderOptions,
        wrapper: createWrapper(queryClient),
    });
};

// Re-export MockXMLHttpRequest from shared location
export { MockXMLHttpRequest } from "../mock-xhr";
