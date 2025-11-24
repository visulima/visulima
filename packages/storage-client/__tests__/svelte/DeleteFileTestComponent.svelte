<script lang="ts">
    import { QueryClientProvider } from "@tanstack/svelte-query";
    import type { QueryClient } from "@tanstack/svelte-query";
    import { createDeleteFile } from "../../src/svelte/create-delete-file";
    import type { CreateDeleteFileOptions, CreateDeleteFileReturn } from "../../src/svelte/create-delete-file";
    import DeleteFileInner from "./DeleteFileInner.svelte";

    export let client: QueryClient;
    export let options: CreateDeleteFileOptions;
    
    let innerResult: CreateDeleteFileReturn | undefined = undefined;
    
    // Expose result for testing
    export const result = () => innerResult;
</script>

<QueryClientProvider {client}>
    <DeleteFileInner bind:result={innerResult} {options} />
</QueryClientProvider>
