<script lang="ts">
    import { QueryClientProvider } from "@tanstack/svelte-query";
    import type { QueryClient } from "@tanstack/svelte-query";

    export let client: QueryClient;
</script>

<QueryClientProvider {client}>
    <slot />
</QueryClientProvider>

