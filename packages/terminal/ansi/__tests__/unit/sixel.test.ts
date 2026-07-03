import { describe, expect, it } from "vitest";

import { DCS, ST } from "../../src/constants";
import sixelGraphics from "../../src/sixel";

describe("sixel graphics wrapper", () => {
    it("should frame a payload with all parameters", () => {
        expect.assertions(1);
        expect(sixelGraphics(1, 0, 8, "#0;2;0;0;0")).toBe(`${DCS}1;0;8q#0;2;0;0;0${ST}`);
    });

    it("should omit p1 and p2 when negative", () => {
        expect.assertions(1);
        expect(sixelGraphics(-1, -1, 0, "data")).toBe(`${DCS};qdata${ST}`);
    });

    it("should omit the grid size when p3 is zero", () => {
        expect.assertions(1);
        expect(sixelGraphics(0, 1, 0, "data")).toBe(`${DCS}0;1qdata${ST}`);
    });
});
