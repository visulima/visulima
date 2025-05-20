import { describe, expect,it } from "vitest";

import { ESC } from "../../src/constants";
import { RESET_INITIAL_STATE, RIS } from "../../src/reset";

describe("reset Sequences", () => {
    it("rESET_INITIAL_STATE should be correct", () => {
        expect(RESET_INITIAL_STATE).toBe(ESC + "c");
    });

    it("rIS should be an alias for RESET_INITIAL_STATE", () => {
        expect(RIS).toBe(RESET_INITIAL_STATE);
    });
});
