<script lang="ts">
    import { createDeleteFile } from "../../src/svelte/create-delete-file";
    import type { CreateDeleteFileOptions, CreateDeleteFileReturn } from "../../src/svelte/create-delete-file";

    export let result: CreateDeleteFileReturn | undefined = undefined;
    export let options: CreateDeleteFileOptions;
    
    // Initialize result when component is created (after context is available)
    // This component is inside QueryClientProvider, so useQueryClient() will work
    $: if (options) {
        result = createDeleteFile(options);
    }
</script>

