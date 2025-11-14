import { describe, expect, it } from "vitest";

import getLastOne from "../../../src/utils/primitives/get-last-one";

describe("utils", () => {
    describe("primitives", () => {
        describe(getLastOne, () => {
            it("should return the last element of an array", () => {
                expect.assertions(1);

                expect(getLastOne([1, 2, 3])).toBe(3);
            });
        });
    });
});
