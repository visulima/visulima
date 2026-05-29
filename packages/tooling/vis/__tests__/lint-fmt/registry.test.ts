import { describe, expect, it } from "vitest";

import type { AdapterId, AdapterKind, ToolAdapter, ToolPresence } from "../../src/lint-fmt/config-types";
import { adaptersByKind, registerAdapters, routeFilesByExtension } from "../../src/lint-fmt/registry";

const stubAdapter = (id: AdapterId, kind: AdapterKind, extensions: string[]): ToolAdapter => {
    return {
        argsCheck: () => [],
        argsFix: () => [],
        bin: () => ["pnpm", "exec", id],
        cacheKey: () => "stub",
        detect: () => undefined,
        extensions,
        id,
        kind,
        parse: () => [],
    };
};

const presence = (id: AdapterId): ToolPresence => ({ adapter: id, declared: true, root: "/repo" });

describe("registerAdapters", () => {
    it("orders adapters by static precedence", () => {
        expect.assertions(1);

        const ordered = registerAdapters([
            stubAdapter("prettier", "fmt", ["ts"]),
            stubAdapter("eslint", "lint", ["ts"]),
            stubAdapter("oxlint", "lint", ["ts"]),
        ]);

        expect(ordered.map((adapter) => adapter.id)).toStrictEqual(["oxlint", "eslint", "prettier"]);
    });

    it("appends unknown adapters at the end so future adapters are not dropped", () => {
        expect.assertions(1);

        const phantom = stubAdapter("biome" as AdapterId, "both", []);
        const ordered = registerAdapters([phantom, stubAdapter("eslint", "lint", ["ts"])]);

        expect(ordered.map((adapter) => adapter.id)).toStrictEqual(["biome", "eslint"]);
    });
});

describe("adaptersByKind", () => {
    it("filters by kind and matches `both`", () => {
        expect.assertions(1);

        const eslint = stubAdapter("eslint", "lint", ["ts"]);
        const prettier = stubAdapter("prettier", "fmt", ["ts"]);
        const biome = stubAdapter("biome", "both", ["ts"]);

        const detected = new Map<AdapterId, ToolPresence>([
            ["eslint", presence("eslint")],
            ["prettier", presence("prettier")],
            ["biome", presence("biome")],
        ]);

        const lintEligible = adaptersByKind(detected, [eslint, prettier, biome], "lint");

        expect(lintEligible.map((entry) => entry.adapter.id)).toStrictEqual(["eslint", "biome"]);
    });

    it("skips adapters that did not detect a presence", () => {
        expect.assertions(1);

        const eslint = stubAdapter("eslint", "lint", ["ts"]);
        const detected = new Map<AdapterId, ToolPresence>();

        expect(adaptersByKind(detected, [eslint], "lint")).toHaveLength(0);
    });
});

describe("routeFilesByExtension", () => {
    it("groups files by the first adapter that claims their extension", () => {
        expect.assertions(2);

        const prettier = stubAdapter("prettier", "fmt", ["ts", "md"]);
        const dprint = stubAdapter("dprint", "fmt", ["md"]);

        const grouped = routeFilesByExtension(
            ["a.ts", "b.md", "c.unknown"],
            [
                { adapter: prettier, presence: presence("prettier") },
                { adapter: dprint, presence: presence("dprint") },
            ],
        );

        expect(grouped.get("prettier")).toStrictEqual(["a.ts", "b.md"]);
        expect(grouped.get("dprint")).toBeUndefined();
    });

    it("respects extension overrides when the targeted adapter is detected", () => {
        expect.assertions(2);

        const prettier = stubAdapter("prettier", "fmt", ["ts", "md"]);
        const dprint = stubAdapter("dprint", "fmt", ["md"]);

        const grouped = routeFilesByExtension(
            ["a.md", "b.ts"],
            [
                { adapter: prettier, presence: presence("prettier") },
                { adapter: dprint, presence: presence("dprint") },
            ],
            { md: "dprint" },
        );

        expect(grouped.get("dprint")).toStrictEqual(["a.md"]);
        expect(grouped.get("prettier")).toStrictEqual(["b.ts"]);
    });

    it("drops files whose extension no adapter claims", () => {
        expect.assertions(1);

        const prettier = stubAdapter("prettier", "fmt", ["ts"]);
        const grouped = routeFilesByExtension(["x.unknown"], [{ adapter: prettier, presence: presence("prettier") }]);

        expect(grouped.size).toBe(0);
    });
});
