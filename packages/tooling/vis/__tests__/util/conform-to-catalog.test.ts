import { describe, expect, it } from "vitest";

import { conformToCatalog } from "../../src/util/conform-to-catalog";

const buildCatalogs = (input: Record<string, Record<string, string>>): Map<string, Map<string, string>> => {
    const out = new Map<string, Map<string, string>>();

    for (const [key, deps] of Object.entries(input)) {
        out.set(key, new Map(Object.entries(deps)));
    }

    return out;
};

describe(conformToCatalog, () => {
    it("returns undefined when the dep is in no catalog and no sibling", () => {
        expect.assertions(1);

        const catalogs = buildCatalogs({
            default: { lodash: "^4.17.21" },
            "packages/web:dependencies": { lodash: "^4.17.21" },
        });

        expect(conformToCatalog("react", catalogs)).toBeUndefined();
    });

    it("resolves to `catalog:` when found in the default catalog", () => {
        expect.assertions(1);

        const catalogs = buildCatalogs({
            default: { react: "^18.2.0" },
        });

        expect(conformToCatalog("react", catalogs)).toStrictEqual({
            source: "default catalog",
            spec: "catalog:",
        });
    });

    it("resolves to `catalog:<name>` when found in a named catalog", () => {
        expect.assertions(1);

        const catalogs = buildCatalogs({
            react18: { react: "^18.2.0" },
        });

        expect(conformToCatalog("react", catalogs)).toStrictEqual({
            source: "catalog \"react18\"",
            spec: "catalog:react18",
        });
    });

    it("prefers the default catalog when a dep is in multiple catalogs", () => {
        expect.assertions(1);

        const catalogs = buildCatalogs({
            default: { react: "^19.0.0" },
            react18: { react: "^18.2.0" },
        });

        const result = conformToCatalog("react", catalogs);

        expect(result).toStrictEqual({
            candidates: ["default", "react18"],
            conflict: true,
            source: "default catalog (also in: catalog \"react18\")",
            spec: "catalog:",
        });
    });

    it("flags a conflict when only named catalogs disagree", () => {
        expect.assertions(2);

        const catalogs = buildCatalogs({
            "react-legacy": { react: "^17.0.0" },
            "react-modern": { react: "^19.0.0" },
        });

        const result = conformToCatalog("react", catalogs);

        expect(result?.conflict).toBe(true);
        expect(result?.candidates).toStrictEqual(["react-legacy", "react-modern"]);
    });

    it("falls back to a sibling version when no catalog has the dep", () => {
        expect.assertions(1);

        const catalogs = buildCatalogs({
            default: { other: "^1.0.0" },
            "packages/api:dependencies": { lodash: "^4.17.21" },
            "packages/web:dependencies": { lodash: "^4.17.21" },
        });

        expect(conformToCatalog("lodash", catalogs)).toStrictEqual({
            source: "siblings (2 pkgs on ^4.17.21)",
            spec: "^4.17.21",
        });
    });

    it("uses the singular form for a single sibling", () => {
        expect.assertions(1);

        const catalogs = buildCatalogs({
            "packages/api:dependencies": { lodash: "^4.17.21" },
        });

        expect(conformToCatalog("lodash", catalogs)).toStrictEqual({
            source: "siblings (1 pkg on ^4.17.21)",
            spec: "^4.17.21",
        });
    });

    it("picks the most-frequent sibling version and flags ambiguity", () => {
        expect.assertions(1);

        const catalogs = buildCatalogs({
            "packages/api:dependencies": { lodash: "^4.17.21" },
            "packages/cli:dependencies": { lodash: "^4.17.21" },
            "packages/old:dependencies": { lodash: "^3.10.0" },
            "packages/web:dependencies": { lodash: "^4.17.21" },
        });

        expect(conformToCatalog("lodash", catalogs)).toStrictEqual({
            candidates: ["^4.17.21", "^3.10.0"],
            conflict: true,
            source: "siblings (most common: ^4.17.21 ×3; conflicts: ^3.10.0 (×1))",
            spec: "^4.17.21",
        });
    });

    it("ignores composite keys when scanning catalogs (pass 1)", () => {
        // The composite-key dep would otherwise drown out the catalog hit.
        expect.assertions(1);

        const catalogs = buildCatalogs({
            default: { react: "^18.2.0" },
            "packages/web:dependencies": { react: "^17.0.0" },
        });

        expect(conformToCatalog("react", catalogs)).toStrictEqual({
            source: "default catalog",
            spec: "catalog:",
        });
    });
});
