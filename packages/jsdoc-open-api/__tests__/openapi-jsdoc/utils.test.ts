import { describe, expect, it } from "vitest";

import { hasEmptyProperty } from "../../src/openapi-jsdoc/utils";

describe("utilities module", () => {
    describe("hasEmptyProperty", () => {
        it("identifies object with an empty object or array as property", () => {
            expect.assertions(5);

            const invalidA = { foo: {} };
            const invalidB = { foo: [] };
            const validA = { foo: { bar: "baz" } };
            const validB = { foo: ["¯_(ツ)_/¯"] };
            const validC = { foo: "¯_(ツ)_/¯" };

            expect(hasEmptyProperty(invalidA)).toBeTruthy();
            expect(hasEmptyProperty(invalidB)).toBeTruthy();
            expect(hasEmptyProperty(validA)).toBeFalsy();
            expect(hasEmptyProperty(validB)).toBeFalsy();
            expect(hasEmptyProperty(validC)).toBeFalsy();
        });
    });
});
