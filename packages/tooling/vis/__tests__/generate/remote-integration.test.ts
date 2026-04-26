/**
 * End-to-end remote fetch via giget.
 *
 * Gated behind `VITEST_INTEGRATION=1` because it hits the network
 * (GitHub). Normal `pnpm test` skips it. Run it locally with:
 *
 *     VITEST_INTEGRATION=1 pnpm --filter @visulima/vis test __tests__/generate/remote-integration.test.ts
 *
 * Source points at the `moon-component` fixture we already ship inside
 * this very package — it's a self-hosted, deterministic template that
 * exercises every moon-format feature (filename interpolation,
 * frontmatter `if:`, partials, `.raw`, binary asset). Using our own
 * repo avoids depending on an external fixture that could vanish.
 */

import { describe, expect, it } from "vitest";

import { discoverTemplates } from "../../src/generate/discover";
import { fetchRemoteTemplate, isRemoteSource } from "../../src/generate/remote";
import type { CreationDirectory, CreationFile } from "../../src/generate/types";

const INTEGRATION = process.env.VITEST_INTEGRATION === "1";
const REMOTE_SOURCE = "github:visulima/visulima/packages/tooling/vis/__tests__/__fixtures__/generate/moon-component#alpha";

const flatten = (tree: CreationDirectory, prefix = ""): Record<string, CreationFile> => {
    const out: Record<string, CreationFile> = {};

    for (const [key, value] of Object.entries(tree)) {
        const path = prefix ? `${prefix}/${key}` : key;

        if (typeof value === "string" || Buffer.isBuffer(value)) {
            out[path] = value;
        } else if (value && typeof value === "object") {
            Object.assign(out, flatten(value, path));
        }
    }

    return out;
};

describe.skipIf(!INTEGRATION)("remote template fetch (network, gated by VITEST_INTEGRATION=1)", () => {
    it("recognises the remote source", () => {
        expect.assertions(1);

        expect(isRemoteSource(REMOTE_SOURCE)).toBe(true);
    });

    it("fetches, discovers, loads, and renders a moon-format template from GitHub", { timeout: 60_000 }, async () => {
        expect.assertions(4);

        const fetched = await fetchRemoteTemplate(REMOTE_SOURCE, { preferOffline: false });

        try {
            const discovered = discoverTemplates({ extraDirectories: [fetched.directory], workspaceRoot: fetched.directory });
            const remote = discovered.find((t) => t.path.startsWith(fetched.directory));

            expect(remote).toBeDefined();
            expect(remote?.source).toBe("config");

            const template = await remote!.load();
            const creation = await template.produce({
                builtins: {
                    dest_dir: "/tmp",
                    dest_rel_dir: ".",
                    working_dir: "/tmp",
                    workspace_root: "/tmp",
                },
                options: { name: "Button", style: "primary", withTest: false },
            });

            const files = flatten(creation.files ?? {});

            expect(files["Button.tsx"]).toContain("export const Button");
            // The `.raw` fixture file proves passthrough survives the
            // network round-trip.
            expect(files["README.md"]).toContain("{{ raw }}");
        } finally {
            fetched.cleanup();
        }
    });

    it("cleanup removes the fetched tmp directory", { timeout: 60_000 }, async () => {
        expect.assertions(2);

        const { existsSync } = await import("node:fs");
        const fetched = await fetchRemoteTemplate(REMOTE_SOURCE);

        expect(existsSync(fetched.directory)).toBe(true);

        fetched.cleanup();

        expect(existsSync(fetched.directory)).toBe(false);
    });
});

describe.skipIf(INTEGRATION)("remote template fetch — skipped when VITEST_INTEGRATION is unset", () => {
    it("is a placeholder to keep the file non-empty in default runs", () => {
        expect.assertions(1);

        expect(INTEGRATION).toBe(false);
    });
});
