import { describe, expect, it } from "vitest";

import { hasEmptyProperty } from "../../src/swagger-jsdoc/utils";

describe("Utilities module", () => {
    describe("hasEmptyProperty", () => {
        it("identifies object with an empty object or array as property", () => {
            const invalidA = { foo: {} };
            const invalidB = { foo: [] };
            const validA = { foo: { bar: "baz" } };
            const validB = { foo: ["¯_(ツ)_/¯"] };
            const validC = { foo: "¯_(ツ)_/¯" };

            expect(hasEmptyProperty(invalidA)).toBe(true);
            expect(hasEmptyProperty(invalidB)).toBe(true);
            expect(hasEmptyProperty(validA)).toBe(false);
            expect(hasEmptyProperty(validB)).toBe(false);
            expect(hasEmptyProperty(validC)).toBe(false);
        });
    });
});
