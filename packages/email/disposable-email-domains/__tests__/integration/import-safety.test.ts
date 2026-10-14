import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build, transformSync } from "esbuild";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// These tests load the BUILT entry (`dist/index.js`, run `pnpm run build` first) in a fresh
// `node` process, so module-scope code is evaluated exactly once, for real. The workerd test
// covers the same defect in a real Workers runtime; these cover what only Node can: the disk
// loader, and runtimes that have `import.meta.url` but no `process.getBuiltinModule`.

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..");
const distEntry = join(packageRoot, "dist", "index.js");
const scenarioScript = join(packageRoot, "__fixtures__", "import-safety", "scenario.mjs");

interface ScenarioResult {
    disposable: boolean;
    listLoaded: boolean;
    notDisposable: boolean;
    warnings: number;
}

const run = (entry: string, scenario: "empty" | "inject" | "preload", flags: string[] = []): ScenarioResult =>
    JSON.parse(execFileSync(process.execPath, [scenarioScript, pathToFileURL(entry).href, scenario, ...flags], { encoding: "utf8" })) as ScenarioResult;

describe("import safety of the built entry", () => {
    let workDirectory: string;
    let urllessEntry: string;

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

    it("matches after setDomains() with neither import.meta.url nor process.getBuiltinModule", () => {
        expect.assertions(4);

        const result = run(urllessEntry, "inject", ["--no-builtins"]);

        expect(result.disposable).toBe(true);
        expect(result.notDisposable).toBe(true);
        expect(result.listLoaded).toBe(true);
        expect(result.warnings).toBe(0);
    });

    it("falls back to the empty list with a single warning when there is no URL and no injected list", () => {
        expect.assertions(3);

        const result = run(urllessEntry, "empty");

        expect(result.disposable).toBe(false);
        expect(result.listLoaded).toBe(false);
        expect(result.warnings).toBe(1);
    });

    it("falls back to the empty list with a single warning when the URL exists but process.getBuiltinModule does not", () => {
        expect.assertions(3);

        const result = run(distEntry, "empty", ["--no-builtins"]);

        expect(result.disposable).toBe(false);
        expect(result.listLoaded).toBe(false);
        expect(result.warnings).toBe(1);
    });

    it("loads dist/domains.json from disk on first use when import.meta.url is available", () => {
        expect.assertions(3);

        const result = run(distEntry, "preload");

        expect(result.listLoaded).toBe(true);
        expect(result.disposable).toBe(true);
        expect(result.warnings).toBe(0);
    });

    it("has no static node: import in the built entry", async () => {
        expect.assertions(1);

        const { metafile } = await build({ bundle: false, entryPoints: [distEntry], format: "esm", metafile: true, write: false });
        const imports = Object.values(metafile.outputs).flatMap((output) => output.imports.map((entry) => entry.path));

        expect(imports.filter((path) => path.startsWith("node:"))).toStrictEqual([]);
    });
});
