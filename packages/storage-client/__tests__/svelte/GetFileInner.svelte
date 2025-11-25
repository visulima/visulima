<script lang="ts">
    import { onMount } from "svelte";
    import { createGetFile } from "../../src/svelte/create-get-file";
    import type { CreateGetFileOptions, CreateGetFileReturn } from "../../src/svelte/create-get-file";

    export let result: CreateGetFileReturn | undefined = undefined;
    export let options: CreateGetFileOptions;
    
    // Initialize result once when component mounts
    // Don't pass queryClient, let it use context from QueryClientProvider
    // The stores passed to createGetFile (like id as a writable store) will handle reactivity internally
    onMount(() => {
        if (options) {
            result = createGetFile(options);
        }
    });
</script>

