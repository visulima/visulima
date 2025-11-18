import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { createApp, type Component } from "vue";

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
 * Helper to test Vue composables with VueQueryPlugin
 * Returns the composable result directly for easier testing
 */
export const withQueryClient = <T extends Record<string, any>>(
    composable: () => T,
    queryClient?: QueryClient
): { result: T; queryClient: QueryClient; app: ReturnType<typeof createApp> } => {
    const client = queryClient || createTestQueryClient();

    let composableResult: T;

    const TestComponent: Component = {
        setup() {
            composableResult = composable();
            return composableResult;
        },
        template: "<div></div>",
    };

    const app = createApp(TestComponent);
    app.use(VueQueryPlugin, { queryClient: client });
    const container = document.createElement("div");
    app.mount(container);

    return {
        result: composableResult!,
        queryClient: client,
        app,
    };
};

