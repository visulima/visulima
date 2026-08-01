import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const distributionRoot = join(here, "..", "..", "dist");

/**
 * The specifier of an `import`/`export … from` declaration. Matched on `from` rather than on the
 * statement start, because a production build ships each chunk on one line and drops the space
 * after `import`. A dynamic `import("…")` has no `from` and is deliberately not collected: it is
 * evaluated only when the branch that needs it runs, so it cannot break module load.
 */
const FROM_SPECIFIER_REGEX = /\bfrom\s*["']([^"']+)["']/gu;

/** A bare `import "…"`, which has no `from` to match on. */
// eslint-disable-next-line sonarjs/slow-regex -- disjoint alternatives, so no super-linear backtracking
const SIDE_EFFECT_IMPORT_REGEX = /(?:^|[;}])\s*import\s*["']([^"']+)["']/gmu;

/**
 * A `"node:…"` string literal, which is how a Node-builtin reach survives minification — the
 * identifier that consumes it does not, so the literal is the only stable handle on one.
 */
const NODE_SPECIFIER_REGEX = /["'](node:[^"']+)["']/gu;

/**
 * The built entries a consumer can reach without a peer dependency. `solution/ai` is left out: it
 * needs the optional `ai` peer, so a failed import there says nothing about Node core.
 */
const PUBLIC_ENTRIES = ["index.js", "error/index.js", "stacktrace/index.js", "code-frame/index.js", "solution/index.js"];

/**
 * Imports a built entry in a fresh Node process with `process.getBuiltinModule` removed, which is
 * what an edge runtime effectively looks like to this package.
 * @param entry Absolute path of the built entry to import.
 * @returns Whatever the import wrote to stdout, which is nothing on success.
 * @throws When the entry reaches into Node core while its module scope is being evaluated.
 */
const importWithoutNodeCore = (entry: string): string =>
    execFileSync(process.execPath, ["--input-type=module", "--eval", "delete process.getBuiltinModule; await import(process.env.ENTRY);"], {
        encoding: "utf8",
        env: { ...process.env, ENTRY: pathToFileURL(entry).href },
        stdio: "pipe",
    });

const distributionFiles = (): string[] => {
    const found: string[] = [];
    const queue = [distributionRoot];

    while (queue.length > 0) {
        for (const entry of readdirSync(queue.pop() as string, { withFileTypes: true })) {
            const path = join(entry.parentPath, entry.name);

            if (entry.isDirectory()) {
                queue.push(path);
            } else if (entry.name.endsWith(".js")) {
                found.push(path);
            }
        }
    }

    return found.toSorted((a, b) => a.localeCompare(b));
};

const staticSpecifiersIn = (source: string): string[] =>
    [...source.matchAll(FROM_SPECIFIER_REGEX), ...source.matchAll(SIDE_EFFECT_IMPORT_REGEX)].map((match) => match[1] as string);

/**
 * This package declares `"sideEffects": false`, and consumers bundle it on that promise. A
 * module-scope reach into Node core breaks it two ways: a bundler has to assume the statement
 * matters and keeps the chunk alive even when none of its exports are used, and on a runtime with
 * no Node core (Cloudflare Workers without `nodejs_compat`, Vercel Edge) the reach fails while the
 * module is still being imported — so a consumer importing only `serializeError` from `./error`
 * crashes because `renderError` sits in the same barrel.
 *
 * `src/util/node-builtin.ts` keeps every reach inside the function that needs it. These assertions
 * are what keeps that honest, and they run against whatever `dist` currently holds — production
 * builds included, where minification would hide a reach from any check written against identifier
 * names.
 */
describe("built `@visulima/error` distribution", () => {
    it("exists so the assertions below are not vacuous", () => {
        expect.assertions(2);

        expect(existsSync(distributionRoot), `${distributionRoot} is missing — run \`pnpm run build\` first`).toBe(true);
        expect(distributionFiles().length).toBeGreaterThan(0);
    });

    it("declares no static `node:` import", () => {
        expect.assertions(1);

        const offenders = distributionFiles().flatMap((file) =>
            staticSpecifiersIn(readFileSync(file, "utf8"))
                .filter((specifier) => specifier.startsWith("node:"))
                .map((specifier) => [relative(distributionRoot, file), specifier]),
        );

        expect(offenders).toStrictEqual([]);
    });

    it("ships no `createRequire` fallback", () => {
        expect.assertions(1);

        expect(
            distributionFiles()
                .filter((file) => readFileSync(file, "utf8").includes("createRequire"))
                .map((file) => relative(distributionRoot, file)),
        ).toStrictEqual([]);
    });

    it.each(PUBLIC_ENTRIES)("loads %s on a runtime with no Node core", (entry) => {
        expect.assertions(1);

        // Asserted by running rather than by reading: minification renames every identifier a
        // textual check could anchor on, and "is this statement at module scope" is not a question
        // a regex can answer over a one-line chunk. Importing with `process.getBuiltinModule`
        // removed reproduces exactly what an edge runtime does to a module-scope reach.
        expect(() => importWithoutNodeCore(join(distributionRoot, entry))).not.toThrow();
    });

    it("still reaches Node core, so the check above is not vacuous", () => {
        expect.assertions(1);

        const reaches = distributionFiles().flatMap((file) =>
            [...readFileSync(file, "utf8").matchAll(NODE_SPECIFIER_REGEX)].map((match) => `${relative(distributionRoot, file)}: ${match[1] as string}`),
        );

        expect(reaches.length).toBeGreaterThan(0);
    });
});
