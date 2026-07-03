/* eslint-disable import/no-extraneous-dependencies */
import { bench, describe } from "vitest";

import { applyColorMatrix, COLOR_BLINDNESS_SIMULATION, hexToRgb, rgbToHex, transformHexColor } from "../src/ink/color-matrix";

describe("Color Matrix Transforms", () => {
    bench("applyColorMatrix (single RGB)", () => {
        applyColorMatrix(255, 128, 64, COLOR_BLINDNESS_SIMULATION.protanopia);
    });

    bench("applyColorMatrix (all 4 simulations)", () => {
        applyColorMatrix(255, 128, 64, COLOR_BLINDNESS_SIMULATION.protanopia);
        applyColorMatrix(255, 128, 64, COLOR_BLINDNESS_SIMULATION.deuteranopia);
        applyColorMatrix(255, 128, 64, COLOR_BLINDNESS_SIMULATION.tritanopia);
        applyColorMatrix(255, 128, 64, COLOR_BLINDNESS_SIMULATION.achromatopsia);
    });

    bench("transformHexColor (hex → matrix → hex)", () => {
        transformHexColor("#ff8040", COLOR_BLINDNESS_SIMULATION.protanopia);
    });

    bench("hexToRgb (6-digit)", () => {
        hexToRgb("#ff8040");
    });

    bench("hexToRgb (3-digit)", () => {
        hexToRgb("#f80");
    });

    bench("rgbToHex", () => {
        rgbToHex(255, 128, 64);
    });

    bench("transform 256 colors through protanopia", () => {
        for (let i = 0; i < 256; i++) {
            applyColorMatrix(i, 255 - i, (i * 7) % 256, COLOR_BLINDNESS_SIMULATION.protanopia);
        }
    });
});
