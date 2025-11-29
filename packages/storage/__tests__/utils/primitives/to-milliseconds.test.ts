import { describe, expect, it } from "vitest";

import toMilliseconds from "../../../src/utils/primitives/to-milliseconds";

describe("utils", () => {
    describe("primitives", () => {
        describe(toMilliseconds, () => {
            it("should convert duration string to milliseconds", () => {
                expect.assertions(1);

                expect(toMilliseconds("1m")).toBe(60_000);
            });

            it("should return the number as-is when given a number", () => {
                expect.assertions(1);

                expect(toMilliseconds(1)).toBe(1);
            });

            it("should return undefined for undefined input", () => {
                expect.assertions(1);

                expect(toMilliseconds(undefined)).toBeUndefined();
            });
        });
    });
});
