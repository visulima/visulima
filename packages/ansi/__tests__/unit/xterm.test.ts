import { describe, expect, it } from "vitest";

import { CSI } from "../../src/constants";
import {
    disableModifyOtherKeys,
    enableModifyOtherKeys1,
    enableModifyOtherKeys2,
    keyModifierOptions,
    modifyOtherKeys,
    queryKeyModifierOptions,
    queryModifyOtherKeys,
    requestModifyOtherKeys,
    resetKeyModifierOptions,
    resetModifyOtherKeys,
    setKeyModifierOptions,
    setModifyOtherKeys1,
    setModifyOtherKeys2,
    XTMODKEYS,
    XTQMODKEYS,
} from "../../src/xterm";

describe("xTerm Key Modifier Options (XTMODKEYS)", () => {
    describe("keyModifierOptions", () => {
        it("should set a resource with a value", () => {
            expect(keyModifierOptions(1, 2)).toBe(`${CSI}>1;2m`);
        });

        it("should set a resource with value 0", () => {
            expect(keyModifierOptions(1, 0)).toBe(`${CSI}>1;0m`);
        });

        it("should reset a resource when value is undefined", () => {
            expect(keyModifierOptions(1)).toBe(`${CSI}>1m`);
        });

        it("should handle resource 0", () => {
            expect(keyModifierOptions(0, 1)).toBe(`${CSI}>0;1m`);
            expect(keyModifierOptions(0)).toBe(`${CSI}>0m`);
        });

        it("should return empty string for negative resource", () => {
            expect(keyModifierOptions(-1, 1)).toBe("");
            expect(keyModifierOptions(-1)).toBe("");
        });
    });

    it("xTMODKEYS alias should work", () => {
        expect(XTMODKEYS(1, 2)).toBe(keyModifierOptions(1, 2));
        expect(XTMODKEYS(1)).toBe(keyModifierOptions(1));
    });

    it("setKeyModifierOptions alias should work", () => {
        expect(setKeyModifierOptions(1, 2)).toBe(keyModifierOptions(1, 2));
    });

    it("resetKeyModifierOptions alias should work", () => {
        expect(resetKeyModifierOptions(1)).toBe(keyModifierOptions(1));
    });
});

describe("query XTerm Key Modifier Options (XTQMODKEYS)", () => {
    describe("queryKeyModifierOptions", () => {
        it("should query a resource", () => {
            expect(queryKeyModifierOptions(1)).toBe(`${CSI}?1m`);
        });

        it("should query resource 0", () => {
            expect(queryKeyModifierOptions(0)).toBe(`${CSI}?0m`);
        });

        it("should return empty string for negative resource", () => {
            expect(queryKeyModifierOptions(-1)).toBe("");
        });
    });

    it("xTQMODKEYS alias should work", () => {
        expect(XTQMODKEYS(1)).toBe(queryKeyModifierOptions(1));
    });
});

describe("modify Other Keys (Resource 4)", () => {
    it("setModifyOtherKeys1 should be correct", () => {
        expect(setModifyOtherKeys1).toBe(`${CSI}>4;1m`);
    });

    it("setModifyOtherKeys2 should be correct", () => {
        expect(setModifyOtherKeys2).toBe(`${CSI}>4;2m`);
    });

    it("resetModifyOtherKeys should be correct", () => {
        expect(resetModifyOtherKeys).toBe(`${CSI}>4m`);
    });

    it("queryModifyOtherKeys should be correct", () => {
        expect(queryModifyOtherKeys).toBe(`${CSI}?4m`);
    });

    // Deprecated items
    describe("deprecated Modify Other Keys", () => {
        it("modifyOtherKeys(0) should disable (set value to 0)", () => {
            expect(modifyOtherKeys(0)).toBe(`${CSI}>4;0m`);
        });

        it("modifyOtherKeys(1) should enable mode 1", () => {
            expect(modifyOtherKeys(1)).toBe(`${CSI}>4;1m`);
        });

        it("modifyOtherKeys(2) should enable mode 2", () => {
            expect(modifyOtherKeys(2)).toBe(`${CSI}>4;2m`);
        });

        it("disableModifyOtherKeys constant should be correct", () => {
            expect(disableModifyOtherKeys).toBe(`${CSI}>4;0m`);
        });

        it("enableModifyOtherKeys1 constant should be correct and match setModifyOtherKeys1", () => {
            expect(enableModifyOtherKeys1).toBe(`${CSI}>4;1m`);
            expect(enableModifyOtherKeys1).toBe(setModifyOtherKeys1);
        });

        it("enableModifyOtherKeys2 constant should be correct and match setModifyOtherKeys2", () => {
            expect(enableModifyOtherKeys2).toBe(`${CSI}>4;2m`);
            expect(enableModifyOtherKeys2).toBe(setModifyOtherKeys2);
        });

        it("requestModifyOtherKeys constant should be correct and match queryModifyOtherKeys", () => {
            expect(requestModifyOtherKeys).toBe(`${CSI}?4m`);
            expect(requestModifyOtherKeys).toBe(queryModifyOtherKeys);
        });
    });
});
