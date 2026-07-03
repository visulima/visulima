// @vitest-environment node
import type { ViteDevServer } from "vite";
import { describe, expect, it } from "vitest";

import { getModuleGraph } from "../../../src/rpc/functions/module-graph";

interface FakeModule {
    id?: string | null;
    importers: Set<FakeModule>;
    url?: string | null;
}

const makeServer = (modules: FakeModule[]): ViteDevServer => {
    const idToModuleMap = new Map<string, FakeModule>();

    for (const [index, node] of modules.entries()) {
        idToModuleMap.set(node.id ?? node.url ?? `mod-${String(index)}`, node);
    }

    return { moduleGraph: { idToModuleMap } } as unknown as ViteDevServer;
};

describe("rpc/functions/module-graph", () => {
    describe(getModuleGraph, () => {
        it("returns an empty array for an empty graph", async () => {
            expect.assertions(1);

            const result = await getModuleGraph(makeServer([]));

            expect(result).toEqual([]);
        });

        it("serialises modules and counts importers with their urls", async () => {
            expect.assertions(4);

            const importer: FakeModule = { id: "/src/main.ts", importers: new Set(), url: "/src/main.ts" };
            const target: FakeModule = { id: "/src/foo.ts", importers: new Set([importer]), url: "/src/foo.ts" };

            const result = await getModuleGraph(makeServer([importer, target]));
            const foo = result.find((m) => m.url === "/src/foo.ts");

            expect(foo).toBeDefined();
            expect(foo?.importerCount).toBe(1);
            expect(foo?.importerUrls).toEqual(["/src/main.ts"]);
            expect(foo?.id).toBe("/src/foo.ts");
        });

        it("falls back to importer id when url is missing and skips importers with neither", async () => {
            expect.assertions(2);

            const idOnly: FakeModule = { id: "/src/id-only.ts", importers: new Set(), url: null };
            const empty: FakeModule = { id: null, importers: new Set(), url: null };
            const target: FakeModule = { id: "/src/target.ts", importers: new Set([empty, idOnly]), url: "/src/target.ts" };

            const result = await getModuleGraph(makeServer([idOnly, target]));
            const targetResult = result.find((m) => m.url === "/src/target.ts");

            // Importer with url=null falls back to its id; the empty importer is dropped.
            expect(targetResult?.importerUrls).toEqual(["/src/id-only.ts"]);
            expect(targetResult?.importerCount).toBe(2);
        });

        it("falls back to url for id and vice versa on the module itself", async () => {
            expect.assertions(2);

            const urlOnly: FakeModule = { id: null, importers: new Set(), url: "/virtual:thing" };

            const result = await getModuleGraph(makeServer([urlOnly]));

            expect(result[0]?.id).toBe("/virtual:thing");
            expect(result[0]?.url).toBe("/virtual:thing");
        });

        it("skips a module that has neither id nor url", async () => {
            expect.assertions(1);

            const ghost: FakeModule = { id: null, importers: new Set(), url: null };

            const result = await getModuleGraph(makeServer([ghost]));

            expect(result).toEqual([]);
        });
    });
});
