import { describe, expect, it } from "vitest";

import mapValues from "../../../src/utils/primitives/map-values";

describe("utils", () => {
    describe("primitives", () => {
        describe(mapValues, () => {
            it("should transform object values using a mapper function", () => {
                expect.assertions(1);

                expect(mapValues({ a: "test" }, (value) => `${value}2`)).toEqual({ a: "test2" });
            });
        });
    });
});
