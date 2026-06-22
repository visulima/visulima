import { describe, expect, it } from "vitest";

import { parseCatalogs, resolveCatalogRef, rewriteCatalogRefs } from "../../../src/release/core/catalog";
import { VisReleaseError } from "../../../src/release/errors";

describe(parseCatalogs, () => {
    it("returns empty for undefined input", () => {
        expect.hasAssertions();

        const result = parseCatalogs(undefined);

        expect(result).toStrictEqual({ default: {}, named: {} });
    });

    it("returns empty for empty string", () => {
        expect.hasAssertions();
        expect(parseCatalogs("")).toStrictEqual({ default: {}, named: {} });
    });

    it("parses default catalog", () => {
        expect.hasAssertions();

        const yaml = `catalog:\n  react: ^18.3.1\n  zod: ^3.22.0\n`;
        const result = parseCatalogs(yaml);

        expect(result.default).toStrictEqual({ react: "^18.3.1", zod: "^3.22.0" });
        expect(result.named).toStrictEqual({});
    });

    it("parses named catalogs", () => {
        expect.hasAssertions();

        const yaml = `catalogs:\n  dev:\n    eslint: ^9.0.0\n  test:\n    vitest: ^2.0.0\n`;
        const result = parseCatalogs(yaml);

        expect(result.default).toStrictEqual({});
        expect(result.named).toStrictEqual({
            dev: { eslint: "^9.0.0" },
            test: { vitest: "^2.0.0" },
        });
    });

    it("parses both default + named together", () => {
        expect.hasAssertions();

        const yaml = `catalog:\n  react: ^18.3.1\ncatalogs:\n  dev:\n    eslint: ^9.0.0\n`;
        const result = parseCatalogs(yaml);

        expect(result.default.react).toBe("^18.3.1");
        expect(result.named.dev?.eslint).toBe("^9.0.0");
    });

    it("ignores non-string values in catalog blocks", () => {
        expect.hasAssertions();

        const yaml = `catalog:\n  react: ^18.3.1\n  bad: 42\n`;
        const result = parseCatalogs(yaml);

        expect(result.default.react).toBe("^18.3.1");
        expect(result.default.bad).toBeUndefined();
    });

    it("throws on malformed YAML", () => {
        expect.hasAssertions();
        expect(() => parseCatalogs(": : :")).toThrow(/pnpm-workspace.yaml/);
    });
});

describe(resolveCatalogRef, () => {
    const catalogs = {
        default: { react: "^18.3.1" },
        named: { dev: { eslint: "^9.0.0" } },
    };

    it("returns non-catalog refs unchanged", () => {
        expect.hasAssertions();
        expect(resolveCatalogRef("^1.0.0", "any", catalogs)).toBe("^1.0.0");
    });

    it("resolves catalog: from default", () => {
        expect.hasAssertions();
        expect(resolveCatalogRef("catalog:", "react", catalogs)).toBe("^18.3.1");
    });

    it("resolves catalog:<name> from named block", () => {
        expect.hasAssertions();
        expect(resolveCatalogRef("catalog:dev", "eslint", catalogs)).toBe("^9.0.0");
    });

    it("returns undefined when package not in default catalog", () => {
        expect.hasAssertions();
        expect(resolveCatalogRef("catalog:", "absent", catalogs)).toBeUndefined();
    });

    it("returns undefined when named catalog doesn't exist", () => {
        expect.hasAssertions();
        expect(resolveCatalogRef("catalog:nonexistent", "anything", catalogs)).toBeUndefined();
    });
});

describe(rewriteCatalogRefs, () => {
    const catalogs = {
        default: { react: "^18.3.1" },
        named: { dev: { eslint: "^9.0.0" } },
    };

    it("rewrites catalog: refs across all dep kinds", () => {
        expect.hasAssertions();

        const manifest = {
            dependencies: { react: "catalog:" },
            devDependencies: { eslint: "catalog:dev" },
            name: "x",
            version: "1.0.0",
        };

        const result = rewriteCatalogRefs(manifest, catalogs);

        expect(result.dependencies?.react).toBe("^18.3.1");
        expect(result.devDependencies?.eslint).toBe("^9.0.0");
    });

    it("returns a new object — does not mutate input", () => {
        expect.hasAssertions();

        const manifest = {
            dependencies: { react: "catalog:" },
            name: "x",
            version: "1.0.0",
        };

        rewriteCatalogRefs(manifest, catalogs);

        expect(manifest.dependencies.react).toBe("catalog:");
    });

    it("leaves non-catalog deps alone", () => {
        expect.hasAssertions();

        const manifest = {
            dependencies: { lodash: "^4.0.0", react: "catalog:" },
            name: "x",
            version: "1.0.0",
        };

        const result = rewriteCatalogRefs(manifest, catalogs);

        expect(result.dependencies?.lodash).toBe("^4.0.0");
    });

    it("throws CONFIG_INVALID on unresolvable catalog ref", () => {
        expect.hasAssertions();

        const manifest = {
            dependencies: { absent: "catalog:" },
            name: "x",
            version: "1.0.0",
        };

        expect(() => rewriteCatalogRefs(manifest, catalogs)).toThrow(VisReleaseError);
        expect(() => rewriteCatalogRefs(manifest, catalogs)).toThrow(/Cannot resolve "catalog:"/);
    });
});
