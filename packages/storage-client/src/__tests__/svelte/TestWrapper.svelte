<script lang="ts">
    import { QueryClientProvider } from "@tanstack/svelte-query";
    import type { ComponentProps } from "svelte";

    export let client: ComponentProps<QueryClientProvider>["client"];
</script>

<QueryClientProvider {client}>
    <slot />
</QueryClientProvider>

