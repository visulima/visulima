import { describe, expect, it } from "vitest";

import { CONTINUATION_CELL_CODE } from "../../src/ink/ansi-to-cell";

describe("ansi-to-cell", () => {
    describe("CONTINUATION_CELL_CODE", () => {
        it("should be outside Unicode range", () => {
            expect(CONTINUATION_CELL_CODE).toBeGreaterThan(0x10_ff_ff);
        });
    });
});
