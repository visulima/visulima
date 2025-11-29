<script lang="ts">
    import { createMutation, useQueryClient } from "@tanstack/svelte-query";
    import { derived, readable } from "svelte/store";
    import { buildUrl, deleteRequest, storageQueryKeys } from "../../src/core";
    import type { CreateDeleteFileOptions, CreateDeleteFileReturn } from "../../src/svelte/create-delete-file";

    export let result: CreateDeleteFileReturn | undefined = undefined;
    export let options: CreateDeleteFileOptions;

    // According to TanStack Query Svelte docs, createMutation MUST be called at component top level
    // We need to call it directly in the component, not in a utility function
    // Use reactive statement to recreate when options change
    $: if (options) {
        const { endpoint } = options;
        const queryClient = useQueryClient();

        const mutation = createMutation(() => {
            return {
                mutationFn: async (id: string): Promise<void> => {
                    const url = buildUrl(endpoint, id);
                    await deleteRequest(url);
                },
                onSuccess: (_data, id) => {
                    // Invalidate file-related queries
                    queryClient.invalidateQueries({ queryKey: storageQueryKeys.files.all(endpoint) });
                    queryClient.removeQueries({ queryKey: storageQueryKeys.files.detail(endpoint, id) });
                    queryClient.removeQueries({ queryKey: storageQueryKeys.files.meta(endpoint, id) });
                    queryClient.removeQueries({ queryKey: storageQueryKeys.files.head(endpoint, id) });
                },
            };
        });

        // In TanStack Query Svelte with Svelte 5, mutation properties are reactive values
        // But the test interface expects stores. Let's create proper stores
        // Convert null to undefined for error to match expected interface
        const errorStore = readable(mutation.error || undefined, (set) => {
            set(mutation.error || undefined);
            return () => {};
        });

        const isLoadingStore = readable(mutation.isPending, (set) => {
            set(mutation.isPending);
            return () => {};
        });

        result = {
            deleteFile: mutation.mutateAsync,
            error: errorStore,
            isLoading: isLoadingStore,
            reset: mutation.reset,
        };
    }
</script>

