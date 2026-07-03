import { describe, expect, it } from "vitest";

import { CSI } from "../../src/constants";
import { BLUR, FOCUS, focusInEvent, focusOutEvent } from "../../src/focus";

describe("focus event sequences", () => {
    it("should emit the focus-in event", () => {
        expect.assertions(2);
        expect(FOCUS).toBe(`${CSI}I`);
        expect(focusInEvent).toBe(FOCUS);
    });

    it("should emit the focus-out (blur) event", () => {
        expect.assertions(2);
        expect(BLUR).toBe(`${CSI}O`);
        expect(focusOutEvent).toBe(BLUR);
    });
});
