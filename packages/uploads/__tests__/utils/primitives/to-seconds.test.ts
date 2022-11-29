import { describe, expect, it } from "vitest";

import toSeconds from "../../../src/utils/primitives/to-seconds";

describe("utils", () => {
    describe("primitives", () => {
        describe("to-seconds", () => {
            it("should return seconds", () => {
                expect(toSeconds("1m")).toBe(60);
            });

            it("should return given number", () => {
                expect(toSeconds(1)).toBe(1);
            });
        });
    });
});
