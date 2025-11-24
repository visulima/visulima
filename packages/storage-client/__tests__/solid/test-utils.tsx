import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { createComponent, createRoot, createSignal } from "solid-js";
import { render } from "solid-js/web";

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
                gcTime: 0,
                refetchOnMount: false,
                refetchOnReconnect: false,
                refetchOnWindowFocus: false,
                retry: false,
                // Set staleTime to 0 to ensure queries refetch when queryKey changes
                staleTime: 0,
                // Prevent queries from refetching when queryKey reference changes but values are the same
                structuralSharing: true,
            },
        },
    });

/**
 * Helper to run a test in a reactive root with QueryClientProvider context
 * For functions that use useQueryClient(), we need to provide the context via QueryClientProvider
 */
export const runInRoot = <T,>(callback: () => T, queryClient?: QueryClient): T => {
    let result: T;
    let executed = false;

    createRoot((dispose) => {
        if (queryClient) {
            // Create a container and render the provider to establish context
            // Ensure document.body exists (for test environments)
            if (!document.body) {
                document.body = document.createElement("body") as HTMLBodyElement;
            }

            const container = document.createElement("div");

            document.body.append(container);

            // Render the provider to establish context using createComponent to avoid JSX transform issues
            render(
                () => createComponent(QueryClientProvider, {
                    get children() {
                        // Execute callback only once, inside the provider context
                        if (!executed) {
                            result = callback();
                            executed = true;
                        }

                        // Return null - we don't need to render anything, just establish context
                        return null;
                    },
                    client: queryClient,
                }),
                container,
            );
        } else {
            result = callback();
        }
        // We do NOT dispose immediately to allow async updates
        // This might leak memory in long running processes but is fine for short-lived tests
    });

    return result!;
};
