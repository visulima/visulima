<script lang="ts">
    // Generic host that runs an arbitrary factory at component-init time so
    // `createQuery` / `createMutation` register against the Svelte lifecycle.
    // The factory is invoked synchronously in the script body, exactly once,
    // and the result is exposed back to the test via the bound `result` prop.

    type Result = Record<string, unknown> | undefined;

    export let factory: () => Result;
    export let result: Result = undefined;

    result = factory();
</script>
