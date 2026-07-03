import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";

// Force colorize on at the root level so snapshots that capture ANSI codes
// stay stable when vitest is launched from the monorepo root (e.g. via
// lint-staged `vitest related --run <absolute paths>`) which bypasses the
// per-package vitest configs.
process.env.FORCE_COLOR = "1";
delete process.env.NO_COLOR;

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

// Stub plugin for Vite virtual modules used by dev-toolbar client code.
// When vitest related runs its global import analysis, it encounters
// virtual:visulima-* imports from dev-toolbar/src/client/overlay.ts.
// Without a resolver, Vite's import-analysis plugin rejects these IDs.
// The workspace project (dev-toolbar/vitest.config.ts) uses vi.mock() to
// replace the stubs; this root-level plugin only needs to make resolution succeed.
const virtualModuleStubs: Plugin = {
    load(id: string) {
        if (id.startsWith("virtual:visulima-")) {
            return "export default {};";
        }

        return undefined;
    },
    name: "vitest-root-virtual-module-stubs",
    resolveId(id: string) {
        if (id.startsWith("virtual:visulima-")) {
            return id;
        }

        return undefined;
    },
};

export default defineConfig({
    plugins: [svelteStub, virtualModuleStubs],
});
