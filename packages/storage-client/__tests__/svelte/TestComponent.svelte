<script lang="ts">
    import { QueryClientProvider } from "@tanstack/svelte-query";
    import type { QueryClient } from "@tanstack/svelte-query";
    import { createGetFile } from "../../src/svelte/create-get-file";
    import type { CreateGetFileOptions, CreateGetFileReturn } from "../../src/svelte/create-get-file";
    import GetFileInner from "./GetFileInner.svelte";

    export let client: QueryClient;
    export let options: CreateGetFileOptions;
    
    let innerResult: CreateGetFileReturn | undefined = undefined;
    
    // Expose result for testing
    export const getResult = () => innerResult;
</script>

<QueryClientProvider {client}>
    <GetFileInner bind:result={innerResult} {options} />
</QueryClientProvider>
