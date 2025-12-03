import { describe, expect, it } from "vitest";

import isRecord from "../../../src/utils/primitives/is-record";

describe("utils", () => {
    describe("primitives", () => {
        describe(isRecord, () => {
            it("should return true for plain objects", () => {
                expect.assertions(1);

                expect(isRecord({})).toBe(true);
            });

            it("should return false for arrays", () => {
                expect.assertions(1);

                expect(isRecord([])).toBe(false);
            });
        });
    });
});
