import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { render } from "@testing-library/vue";

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
 * Helper to test Vue composables with VueQueryPlugin
 * Returns the composable result directly for easier testing
 */
export const withQueryClient = <T extends Record<string, any>>(
    composable: () => T,
    queryClient?: QueryClient,
): { queryClient: QueryClient; result: T; unmount: () => void } => {
    const client = queryClient || createTestQueryClient();

    let composableResult: T;

    const TestComponent = {
        setup() {
            composableResult = composable();

            return composableResult;
        },
        template: "<div></div>",
    };

    const { unmount } = render(TestComponent, {
        global: {
            plugins: [[VueQueryPlugin, { queryClient: client }]],
        },
    });

    return {
        queryClient: client,
        result: composableResult!,
        unmount,
    };
};
