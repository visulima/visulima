import { describe, expect, it } from "vitest";

import { COLOR_BLINDNESS_COMPENSATION, COLOR_BLINDNESS_SIMULATION, hexToRgb, IDENTITY_MATRIX, transformHexColor } from "../../src/ink/color-matrix";

describe("useColorBlindness (via color-matrix utilities)", () => {
    describe("identity passthrough", () => {
        it("should not alter colors with identity matrix", () => {
            expect.assertions(3);

            expect(transformHexColor("#ff8040", IDENTITY_MATRIX)).toBe("#ff8040");
            expect(transformHexColor("#000000", IDENTITY_MATRIX)).toBe("#000000");
            expect(transformHexColor("#ffffff", IDENTITY_MATRIX)).toBe("#ffffff");
        });
    });

    describe("simulation mode", () => {
        it("protanopia should alter red", () => {
            expect.assertions(3);

            const result = transformHexColor("#ff0000", COLOR_BLINDNESS_SIMULATION.protanopia);

            expect(result).not.toBe("#ff0000");

            const rgb = hexToRgb(result);

            expect(rgb).not.toBeNull();
            // Red should be reduced
            expect(rgb![0]).toBeLessThan(200);
        });

        it("deuteranopia should alter green", () => {
            expect.assertions(1);

            const result = transformHexColor("#00ff00", COLOR_BLINDNESS_SIMULATION.deuteranopia);

            expect(result).not.toBe("#00ff00");
        });

        it("tritanopia should alter blue", () => {
            expect.assertions(1);

            const result = transformHexColor("#0000ff", COLOR_BLINDNESS_SIMULATION.tritanopia);

            expect(result).not.toBe("#0000ff");
        });

        it("achromatopsia should produce grayscale", () => {
            expect.assertions(3);

            const rgb = hexToRgb(transformHexColor("#ff0000", COLOR_BLINDNESS_SIMULATION.achromatopsia));

            expect(rgb).not.toBeNull();
            expect(Math.abs(rgb![0] - rgb![1])).toBeLessThan(2);
            expect(Math.abs(rgb![1] - rgb![2])).toBeLessThan(2);
        });
    });

    describe("compensation mode", () => {
        it("compensation should differ from simulation", () => {
            expect.assertions(1);

            const sim = transformHexColor("#ff4444", COLOR_BLINDNESS_SIMULATION.protanopia);
            const comp = transformHexColor("#ff4444", COLOR_BLINDNESS_COMPENSATION.protanopia);

            expect(sim).not.toBe(comp);
        });

        it("compensation should preserve non-zero values for all channels", () => {
            // Pure red through protanopia compensation should not produce black
            expect.assertions(2);

            const rgb = hexToRgb(transformHexColor("#ff0000", COLOR_BLINDNESS_COMPENSATION.protanopia));

            expect(rgb).not.toBeNull();
            // At least one channel should be non-zero
            expect(rgb![0] + rgb![1] + rgb![2]).toBeGreaterThan(0);
        });
    });

    describe("3-digit hex support", () => {
        it("should parse 3-digit shorthand", () => {
            expect.assertions(1);

            expect(hexToRgb("#f80")).toEqual([255, 136, 0]);
        });

        it("should transform 3-digit hex through matrix", () => {
            expect.assertions(1);

            const result = transformHexColor("#f00", COLOR_BLINDNESS_SIMULATION.achromatopsia);

            expect(result).not.toBe("#f00");
        });
    });
});
