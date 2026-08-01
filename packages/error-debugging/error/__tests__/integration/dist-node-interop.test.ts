import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const distributionRoot = join(here, "..", "..", "dist");

/** Any `import`/`export … from` declaration, plus bare side-effect imports. */
const STATIC_SPECIFIER_REGEX = /^(?:import|export)\s[^;]*?\bfrom\s*["']([^"']+)["']|^import\s*["']([^"']+)["']/gmu;

/** A `__cjs_getBuiltinModule("node:…")` call site, with whatever immediately precedes it. */
const BUILTIN_LOOKUP_REGEX = /(.{0,18})__cjs_getBuiltinModule\(/gu;

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
 * This package declares `"sideEffects": false`, and consumers bundle it on that promise. The
 * bundler's `requireCJS` pass would otherwise break it: it rewrites `import … from "node:*"` into a
 * module-scope `__cjs_getBuiltinModule("node:*")` call backed by a static
 * `import { createRequire } from "node:module"`, so a chunk stays alive for its top-level statements
 * alone and drags `node:module` into consumer bundles that never touch the exports it provides.
 *
 * On a runtime with no Node core (Cloudflare Workers without `nodejs_compat`, Vercel Edge) a static
 * `node:module` import fails at import time, so this is a correctness property and not just a size
 * one. `packem.config.ts` strips the dead `createRequire` fallback and annotates the remaining
 * lookups as pure; these assertions are what keeps it honest.
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

    it("annotates every Node-builtin lookup as pure so consumers can drop it", () => {
        expect.assertions(2);

        const lookups: string[] = [];
        const unannotated: string[] = [];

        for (const file of distributionFiles()) {
            for (const match of readFileSync(file, "utf8").matchAll(BUILTIN_LOOKUP_REGEX)) {
                // The helper's own declaration is not a call site.
                if (match[1]?.endsWith("const ")) {
                    continue;
                }

                lookups.push(`${relative(distributionRoot, file)}: ${match[0]}`);

                if (!match[1]?.endsWith("/* @__PURE__ */ ")) {
                    unannotated.push(`${relative(distributionRoot, file)}: ${match[0]}`);
                }
            }
        }

        // Guards against the whole check going vacuous if `requireCJS` is ever turned off.
        expect(lookups.length).toBeGreaterThan(0);
        expect(unannotated).toStrictEqual([]);
    });
});
