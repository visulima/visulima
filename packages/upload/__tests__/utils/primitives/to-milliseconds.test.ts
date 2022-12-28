import { describe, expect, it } from "vitest";

import toMilliseconds from "../../../src/utils/primitives/to-milliseconds";

describe("utils", () => {
    describe("primitives", () => {
        describe("to-milliseconds", () => {
            it("should return milliseconds", () => {
                expect(toMilliseconds("1m")).toBe(60_000);
            });

            it("should return given number", () => {
                expect(toMilliseconds(1)).toBe(1);
            });

            it("should return null", () => {
                expect(toMilliseconds()).toBeNull();
            });
        });
    });
});
