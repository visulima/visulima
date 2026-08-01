import { describe, expect, it } from "vitest";

// @ts-expect-error -- Vite `?raw` import. Control sample: this module does import Node builtins statically.
import controlSource from "../../__fixtures__/static-node-import-control.ts?raw";
// @ts-expect-error -- Vite `?raw` import: inlines the file contents as a string at transform time.
import indexSource from "../../src/index.ts?raw";
// @ts-expect-error -- Vite `?raw` import.
import cliBoxesSource from "../../src/vendor/cli-boxes/boxes.ts?raw";
// @ts-expect-error -- Vite `?raw` import.
import terminalSizeSource from "../../src/vendor/terminal-size/index.ts?raw";
// @ts-expect-error -- Vite `?raw` import.
import widestLineSource from "../../src/widest-line.ts?raw";

/**
 * Every bare specifier that is known to pull Node builtins into the graph of
 * whoever imports it. `node:` covers the builtins themselves; `terminal-size`
 * is listed by name because its own entry statically imports four of them, so a
 * static import of it is just as fatal on a runtime without Node builtins.
 */
const NODE_ONLY_SPECIFIERS = ["node:", "terminal-size"];

/**
 * Any *static* `import`/`export … from` declaration, plus bare side-effect imports.
 *
 * Matching is deliberately not line-based: Prettier wraps a named-import list that runs
 * past the print width across several lines, and a per-line scan would never see the
 * specifier. `[^;"']*` spans newlines but stops at the first `;` or quote, so a wrapped
 * declaration is captured whole while the scan can neither run on into the statement that
 * follows nor step over an intervening string literal.
 *
 * The `m` anchor is what keeps dynamic imports out: `await import("node:x")` never begins
 * a line, and a line-initial `import("node:x")` has no whitespace after `import`, which
 * the pattern requires.
 *
 * The clause before the specifier is optional so bare side-effect imports
 * (`import "node:x";`) are covered by the same pattern rather than a second one.
 */
const STATIC_IMPORT_REGEX = /^(?:import|export)\s(?:[^;"']*\bfrom\s)?["']([^"']+)["'];?/gmu;

/**
 * Collects *static* `import`/`export ... from` declarations naming a specifier from
 * {@link NODE_ONLY_SPECIFIERS} — the form that fails at module-load time.
 * `await import("node:x")` is deliberately not reported: a dynamic import is only
 * evaluated when the branch that needs it actually runs, and
 * `process.getBuiltinModule("node:x")` is a plain runtime call no resolver ever sees.
 * @param source The module source text.
 * @returns Every offending declaration, verbatim — newlines included, for wrapped ones.
 */
const staticNodeImportsIn = (source: string): string[] => {
    const offenders: string[] = [];

    for (const match of source.matchAll(STATIC_IMPORT_REGEX)) {
        const specifier = match[1];

        if (specifier !== undefined && NODE_ONLY_SPECIFIERS.some((prefix) => specifier.startsWith(prefix))) {
            offenders.push(match[0]);
        }
    }

    return offenders;
};

/**
 * `boxen()` is a pure string transform, so merely importing `@visulima/boxen` must not
 * require a single Node builtin. A static `node:*` import anywhere in its module graph
 * breaks that at *import* time — before a box is ever rendered — and cannot be caught by
 * the runtime specs in this directory, because `nodejs_compat` makes those imports resolve
 * under the workerd test harness even though a plain Worker would fail to load them.
 */
describe("boxen module graph", () => {
    const modules: [string, string][] = [
        ["index.ts", indexSource as string],
        ["widest-line.ts", widestLineSource as string],
        ["vendor/cli-boxes/boxes.ts", cliBoxesSource as string],
        ["vendor/terminal-size/index.ts", terminalSizeSource as string],
    ];

    it.each(modules)("%s declares no static node-only import", (_name, source) => {
        expect.assertions(2);

        // Guards against `?raw` handing back an empty string, which would make the
        // assertion below pass without inspecting anything.
        expect(source.length).toBeGreaterThan(0);
        expect(staticNodeImportsIn(source)).toStrictEqual([]);
    });

    it("detects static node-only imports when they are present", () => {
        expect.assertions(1);

        // Control sample — proves the checks above are not passing vacuously.
        expect(staticNodeImportsIn(controlSource as string)).toStrictEqual([
            "import { execFileSync } from \"node:child_process\";",
            "import {\n    readFileSync,\n    writeFileSync,\n} from \"node:fs\";",
            "import terminalSize from \"terminal-size\";",
        ]);
    });

    it("reaches Node builtins only through process.getBuiltinModule", () => {
        expect.assertions(2);

        expect(terminalSizeSource as string).toContain("hostProcess.getBuiltinModule(id)");
        expect(staticNodeImportsIn(terminalSizeSource as string)).toStrictEqual([]);
    });

    it("keeps the terminal-size probe synchronous", () => {
        expect.assertions(2);

        // A dynamic `import()` would also keep the graph clean, but it is asynchronous
        // and the public `boxen()` API is not — so it must not appear here.
        expect(terminalSizeSource as string).not.toContain("await import(");
        expect(indexSource as string).not.toContain("await import(");
    });
});
