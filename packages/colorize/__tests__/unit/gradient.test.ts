import { describe, expect, it } from "vitest";

import gradient from "../../src/gradient";

describe("gradient", () => {
    it.only("should generate a gradient for a string", () => {
        expect.assertions(1);
console.log(gradient(["green", "red"])("Hello, World!"))
        expect(gradient(["blue", "white", "red"])("Hello, World!")).toBe("");
    });

    it("should reverse gradient", () => {
        expect.assertions(1);
    });

    it("should loop a gradient", () => {
        expect.assertions(5);
    });
});
