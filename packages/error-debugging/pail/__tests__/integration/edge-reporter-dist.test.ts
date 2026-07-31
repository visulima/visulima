import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const distributionRoot = join(here, "..", "..", "dist");

const EDGE_ENTRY = join(distributionRoot, "reporter/http/http-reporter.edge-light.js");

/**
 * Control sample for the graph walk: a Node-only entry that is a bare re-export file, so the
 * `node:module` its bundle depends on can only be found by following the chunk it points at.
 */
const NODE_ENTRY_REACHING_NODE_MODULE = join(distributionRoot, "reporter/json/index.js");

const STATIC_SPECIFIER_REGEX = /^(?:import|export)\s[^;]*?\bfrom\s*["']([^"']+)["']|^import\s*["']([^"']+)["']/gmu;

/**
 * Every specifier reachable through *static* `import`/`export ... from` declarations.
 * `await import("node:zlib")` is deliberately not collected: a dynamic import is only
 * evaluated when the branch that needs it actually runs, so it cannot break module load.
 * @param source The bundled module source text.
 * @returns The specifier of each static declaration, verbatim.
 */
const staticSpecifiersIn = (source: string): string[] => {
    const specifiers: string[] = [];

    for (const match of source.matchAll(STATIC_SPECIFIER_REGEX)) {
        const specifier = match[1] ?? match[2];

        if (specifier !== undefined) {
            specifiers.push(specifier);
        }
    }

    return specifiers;
};

/**
 * Walks the built entry and every relative chunk it pulls in, so the guard keeps holding
 * if the bundler later splits this entry across chunks instead of inlining everything.
 * @param entry Absolute path of the built entry file.
 * @returns One `[file, specifier]` pair per bare (non-relative) static import found.
 */
const bareStaticImportsInGraph = (entry: string): [string, string][] => {
    const found: [string, string][] = [];
    const seen = new Set<string>();
    const queue = [entry];

    while (queue.length > 0) {
        const file = queue.pop() as string;

        if (seen.has(file)) {
            continue;
        }

        seen.add(file);

        for (const specifier of staticSpecifiersIn(readFileSync(file, "utf8"))) {
            if (specifier.startsWith(".")) {
                queue.push(resolve(dirname(file), specifier));
            } else {
                found.push([file.replace(`${distributionRoot}/`, ""), specifier]);
            }
        }
    }

    return found;
};

/**
 * The `edge-light` and `workerd` export conditions resolve to this built file, so it must load
 * on runtimes that ship no Node core. A static `node:*` import breaks that at *import* time —
 * and it does not have to come from our own source: the bundler emits a CJS-interop preamble
 * (`import { createRequire } from "node:module"`) into any chunk that inlines a dependency
 * doing module-scope `getBuiltinModule(...)`. The source-level guard in
 * `__tests__/workerd/reporter/edge-module-graph.test.ts` cannot see that, so assert it here,
 * against what actually ships.
 */
describe("built edge HTTP reporter", () => {
    it("exists so the assertions below are not vacuous", () => {
        expect.assertions(2);

        expect(existsSync(EDGE_ENTRY), `${EDGE_ENTRY} is missing — run \`pnpm run build\` first`).toBe(true);
        expect(readFileSync(EDGE_ENTRY, "utf8")).toContain("HttpReporterEdgeLight");
    });

    it("declares no static node: import anywhere in its chunk graph", () => {
        expect.assertions(1);

        expect(bareStaticImportsInGraph(EDGE_ENTRY).filter(([, specifier]) => specifier.startsWith("node:"))).toStrictEqual([]);
    });

    it("carries no module-scope CJS interop for Node builtins", () => {
        expect.assertions(2);

        const source = readFileSync(EDGE_ENTRY, "utf8");

        expect(source).not.toContain("createRequire");
        expect(source).not.toContain("getBuiltinModule");
    });

    it("reaches node:zlib only through a dynamic import", () => {
        expect.assertions(1);

        expect(readFileSync(EDGE_ENTRY, "utf8")).toContain("await import('node:zlib')");
    });

    it("detects the interop preamble in a Node-only sibling entry", () => {
        expect.assertions(2);

        // Control sample — proves the graph walk above is not passing vacuously. The JSON reporter's
        // Node entry is nothing but re-exports and reaches `node:module` only through the chunk it
        // points at, so a check that stopped at the entry file would miss it. The preamble is
        // correct there in any case: that entry is never resolved on an edge runtime.
        const specifiers = bareStaticImportsInGraph(NODE_ENTRY_REACHING_NODE_MODULE).map(([, specifier]) => specifier);

        expect(readFileSync(NODE_ENTRY_REACHING_NODE_MODULE, "utf8")).not.toContain("node:module");
        expect(specifiers).toContain("node:module");
    });
});
