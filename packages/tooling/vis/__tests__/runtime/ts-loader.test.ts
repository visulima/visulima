/**
 * Tests for the runtime data-file imports and tsconfig `paths` resolution wired
 * into the `module.registerHooks` load/resolve hooks (see `src/runtime/ts-loader.ts`).
 *
 * Both features live in the graph-wide `module.registerHooks` hook, which only
 * exists on Node 22.15+/24. Crucially, Vitest's own module runner intercepts
 * dynamic `import()` (via Vite/Rolldown), so importing a fixture from inside a
 * test would bypass Node's native loader and never reach our hook. To exercise
 * the real hook we therefore spawn a fresh Node subprocess that:
 *   - registers the hooks (`registerTsHooks`),
 *   - imports the data/aliased fixtures through Node's native ESM loader,
 *   - prints the parsed results as JSON for assertion here.
 *
 * The subprocess loads the loader's TypeScript source via Node's built-in type
 * stripping (`--experimental-strip-types`), so the suite is skipped when the
 * host Node lacks either `module.registerHooks` or type stripping. The aliased
 * targets are `.mjs`/data files on purpose — resolving them needs only the
 * resolve hook + tsconfig reader, not the native TS transform.
 */
import { spawnSync } from "node:child_process";
import nodeModule from "node:module";
import { fileURLToPath } from "node:url";

import { dirname, join } from "@visulima/path";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..");
const fixtures = join(here, "__fixtures__", "ts-loader");

// eslint-disable-next-line n/no-unsupported-features/node-builtins -- runtime feature-detect; suite is skipped when absent
const hasRegisterHooks = typeof (nodeModule as { registerHooks?: unknown }).registerHooks === "function";

const supportsTypeStripping = (() => {
    const probe = spawnSync(process.execPath, ["--experimental-strip-types", "-e", "const x: number = 1; process.stdout.write(String(x));"], {
        encoding: "utf8",
    });

    return probe.status === 0 && probe.stdout.trim() === "1";
})();

const describeHooked = hasRegisterHooks && supportsTypeStripping ? describe : describe.skip;

/**
 * Run a snippet inside a Node subprocess with the loader hooks active. The
 * snippet body has `loader` (the imported module) and `fixtures` (the absolute
 * fixtures dir) in scope and must `console.log` a single JSON line.
 */
const runInLoader = (body: string): unknown => {
    const script = [
        `import { pathToFileURL } from "node:url";`,
        `import * as loader from ${JSON.stringify(join(packageRoot, "src", "runtime", "ts-loader.ts"))};`,
        `const fixtures = ${JSON.stringify(fixtures)};`,
        `loader.registerTsHooks();`,
        `const importData = async (relative) => (await import(pathToFileURL(fixtures + "/" + relative).href)).default;`,
        body,
    ].join("\n");

    const result = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "--input-type=module", "-"], {
        cwd: packageRoot,
        encoding: "utf8",
        input: script,
    });

    if (result.status !== 0) {
        throw new Error(`loader subprocess failed:\n${result.stderr}`);
    }

    const lastLine = result.stdout.trim().split("\n").at(-1) ?? "";

    return JSON.parse(lastLine) as unknown;
};

describeHooked("ts-loader data-file imports", () => {
    it("parses .yaml into a default export", () => {
        expect.hasAssertions();

        expect(runInLoader(`console.log(JSON.stringify(await importData("data.yaml")));`)).toStrictEqual({
            name: "vis-yaml",
            nested: { enabled: true, tags: ["a", "b"] },
            port: 8080,
        });
    });

    it("parses .yml into a default export", () => {
        expect.hasAssertions();

        expect(runInLoader(`console.log(JSON.stringify(await importData("data.yml")));`)).toStrictEqual({ name: "vis-yml", port: 9090 });
    });

    it("parses .toml into a default export", () => {
        expect.hasAssertions();

        expect(runInLoader(`console.log(JSON.stringify(await importData("data.toml")));`)).toStrictEqual({
            name: "vis-toml",
            server: { port: 3000 },
        });
    });

    it("parses .jsonc (comments + trailing commas) into a default export", () => {
        expect.hasAssertions();

        expect(runInLoader(`console.log(JSON.stringify(await importData("data.jsonc")));`)).toStrictEqual({ name: "vis-jsonc", port: 1234 });
    });

    it("parses .json5 into a default export", () => {
        expect.hasAssertions();

        expect(runInLoader(`console.log(JSON.stringify(await importData("data.json5")));`)).toStrictEqual({ name: "vis-json5", port: 5678 });
    });

    it("returns the raw string for .txt", () => {
        expect.hasAssertions();

        expect(runInLoader(`console.log(JSON.stringify(await importData("data.txt")));`)).toBe("hello raw text\nsecond line\n");
    });
});

describeHooked("ts-loader tsconfig paths resolution", () => {
    it("resolves an exact `paths` alias that points at a data file", () => {
        expect.hasAssertions();

        const value = runInLoader(
            [
                `const { writeFileSync, unlinkSync } = await import("node:fs");`,
                `const probe = fixtures + "/paths-alias/src/probe-exact.mjs";`,
                `writeFileSync(probe, 'import config from "@data/config"; export default config;');`,
                `try { console.log(JSON.stringify((await import(pathToFileURL(probe).href)).default)); }`,
                `finally { unlinkSync(probe); }`,
            ].join("\n"),
        );

        expect(value).toStrictEqual({ replicas: 3, service: "aliased-yaml" });
    });

    it("resolves a wildcard `paths` alias to a module", () => {
        expect.hasAssertions();

        const value = runInLoader(
            [
                `const { writeFileSync, unlinkSync } = await import("node:fs");`,
                `const target = fixtures + "/paths-alias/lib/wild-target.mjs";`,
                `const probe = fixtures + "/paths-alias/src/probe-wild.mjs";`,
                `writeFileSync(target, 'export const greeting = "from-aliased-lib"; export const answer = 42;');`,
                `writeFileSync(probe, 'import { greeting, answer } from "@lib/wild-target"; export default { greeting, answer };');`,
                `try { console.log(JSON.stringify((await import(pathToFileURL(probe).href)).default)); }`,
                `finally { unlinkSync(target); unlinkSync(probe); }`,
            ].join("\n"),
        );

        expect(value).toStrictEqual({ answer: 42, greeting: "from-aliased-lib" });
    });

    it("resolves `paths` inherited through tsconfig `extends`", () => {
        expect.hasAssertions();

        const value = runInLoader(
            [
                `const { writeFileSync, unlinkSync } = await import("node:fs");`,
                `const root = fixtures + "/paths-extends/src/";`,
                `writeFileSync(root + "ext-target.mjs", 'export const fromExtends = "extends-works";');`,
                `writeFileSync(root + "probe-ext.mjs", 'import { fromExtends } from "@base/ext-target"; export default fromExtends;');`,
                `try { console.log(JSON.stringify((await import(pathToFileURL(root + "probe-ext.mjs").href)).default)); }`,
                `finally { unlinkSync(root + "ext-target.mjs"); unlinkSync(root + "probe-ext.mjs"); }`,
            ].join("\n"),
        );

        expect(value).toBe("extends-works");
    });
});
