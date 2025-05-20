import { describe, expect, it } from "vitest";

import { ALT_SCREEN_OFF, ALT_SCREEN_ON, alternativeScreenOff, alternativeScreenOn } from "../../src/alternative-screen";
import { CSI } from "../../src/constants";

describe("alternative-screen utilities", () => {
    const expectedOn = CSI + "?1049h";
    const expectedOff = CSI + "?1049l";

    describe("constants", () => {
        it("aLT_SCREEN_ON should be correct", () => {
            expect(ALT_SCREEN_ON).toBe(expectedOn);
        });
        it("aLT_SCREEN_OFF should be correct", () => {
            expect(ALT_SCREEN_OFF).toBe(expectedOff);
        });
    });

    describe("functions", () => {
        it("alternativeScreenOn() should return ALT_SCREEN_ON", () => {
            expect(alternativeScreenOn()).toBe(expectedOn);
        });
        it("alternativeScreenOff() should return ALT_SCREEN_OFF", () => {
            expect(alternativeScreenOff()).toBe(expectedOff);
        });
    });
});
