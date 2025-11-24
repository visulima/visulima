<script lang="ts">
    import { QueryClientProvider } from "@tanstack/svelte-query";
    import type { QueryClient } from "@tanstack/svelte-query";
    import { createGetFile } from "../../src/svelte/create-get-file";
    import type { CreateGetFileOptions, CreateGetFileReturn } from "../../src/svelte/create-get-file";

    export let client: QueryClient;
    export let options: CreateGetFileOptions;
    
    // Initialize result - pass queryClient directly since createGetFile accepts it
    // Use reactive statement to ensure it updates when options change
    let result: CreateGetFileReturn | undefined = undefined;
    $: result = createGetFile({ ...options, queryClient: client });
    
    // Expose result for testing
    export const getResult = () => result;
</script>

<QueryClientProvider {client}>
    <!-- Component content -->
</QueryClientProvider>
