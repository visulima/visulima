import { describe, expect, it } from "vitest";

import { CSI } from "../../src/constants";
import {
    keyModifierOptions,
    queryKeyModifierOptions,
    queryModifyOtherKeys,
    resetKeyModifierOptions,
    resetModifyOtherKeys,
    setKeyModifierOptions,
    setModifyOtherKeys1,
    setModifyOtherKeys2,
    XTMODKEYS,
    XTQMODKEYS,
} from "../../src/xterm";

describe("xTerm Key Modifier Options (XTMODKEYS)", () => {
    // eslint-disable-next-line vitest/prefer-describe-function-title
    describe("keyModifierOptions", () => {
        it("should set a resource with a value", () => {
            expect.assertions(1);

            expect(keyModifierOptions(1, 2)).toBe(`${CSI}>1;2m`);
        });

        it("should set a resource with value 0", () => {
            expect.assertions(1);

            expect(keyModifierOptions(1, 0)).toBe(`${CSI}>1;0m`);
        });

        it("should reset a resource when value is undefined", () => {
            expect.assertions(1);

            expect(keyModifierOptions(1)).toBe(`${CSI}>1m`);
        });

        it("should handle resource 0", () => {
            expect.assertions(2);

            expect(keyModifierOptions(0, 1)).toBe(`${CSI}>0;1m`);
            expect(keyModifierOptions(0)).toBe(`${CSI}>0m`);
        });

        it("should return empty string for negative resource", () => {
            expect.assertions(2);

            expect(keyModifierOptions(-1, 1)).toBe("");
            expect(keyModifierOptions(-1)).toBe("");
        });
    });

    it("xTMODKEYS alias should work", () => {
        expect.assertions(2);

        expect(XTMODKEYS(1, 2)).toBe(keyModifierOptions(1, 2));
        expect(XTMODKEYS(1)).toBe(keyModifierOptions(1));
    });

    it("setKeyModifierOptions alias should work", () => {
        expect.assertions(1);

        expect(setKeyModifierOptions(1, 2)).toBe(keyModifierOptions(1, 2));
    });

    it("resetKeyModifierOptions alias should work", () => {
        expect.assertions(1);

        expect(resetKeyModifierOptions(1)).toBe(keyModifierOptions(1));
    });
});

describe("query XTerm Key Modifier Options (XTQMODKEYS)", () => {
    // eslint-disable-next-line vitest/prefer-describe-function-title
    describe("queryKeyModifierOptions", () => {
        it("should query a resource", () => {
            expect.assertions(1);

            expect(queryKeyModifierOptions(1)).toBe(`${CSI}?1m`);
        });

        it("should query resource 0", () => {
            expect.assertions(1);

            expect(queryKeyModifierOptions(0)).toBe(`${CSI}?0m`);
        });

        it("should return empty string for negative resource", () => {
            expect.assertions(1);

            expect(queryKeyModifierOptions(-1)).toBe("");
        });
    });

    it("xTQMODKEYS alias should work", () => {
        expect.assertions(1);

        expect(XTQMODKEYS(1)).toBe(queryKeyModifierOptions(1));
    });
});

describe("modify Other Keys (Resource 4)", () => {
    it("setModifyOtherKeys1 should be correct", () => {
        expect.assertions(1);

        expect(setModifyOtherKeys1).toBe(`${CSI}>4;1m`);
    });

    it("setModifyOtherKeys2 should be correct", () => {
        expect.assertions(1);

        expect(setModifyOtherKeys2).toBe(`${CSI}>4;2m`);
    });

    it("resetModifyOtherKeys should be correct", () => {
        expect.assertions(1);

        expect(resetModifyOtherKeys).toBe(`${CSI}>4m`);
    });

    it("queryModifyOtherKeys should be correct", () => {
        expect.assertions(1);

        expect(queryModifyOtherKeys).toBe(`${CSI}?4m`);
    });
});
