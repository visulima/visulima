import { describe, expect, it } from "vitest";

import { CSI } from "../../src/constants";
import { bracketedPasteEnd, bracketedPasteStart, wrapBracketedPaste } from "../../src/paste";

describe("bracketed paste markers", () => {
    it("should emit the start marker", () => {
        expect.assertions(1);
        expect(bracketedPasteStart).toBe(`${CSI}200~`);
    });

    it("should emit the end marker", () => {
        expect.assertions(1);
        expect(bracketedPasteEnd).toBe(`${CSI}201~`);
    });

    it("should wrap text in both markers", () => {
        expect.assertions(1);
        expect(wrapBracketedPaste("hello")).toBe(`${CSI}200~hello${CSI}201~`);
    });
});
