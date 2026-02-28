import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";

// Stub plugin for .svelte files at root scan level.
// When vitest related runs its global import analysis, it encounters .svelte
// components imported by storage-client tests. Without a Svelte plugin, Vite
// fails to parse the template syntax. This stub returns an empty module so the
// analysis can complete. Workspace projects with Svelte tests override this
// via their own vitest config (which includes the full @sveltejs/vite-plugin-svelte).
const svelteStub: Plugin = {
    name: "vitest-root-svelte-stub",
    transform(_code: string, id: string) {
        if (id.endsWith(".svelte")) {
            return { code: "export default {};", map: null };
        }

        return undefined;
    },
};

export default defineConfig({
    plugins: [svelteStub],
});
