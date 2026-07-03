import { describe, expect, it } from "vitest";

import { extractLicenseChoice, normalizeSpdxId } from "../../src/sbom/license";

describe(normalizeSpdxId, () => {
    it("should return the canonical id for exact-match SPDX identifiers", () => {
        expect.assertions(2);

        expect(normalizeSpdxId("MIT")).toBe("MIT");
        expect(normalizeSpdxId("Apache-2.0")).toBe("Apache-2.0");
    });

    it("should resolve case-insensitive matches to the canonical spelling", () => {
        expect.assertions(2);

        expect(normalizeSpdxId("mit")).toBe("MIT");
        expect(normalizeSpdxId("apache-2.0")).toBe("Apache-2.0");
    });

    it("should map common aliases to canonical SPDX identifiers", () => {
        expect.assertions(2);

        expect(normalizeSpdxId("apache2")).toBe("Apache-2.0");
        expect(normalizeSpdxId("BSD")).toBe("BSD-3-Clause");
    });

    it("should return undefined for empty or unknown strings", () => {
        expect.assertions(2);

        expect(normalizeSpdxId("")).toBeUndefined();
        expect(normalizeSpdxId("Totally-Made-Up-1.0")).toBeUndefined();
    });
});

describe(extractLicenseChoice, () => {
    it("should extract a string-form licence as an SPDX id", () => {
        expect.assertions(1);

        expect(extractLicenseChoice({ license: "MIT" })).toStrictEqual([{ license: { id: "MIT" } }]);
    });

    it("should treat SPDX expressions as expressions", () => {
        expect.assertions(1);

        expect(extractLicenseChoice({ license: "(MIT OR Apache-2.0)" })).toStrictEqual([{ expression: "(MIT OR Apache-2.0)" }]);
    });

    it("should handle the legacy `license: { type }` object form", () => {
        expect.assertions(1);

        expect(extractLicenseChoice({ license: { type: "Apache-2.0" } })).toStrictEqual([{ license: { id: "Apache-2.0" } }]);
    });

    it("should handle the legacy `licenses: []` array form", () => {
        expect.assertions(1);

        expect(extractLicenseChoice({ licenses: [{ type: "ISC" }] })).toStrictEqual([{ license: { id: "ISC" } }]);
    });

    it("should fall back to a named licence when the SPDX id is unknown", () => {
        expect.assertions(1);

        expect(extractLicenseChoice({ license: "Proprietary" })).toStrictEqual([{ license: { name: "Proprietary" } }]);
    });

    it("should return undefined when no licence field is present", () => {
        expect.assertions(1);

        expect(extractLicenseChoice({})).toBeUndefined();
    });
});
