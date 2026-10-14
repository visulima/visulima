import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { beforeAll, describe, expect, it } from "vitest";

// Runs the BUILT entry (`dist/index.js`, run `pnpm run build` first) inside real `workerd`,
// bundled into a single module the way `wrangler` does. There `import.meta.url` is
// `undefined`, which is what used to make the import throw.
//
// Deliberately not under `__tests__/workerd/` with the repo's vitest workers pool: that pool gives
// modules a `file://` `import.meta.url`, so it cannot reproduce this defect.

const here = dirname(fileURLToPath(import.meta.url));
const distEntry = join(here, "..", "..", "dist", "index.js");

interface WorkerResult {
    assertThrew: boolean;
    importMetaUrlType: string;
    listLoaded: boolean;
    matched: boolean;
    warnings: number;
}

const workerSource = `
import { assertListLoaded, isDisposableDomain, isListLoaded, setDomains } from ${JSON.stringify(distEntry)};

export default {
    fetch(request) {
        let warnings = 0;
        console.warn = () => { warnings += 1; };

        if (new URL(request.url).searchParams.has("inject")) {
            setDomains(["mailinator.com"]);
        }

        const first = isDisposableDomain("sub.mailinator.com");
        const second = isDisposableDomain("sub.mailinator.com");

        let assertThrew = false;

        try {
            assertListLoaded();
        } catch {
            assertThrew = true;
        }

        return Response.json({ assertThrew, importMetaUrlType: typeof import.meta.url, listLoaded: isListLoaded(), matched: first && second, warnings });
    },
};
`;

const compatibilityCases = [{ flags: ["nodejs_compat"] }, { flags: [] }];

let script: string;

/** Starts a fresh worker (so module state is pristine), requests it once and tears it down. */
const request = async (query: string, compatibilityFlags: string[]): Promise<WorkerResult> => {
    const miniflare = new Miniflare(convertV4MiniflareOptions({ compatibilityDate: "2026-07-01", compatibilityFlags, modules: true, script }));

    try {
        const response = await miniflare.dispatchFetch(`http://localhost/${query}`);

        return (await response.json()) as WorkerResult;
    } finally {
        await miniflare.dispose();
    }
};

describe("built entry inside workerd", () => {
    beforeAll(async () => {
        const result = await build({
            bundle: true,
            external: ["node:*"],
            format: "esm",
            platform: "neutral",
            stdin: { contents: workerSource, resolveDir: here },
            target: "es2022",
            write: false,
        });

        script = result.outputFiles.map((file) => file.text).join("");
    });

    it.each(compatibilityCases)("imports and matches after setDomains() (compatibilityFlags: $flags)", async ({ flags }) => {
        expect.assertions(5);

        const result = await request("?inject", flags);

        // Guards the premise: if workerd starts providing a URL, this test stops covering the defect.
        expect(result.importMetaUrlType).toBe("undefined");
        expect(result.matched).toBe(true);
        expect(result.listLoaded).toBe(true);
        expect(result.assertThrew).toBe(false);
        expect(result.warnings).toBe(0);
    });

    it.each(compatibilityCases)("falls back to the empty list with one warning when no list is injected (compatibilityFlags: $flags)", async ({ flags }) => {
        expect.assertions(4);

        const result = await request("", flags);

        expect(result.matched).toBe(false);
        expect(result.listLoaded).toBe(false);
        expect(result.assertThrew).toBe(true);
        expect(result.warnings).toBe(1);
    });
});
