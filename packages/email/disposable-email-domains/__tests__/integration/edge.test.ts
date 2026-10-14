import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Resolves `@visulima/disposable-email-domains/edge` the way a consumer's bundler does (through the
// package `exports` map and its `sideEffects` field, via a symlink standing in for node_modules),
// bundles it into one module and runs it in real `workerd` WITHOUT calling `setDomains()`.
// The BUILT package is needed (`pnpm run build` generates `dist/edge.js`).

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..");

interface WorkerResult {
    assertThrew: boolean;
    importMetaUrlType: string;
    listLoaded: boolean;
    matched: boolean;
    otherMatched: boolean;
    warnings: number;
}

const consumerSource = `
import { assertListLoaded, isDisposableDomain, isDisposableEmail, isListLoaded } from "@visulima/disposable-email-domains/edge";

export default {
    fetch() {
        let warnings = 0;
        console.warn = () => { warnings += 1; };

        let assertThrew = false;

        try {
            assertListLoaded();
        } catch {
            assertThrew = true;
        }

        return Response.json({
            assertThrew,
            importMetaUrlType: typeof import.meta.url,
            listLoaded: isListLoaded(),
            matched: isDisposableDomain("sub.mailinator.com"),
            otherMatched: isDisposableEmail("a@example.com"),
            warnings,
        });
    },
};
`;

const compatibilityCases = [{ flags: ["nodejs_compat"] }, { flags: [] }];

describe("./edge entry inside workerd", () => {
    let workDirectory: string;
    let script: string;

    beforeAll(async () => {
        workDirectory = mkdtempSync(join(tmpdir(), "disposable-email-domains-edge-"));

        mkdirSync(join(workDirectory, "node_modules", "@visulima"), { recursive: true });
        // A junction needs no elevated rights on Windows.
        symlinkSync(packageRoot, join(workDirectory, "node_modules", "@visulima", "disposable-email-domains"), "junction");
        writeFileSync(join(workDirectory, "consumer.mjs"), consumerSource);

        const result = await build({
            absWorkingDir: workDirectory,
            bundle: true,
            entryPoints: ["consumer.mjs"],
            external: ["node:*"],
            format: "esm",
            platform: "neutral",
            target: "es2022",
            write: false,
        });

        script = result.outputFiles.map((file) => file.text).join("");
    });

    afterAll(() => {
        rmSync(workDirectory, { force: true, recursive: true });
    });

    it.each(compatibilityCases)("matches with no setDomains() call (compatibilityFlags: $flags)", async ({ flags }) => {
        expect.assertions(6);

        const miniflare = new Miniflare(convertV4MiniflareOptions({ compatibilityDate: "2026-07-01", compatibilityFlags: flags, modules: true, script }));

        try {
            const response = await miniflare.dispatchFetch("http://localhost/");
            const result = (await response.json()) as WorkerResult;

            // Guards the premise: if workerd starts providing a URL, this stops covering the defect.
            expect(result.importMetaUrlType).toBe("undefined");
            expect(result.matched).toBe(true);
            expect(result.otherMatched).toBe(false);
            expect(result.listLoaded).toBe(true);
            expect(result.assertThrew).toBe(false);
            expect(result.warnings).toBe(0);
        } finally {
            await miniflare.dispose();
        }
    });
});
