<script lang="ts">
    import { QueryClientProvider } from "@tanstack/svelte-query";
    import type { QueryClient } from "@tanstack/svelte-query";

    import FactoryHost from "./FactoryHost.svelte";

    type Result = Record<string, unknown> | undefined;

    export let client: QueryClient;
    export let factory: () => Result;

    let innerResult: Result = undefined;

    export const result = (): Result => innerResult;
</script>

<QueryClientProvider {client}>
    <FactoryHost {factory} bind:result={innerResult} />
</QueryClientProvider>
