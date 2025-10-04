import { describe, expect, it } from "vitest";

import getLastOne from "../../../src/utils/primitives/get-last-one";

describe("utils", () => {
    describe("primitives", () => {
        describe("get-last-one", () => {
            it("should return the last one", () => {
                expect(getLastOne([1, 2, 3])).toBe(3);
            });
        });
    });
});
