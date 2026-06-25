import { describe, expect, it } from "vitest";

import { ESC } from "../../src/constants";
import { DECKPAM, DECKPNM, keypadApplicationMode, keypadNumericMode } from "../../src/keypad";

describe("keypad mode sequences", () => {
    it("should emit keypad application mode (DECKPAM)", () => {
        expect.assertions(2);
        expect(keypadApplicationMode).toBe(`${ESC}=`);
        expect(DECKPAM).toBe(keypadApplicationMode);
    });

    it("should emit keypad numeric mode (DECKPNM)", () => {
        expect.assertions(2);
        expect(keypadNumericMode).toBe(`${ESC}>`);
        expect(DECKPNM).toBe(keypadNumericMode);
    });
});
