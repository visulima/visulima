import type { Plugin } from "vite";

import { getVitestConfig } from "../../../tools/get-vitest-config";

/**
 * Vite plugin that resolves virtual module IDs used by the dev-toolbar client
 * overlay (src/client/overlay.ts) to empty stub modules so that unit tests can
 * import that file without a running Vite dev-server.
 *
 * In tests the actual module content is always replaced by vi.mock(), so the
 * stub just needs to be syntactically valid.
 */
const virtualModuleStubs: Plugin = {
    load(id) {
        if (id.startsWith("virtual:visulima-")) {
            // Provide a minimal default export that satisfies the import
            return "export default {};";
        }

        return undefined;
    },
    name: "vitest:virtual-module-stubs",
    resolveId(id) {
        if (id.startsWith("virtual:visulima-")) {
            // Return the raw ID (no \0 prefix) so vi.mock() can match it by the
            // same string used in the import statement.
            return id;
        }

        return undefined;
    },
};

const config = getVitestConfig({
    plugins: [virtualModuleStubs],
    test: {
        environment: "jsdom",
        environmentOptions: {
            jsdom: {
                url: "http://localhost",
            },
        },
        passWithNoTests: true,
        setupFiles: ["./__tests__/setup.ts"],
    },
});

export default config;
