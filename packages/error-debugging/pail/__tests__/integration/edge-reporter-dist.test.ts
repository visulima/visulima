import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const distributionRoot = join(here, "..", "..", "dist");

const EDGE_ENTRY = join(distributionRoot, "reporter/http/http-reporter.edge-light.js");

/** The artefact the `edge-light` and `workerd` conditions on the `.` export resolve to. */
const ROOT_EDGE_ENTRY = join(distributionRoot, "index.browser.js");

/** The artefact the `import` (Node) condition on the `.` export resolves to. */
const ROOT_NODE_ENTRY = join(distributionRoot, "index.server.js");

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
 * Every built file reachable from `entry` through relative static imports, `entry` included.
 * @param entry Absolute path of the built entry file.
 * @returns The dist-relative path of each chunk in the graph.
 */
const filesInGraph = (entry: string): string[] => {
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
            }
        }
    }

    return [...seen];
};

/**
 * Module-scope reaches into Node core that survive bundling but are not `import` declarations:
 * packem's `requireCJS` transform rewrites `import ... from "node:x"` into a `createRequire` /
 * `process.getBuiltinModule` lookup, and a bare `process` fallback. All three throw on a runtime
 * that ships no Node core, so an import-only check would miss them.
 * @param entry Absolute path of the built entry file.
 * @returns One `[file, marker]` pair per offending chunk.
 */
const nodeCoreReachesInGraph = (entry: string): [string, string][] => {
    const markers = ["node:", "createRequire", "getBuiltinModule"];

    return filesInGraph(entry).flatMap((file) => {
        const source = readFileSync(file, "utf8");

        return markers.filter((marker) => source.includes(marker)).map((marker): [string, string] => [file.replace(`${distributionRoot}/`, ""), marker]);
    });
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

/**
 * The root (`.`) export is the entry every consumer reaches by importing the package name, so it
 * is the one that decides whether `@visulima/pail` can be loaded at all on Cloudflare Workers
 * without `nodejs_compat` or on Vercel Edge. Its `edge-light`/`workerd` conditions resolve to the
 * browser build; that build has to stay free of *any* module-scope reach into Node core, not just
 * of `import` declarations — packem rewrites `node:*` imports into `getBuiltinModule`/
 * `createRequire` lookups, which fail exactly as hard at load time.
 */
describe("built edge root entry", () => {
    it("is what the edge-light and workerd conditions on the `.` export point at", () => {
        expect.assertions(3);

        const manifest = JSON.parse(readFileSync(join(distributionRoot, "..", "package.json"), "utf8")) as {
            exports: Record<string, Record<string, { default: string }>>;
        };

        const root = manifest.exports["."] as Record<string, { default: string }>;

        expect(root["edge-light"]?.default).toBe("./dist/index.browser.js");
        expect(root["workerd"]?.default).toBe("./dist/index.browser.js");
        // Node must keep resolving the server build.
        expect(root["import"]?.default).toBe("./dist/index.server.js");
    });

    it("exists so the assertions below are not vacuous", () => {
        expect.assertions(2);

        expect(existsSync(ROOT_EDGE_ENTRY), `${ROOT_EDGE_ENTRY} is missing — run \`pnpm run build\` first`).toBe(true);
        expect(readFileSync(ROOT_EDGE_ENTRY, "utf8")).toContain("createPail");
    });

    it("declares no static node: import anywhere in its chunk graph", () => {
        expect.assertions(1);

        expect(bareStaticImportsInGraph(ROOT_EDGE_ENTRY).filter(([, specifier]) => specifier.startsWith("node:"))).toStrictEqual([]);
    });

    it("carries no module-scope reach into Node core anywhere in its chunk graph", () => {
        expect.assertions(1);

        expect(nodeCoreReachesInGraph(ROOT_EDGE_ENTRY)).toStrictEqual([]);
    });

    it("detects the Node core reaches in the sibling server root entry", () => {
        expect.assertions(2);

        // Control sample — proves the two checks above are not passing vacuously. The server root
        // entry is the artefact the `import` condition resolves to, and it legitimately reaches
        // Node core: `node:module` for the CJS interop preamble, plus `getBuiltinModule` calls
        // that the bundled terminal-size makes at module scope.
        const markers = nodeCoreReachesInGraph(ROOT_NODE_ENTRY).map(([, marker]) => marker);

        expect(bareStaticImportsInGraph(ROOT_NODE_ENTRY).map(([, specifier]) => specifier)).toContain("node:module");
        expect(markers).toContain("getBuiltinModule");
    });
});
