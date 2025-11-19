import { describe, expect, it } from "vitest";

import toSeconds from "../../../src/utils/primitives/to-seconds";

describe("utils", () => {
    describe("primitives", () => {
        describe(toSeconds, () => {
            it("should convert duration string to seconds", () => {
                expect.assertions(1);

                expect(toSeconds("1m")).toBe(60);
            });

            it("should return the number as-is when given a number", () => {
                expect.assertions(1);

                expect(toSeconds(1)).toBe(1);
            });
        });
    });
});
