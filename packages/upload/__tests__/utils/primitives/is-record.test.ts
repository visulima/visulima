import { describe, expect, it } from "vitest";

import isRecord from "../../../src/utils/primitives/is-record";

describe("utils", () => {
    describe("primitives", () => {
        describe("is-record", () => {
            it("should be a record", () => {
                expect(isRecord({})).toBe(true);
            });

            it("should not be a record", () => {
                expect(isRecord([])).toBe(false);
            });
        });
    });
});
