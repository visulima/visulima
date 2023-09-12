import { describe, expect, it } from "vitest";

import { hasEmptyProperty } from "../../src/long-syntax/utils";

describe("utilities module", () => {
    describe("hasEmptyProperty", () => {
        it("identifies object with an empty object or array as property", () => {
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
