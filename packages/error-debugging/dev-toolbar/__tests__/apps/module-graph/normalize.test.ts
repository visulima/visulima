import { describe, expect, it } from "vitest";

import { filterModules, getExtension, toModuleEntries } from "../../../src/apps/module-graph/normalize";

describe(getExtension, () => {
    it("reads a plain extension", () => {
        expect.hasAssertions();

        expect(getExtension("/src/main.ts")).toBe("ts");
    });

    it("stops at vite's query string", () => {
        expect.hasAssertions();

        expect(getExtension("/src/App.vue?v=abc123")).toBe("vue");
        expect(getExtension("/src/worker.ts?worker")).toBe("ts");
    });

    it("skips a dotted directory and takes the real extension", () => {
        expect.hasAssertions();

        // Without the `(?:\?|$)` anchor the first match wins and this reads
        // as "vite" — the dep-optimiser cache path makes that a live case.
        expect(getExtension("/node_modules/.vite/deps/react.js")).toBe("js");
        expect(getExtension("/src/main.ts.map")).toBe("map");
    });

    it("lowercases the extension", () => {
        expect.hasAssertions();

        expect(getExtension("/assets/LOGO.SVG")).toBe("svg");
    });

    it("falls back to a question mark when there is no extension", () => {
        expect.hasAssertions();

        expect(getExtension("/virtual:module")).toBe("?");
        expect(getExtension("")).toBe("?");
    });
});

describe(toModuleEntries, () => {
    it("fills url from id when the module reports only an id", () => {
        expect.hasAssertions();

        expect(toModuleEntries([{ id: "/src/main.ts" }])).toStrictEqual([
            { ext: "ts", id: "/src/main.ts", importers: 0, importerUrls: [], url: "/src/main.ts" },
        ]);
    });

    it("fills id from url when the module reports only a url", () => {
        expect.hasAssertions();

        expect(toModuleEntries([{ url: "/src/app.tsx" }])[0]?.id).toBe("/src/app.tsx");
    });

    it("defaults a missing importer count to zero", () => {
        expect.hasAssertions();

        expect(toModuleEntries([{ url: "/a.ts" }])[0]?.importers).toBe(0);
    });

    it("drops an importerUrls value that is not an array", () => {
        expect.hasAssertions();

        expect(toModuleEntries([{ importerUrls: "nope", url: "/a.ts" }])[0]?.importerUrls).toStrictEqual([]);
    });

    it("survives a null entry rather than throwing", () => {
        expect.hasAssertions();

        expect(toModuleEntries([null])).toStrictEqual([{ ext: "?", id: "", importers: 0, importerUrls: [], url: "" }]);
    });
});

describe(filterModules, () => {
    const modules = toModuleEntries([{ url: "/src/Main.ts" }, { url: "/src/styles.css" }, { url: "/src/App.vue" }]);

    it("returns everything for an empty query", () => {
        expect.hasAssertions();

        expect(filterModules(modules, "")).toHaveLength(3);
    });

    it("matches the url case-insensitively", () => {
        expect.hasAssertions();

        expect(filterModules(modules, "main").map((module_) => module_.url)).toStrictEqual(["/src/Main.ts"]);
    });

    it("matches on the extension where the url cannot match", () => {
        expect.hasAssertions();

        // A real extension is always a substring of its own url, so the
        // extension clause only adds anything for the "?" placeholder that
        // stands in for a module with no extension at all.
        const virtual = toModuleEntries([{ url: "/virtual:module" }, { url: "/src/main.ts" }]);

        expect(filterModules(virtual, "?").map((module_) => module_.url)).toStrictEqual(["/virtual:module"]);
    });

    it("returns nothing when nothing matches", () => {
        expect.hasAssertions();

        expect(filterModules(modules, "zzz")).toStrictEqual([]);
    });
});
