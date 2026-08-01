import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { execScriptSync, typeCheckFixture } from "../helpers";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..");

/**
 * Every runtime target an `exports` sub-tree can resolve to, ignoring which
 * conditions are active — i.e. the set of distinct artefacts the subtree can hand
 * out. `types` is skipped: it points at declarations, not at a build.
 */
const collectRuntimeTargets = (node: unknown): string[] => {
    if (typeof node === "string") {
        return [node];
    }

    const targets: string[] = [];

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        if (key !== "types") {
            targets.push(...collectRuntimeTargets(value));
        }
    }

    return targets;
};

describe("usage `@visulima/inspector` npm package", () => {
    it(`should work as CommonJS package`, () => {
        expect.assertions(1);

        const filename = join(packageRoot, "__fixtures__/package/cjs/test.cjs");

        const received = execScriptSync(filename);

        expect(received).toBe("ok");
    });

    it(`should work as ESM package`, () => {
        expect.assertions(1);

        const filename = join(packageRoot, "__fixtures__/package/mjs/test.mjs");

        const received = execScriptSync(filename);

        expect(received).toBe("ok");
    });

    it(`should expose correct types via dist/*.d.ts`, () => {
        expect.assertions(2);

        const result = typeCheckFixture(packageRoot, "__fixtures__/package/types/tsconfig.json");

        expect(result.output).toBe("");
        expect(result.code).toBe(0);
    });

    it("should resolve every export condition to the one build", () => {
        expect.assertions(2);

        // This package is deliberately single-build: `dist/index.js` is runtime-agnostic
        // and serves Node, browsers, workerd and every other edge runtime alike. The
        // `browser` condition is therefore not a divert, it is the same file spelled
        // twice, and no `workerd`/`worker`/`edge-light` key is needed — adding one buys
        // nothing and, being a condition packem does not emit a target for, risks
        // failing the build (which runs with `failOnWarn`).
        //
        // Contrast `@visulima/colorize` and `@visulima/is-ansi-color-supported`, which
        // ship distinct server/browser artefacts; there a `workerd` key ahead of
        // `browser` genuinely matters, because the Workers runtime resolves with
        // `["workerd", "worker", "module", "browser"]` and no `"node"`, and would
        // otherwise be handed the browser build.
        //
        // This assertion fails the moment a distinct browser or edge artefact is
        // introduced here — deliberately. Condition *order* only starts to carry meaning
        // once the targets differ, so revisit it at the same time.
        const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
            exports: Record<string, unknown>;
        };

        const targets = collectRuntimeTargets(manifest.exports["."]);

        expect(targets.length).toBeGreaterThan(1);
        expect([...new Set(targets)]).toStrictEqual(["./dist/index.js"]);
    });
});
