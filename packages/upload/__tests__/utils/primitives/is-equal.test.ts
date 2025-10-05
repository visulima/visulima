import { describe, expect, it } from "vitest";

import isEqual from "../../../src/utils/primitives/is-equal";

describe("utils", () => {
    describe("primitives", () => {
        describe(isEqual, () => {
            it("should return true for equal objects", () => {
                expect.assertions(1);

                expect(isEqual({ a: "test" }, { a: "test" })).toBe(true);
            });

            it("should return false for different objects", () => {
                expect.assertions(1);

                expect(isEqual({ a: "test" }, { a: "test2" })).toBe(false);
            });
        });
    });
});
