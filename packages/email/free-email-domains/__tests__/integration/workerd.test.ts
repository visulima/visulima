import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { beforeAll, describe, expect, it } from "vitest";

// Runs the BUILT entry (`dist/index.js`, run `pnpm run build` first) inside real `workerd`,
// bundled into a single module the way `wrangler` does. There `import.meta.url` is
// `undefined`, which is what used to make the import throw.

const here = dirname(fileURLToPath(import.meta.url));
const distEntry = join(here, "..", "..", "dist", "index.js");

interface WorkerResult {
    disposable: boolean;
    importMetaUrl: string;
    listLoaded: boolean;
    warnings: number;
}

const workerSource = `
import { isFreeDomain, isListLoaded, setDomains } from ${JSON.stringify(distEntry)};

export default {
    fetch(request) {
        let warnings = 0;
        console.warn = () => { warnings += 1; };

        if (new URL(request.url).searchParams.has("inject")) {
            setDomains(["gmail.com"]);
        }

        const first = isFreeDomain("sub.gmail.com");
        const second = isFreeDomain("sub.gmail.com");

        return Response.json({ disposable: first && second, importMetaUrl: typeof import.meta.url, listLoaded: isListLoaded(), warnings });
    },
};
`;

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

    it.each([[["nodejs_compat"]], [[]]])("imports and matches after setDomains() (compatibilityFlags: %j)", async (flags) => {
        expect.assertions(4);

        const result = await request("?inject", flags);

        // Guards the premise: if workerd starts providing a URL, this test stops covering the defect.
        expect(result.importMetaUrl).toBe("undefined");
        expect(result.disposable).toBe(true);
        expect(result.listLoaded).toBe(true);
        expect(result.warnings).toBe(0);
    });

    it.each([[["nodejs_compat"]], [[]]])("falls back to the empty list with one warning when no list is injected (compatibilityFlags: %j)", async (flags) => {
        expect.assertions(3);

        const result = await request("", flags);

        expect(result.disposable).toBe(false);
        expect(result.listLoaded).toBe(false);
        expect(result.warnings).toBe(1);
    });
});
