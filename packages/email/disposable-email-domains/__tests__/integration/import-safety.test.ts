import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { transformSync } from "esbuild";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// These tests load the BUILT entry (`dist/index.js`, run `pnpm run build` first) the way a
// bundled Workers-style runtime does: `import.meta.url` is replaced with `undefined`, and
// optionally the `node:*` builtins are unavailable. Each scenario runs in a fresh `node`
// process so module-scope code is evaluated exactly once, for real.

const here = dirname(fileURLToPath(import.meta.url));
const distEntry = join(here, "..", "..", "dist", "index.js");

interface ScenarioResult {
    disposableDomain?: boolean;
    disposableEmail?: boolean;
    listLoaded?: boolean;
    warnings: number;
}

let workDirectory: string;
let urllessEntry: string;

/**
 * Imports `entry` in a child node process, runs `body` against its exports and returns the
 * JSON the body returned. A throw while importing or running fails the child (and the test).
 */
const run = (entry: string, body: string, { withoutBuiltins = false } = {}): ScenarioResult => {
    const script = `
        let warnings = 0;
        console.warn = () => { warnings += 1; };
        ${withoutBuiltins ? "process.getBuiltinModule = undefined;" : ""}
        const api = await import(${JSON.stringify(pathToFileURL(entry).href)});
        const result = await (async () => { ${body} })();
        process.stdout.write(JSON.stringify({ ...result, warnings }));
    `;

    return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8" })) as ScenarioResult;
};

describe("import safety of the built entry", () => {
    beforeAll(() => {
        workDirectory = mkdtempSync(join(tmpdir(), "disposable-email-domains-"));
        urllessEntry = join(workDirectory, "index.js");

        // Same effect as a bundler that cannot provide `import.meta.url`.
        const { code } = transformSync(readFileSync(distEntry, "utf8"), { define: { "import.meta.url": "undefined" }, format: "esm", loader: "js" });

        writeFileSync(urllessEntry, code);
    });

    afterAll(() => {
        rmSync(workDirectory, { force: true, recursive: true });
    });

    it("evaluates without throwing when import.meta.url is undefined, and the matcher works after setDomains()", () => {
        expect.assertions(3);

        const result = run(
            urllessEntry,
            `api.setDomains(["mailinator.com"]);
             return { disposableDomain: api.isDisposableDomain("sub.mailinator.com"), disposableEmail: api.isDisposableEmail("a@mailinator.com") && !api.isDisposableEmail("a@example.com") };`,
        );

        expect(result.disposableDomain).toBe(true);
        expect(result.disposableEmail).toBe(true);
        expect(result.warnings).toBe(0);
    });

    it("evaluates and matches with neither import.meta.url nor the node: builtins", () => {
        expect.assertions(2);

        const result = run(
            urllessEntry,
            `api.setDomains(["mailinator.com"]);
             return { disposableDomain: api.isDisposableDomain("mailinator.com"), disposableEmail: api.isDisposableEmail("a@example.com") };`,
            { withoutBuiltins: true },
        );

        expect(result.disposableDomain).toBe(true);
        expect(result.disposableEmail).toBe(false);
    });

    it.each([false, true])("falls back to the empty list with a single warning when there is no URL and no injected list (withoutBuiltins: %s)", (withoutBuiltins) => {
        expect.assertions(3);

        const result = run(
            urllessEntry,
            `const first = api.isDisposableDomain("mailinator.com");
             const second = api.isDisposableDomain("mailinator.com");
             return { disposableDomain: first || second, listLoaded: api.isListLoaded() };`,
            { withoutBuiltins },
        );

        expect(result.disposableDomain).toBe(false);
        expect(result.listLoaded).toBe(false);
        expect(result.warnings).toBe(1);
    });

    it("still lazily loads dist/domains.json from disk when import.meta.url is available", () => {
        expect.assertions(3);

        const result = run(distEntry, `await api.preload(); return { disposableDomain: api.isDisposableDomain("mailinator.com"), listLoaded: api.isListLoaded() };`);

        expect(result.listLoaded).toBe(true);
        expect(result.disposableDomain).toBe(true);
        expect(result.warnings).toBe(0);
    });

    it("keeps node: builtins out of the static import graph of the built entry", () => {
        expect.assertions(1);

        expect(readFileSync(distEntry, "utf8").split("\n").filter((line) => line.startsWith("import ") && line.includes("node:"))).toStrictEqual([]);
    });
});
