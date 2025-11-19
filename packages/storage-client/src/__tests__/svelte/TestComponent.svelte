<script lang="ts">
    import type { ComponentProps } from "svelte";
    import { createGetFile } from "../../svelte/create-get-file";
    import type { CreateGetFileOptions, CreateGetFileReturn } from "../../svelte/create-get-file";
    import type { QueryClient } from "@tanstack/svelte-query";

    export let client: QueryClient;
    export let options: CreateGetFileOptions;
    
    // Pass client to options to bypass context
    export const result: CreateGetFileReturn = createGetFile({ ...options, queryClient: client });
</script>

<!-- No need for QueryClientProvider if we pass client directly -->
