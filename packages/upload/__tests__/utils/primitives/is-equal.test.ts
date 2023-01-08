import { describe, expect, it } from "vitest";

import isEqual from "../../../src/utils/primitives/is-equal";

describe("utils", () => {
    describe("primitives", () => {
        describe("is-equal", () => {
            it("should be equal", () => {
                expect(isEqual({ a: "test" }, { a: "test" })).toBe(true);
            });

            it("should not be equal", () => {
                expect(isEqual({ a: "test" }, { a: "test2" })).toBe(false);
            });
        });
    });
});
