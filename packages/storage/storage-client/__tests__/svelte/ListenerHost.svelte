<script lang="ts">
    // Generic host component that runs an arbitrary listener factory inside
    // the Svelte lifecycle so onMount / onDestroy fire normally.
    export let listener: () => void;

    listener();
</script>
