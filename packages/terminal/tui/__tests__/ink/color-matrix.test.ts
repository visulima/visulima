import { describe, expect, it } from "vitest";

import {
    applyColorMatrix,
    COLOR_BLINDNESS_COMPENSATION,
    COLOR_BLINDNESS_SIMULATION,
    hexToRgb,
    IDENTITY_MATRIX,
    rgbToHex,
    transformHexColor,
} from "../../src/ink/color-matrix";

describe("color-matrix", () => {
    describe(applyColorMatrix, () => {
        it("identity matrix should return same colors", () => {
            expect.assertions(1);

            expect(applyColorMatrix(128, 64, 32, IDENTITY_MATRIX)).toEqual([128, 64, 32]);
        });

        it("should clamp values to 0-255", () => {
            expect.assertions(3);

            const matrix = [
                [2, 0, 0],
                [0, 2, 0],
                [0, 0, 2],
            ] as const;
            const [r, g, b] = applyColorMatrix(200, 200, 200, matrix);

            expect(r).toBeLessThanOrEqual(255);
            expect(g).toBeLessThanOrEqual(255);
            expect(b).toBeLessThanOrEqual(255);
        });

        it("should handle zero input", () => {
            expect.assertions(1);

            expect(applyColorMatrix(0, 0, 0, IDENTITY_MATRIX)).toEqual([0, 0, 0]);
        });

        it("achromatopsia should produce grayscale", () => {
            expect.assertions(4);

            const [r, g, b] = applyColorMatrix(255, 0, 0, COLOR_BLINDNESS_SIMULATION.achromatopsia);

            // For pure red, all channels should be the same (grayscale)
            expect(r).toBe(g);
            expect(g).toBe(b);
            expect(r).toBeGreaterThan(0);
            expect(r).toBeLessThan(255);
        });

        it("protanopia simulation should reduce red perception", () => {
            expect.assertions(1);

            const [r] = applyColorMatrix(255, 0, 0, COLOR_BLINDNESS_SIMULATION.protanopia);

            // Red should be significantly reduced for a protanope
            expect(r).toBeLessThan(200);
        });

        it("deuteranopia simulation should reduce green perception", () => {
            expect.assertions(1);

            const [, g] = applyColorMatrix(0, 255, 0, COLOR_BLINDNESS_SIMULATION.deuteranopia);

            // Green channel should be reduced
            expect(g).toBeLessThan(200);
        });
    });

    describe(hexToRgb, () => {
        it("should parse 6-digit hex with hash", () => {
            expect.assertions(1);

            expect(hexToRgb("#ff8040")).toEqual([255, 128, 64]);
        });

        it("should parse 6-digit hex without hash", () => {
            expect.assertions(1);

            expect(hexToRgb("ff8040")).toEqual([255, 128, 64]);
        });

        it("should return null for invalid input", () => {
            expect.assertions(3);

            expect(hexToRgb("invalid")).toBeNull();
            expect(hexToRgb("#ff")).toBeNull();
            expect(hexToRgb("")).toBeNull();
        });
    });

    describe(rgbToHex, () => {
        it("should produce correct hex string", () => {
            expect.assertions(1);

            expect(rgbToHex(255, 128, 64)).toBe("#ff8040");
        });

        it("should pad single-digit values", () => {
            expect.assertions(1);

            expect(rgbToHex(0, 0, 0)).toBe("#000000");
        });

        it("should clamp out-of-range values", () => {
            expect.assertions(1);

            expect(rgbToHex(300, -10, 128)).toBe("#ff0080");
        });
    });

    describe(transformHexColor, () => {
        it("should transform hex through identity matrix", () => {
            expect.assertions(1);

            expect(transformHexColor("#ff8040", IDENTITY_MATRIX)).toBe("#ff8040");
        });

        it("should return original for invalid hex", () => {
            expect.assertions(1);

            expect(transformHexColor("invalid", IDENTITY_MATRIX)).toBe("invalid");
        });

        it("should produce grayscale through achromatopsia", () => {
            expect.assertions(3);

            const result = transformHexColor("#ff0000", COLOR_BLINDNESS_SIMULATION.achromatopsia);
            const rgb = hexToRgb(result);

            expect(rgb).not.toBeNull();
            // All channels should be approximately equal (grayscale)
            expect(Math.abs(rgb![0] - rgb![1])).toBeLessThan(2);
            expect(Math.abs(rgb![1] - rgb![2])).toBeLessThan(2);
        });
    });

    describe("compensation matrices", () => {
        it("should have protanopia compensation", () => {
            expect.assertions(2);

            expect(COLOR_BLINDNESS_COMPENSATION.protanopia).toBeDefined();
            expect(COLOR_BLINDNESS_COMPENSATION.protanopia).toHaveLength(3);
        });

        it("should have deuteranopia compensation", () => {
            expect.assertions(1);

            expect(COLOR_BLINDNESS_COMPENSATION.deuteranopia).toBeDefined();
        });

        it("should have tritanopia compensation", () => {
            expect.assertions(1);

            expect(COLOR_BLINDNESS_COMPENSATION.tritanopia).toBeDefined();
        });

        it("compensation should produce different output than simulation", () => {
            expect.assertions(1);

            const sim = transformHexColor("#ff4444", COLOR_BLINDNESS_SIMULATION.protanopia);
            const comp = transformHexColor("#ff4444", COLOR_BLINDNESS_COMPENSATION.protanopia);

            expect(sim).not.toBe(comp);
        });
    });
});
