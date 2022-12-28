import { describe, expect, it } from "vitest";

import mapValues from "../../../src/utils/primitives/map-values";

describe("utils", () => {
    describe("primitives", () => {
        describe("map-values", () => {
            it("should map values", () => {
                expect(mapValues({ a: "test" }, (value) => `${value}2`)).toEqual({ a: "test2" });
            });
        });
    });
});
