import { describe, expect, it } from "vitest";

import { CSI, ESC, SEP } from "../../src/constants";
import {
    clearTabStop,
    deleteCharacter,
    deleteLine,
    insertCharacter,
    insertLine,
    repeatPreviousCharacter,
    requestPresentationStateReport,
    setLeftRightMargins,
    setTopBottomMargins,
} from "../../src/screen";

describe("screen manipulation", () => {
    describe("insertLine", () => {
        it("should insert 1 line by default", () => {
            expect.assertions(1);
            return expect(insertLine()).toBe(CSI + "L");
        });
        it("should insert 1 line", () => {
            expect.assertions(1);
            return expect(insertLine(1)).toBe(CSI + "L");
        });
        it("should insert N lines", () => {
            expect.assertions(1);
            return expect(insertLine(5)).toBe(CSI + "5L");
        });
    });

    describe("deleteLine", () => {
        it("should delete 1 line by default", () => {
            expect.assertions(1);
            return expect(deleteLine()).toBe(CSI + "M");
        });
        it("should delete 1 line", () => {
            expect.assertions(1);
            return expect(deleteLine(1)).toBe(CSI + "M");
        });
        it("should delete N lines", () => {
            expect.assertions(1);
            return expect(deleteLine(5)).toBe(CSI + "5M");
        });
    });

    describe("setTopBottomMargins", () => {
        it("should set top and bottom margins", () => {
            expect.assertions(1);
            return expect(setTopBottomMargins(5, 10)).toBe(CSI + "5" + SEP + "10r");
        });
        it("should reset margins if no params", () => {
            expect.assertions(1);
            return expect(setTopBottomMargins()).toBe(CSI + SEP + "r");
        });
        it("should set top margin only", () => {
            expect.assertions(1);
            return expect(setTopBottomMargins(5)).toBe(CSI + "5" + SEP + "r");
        });
        it("should set bottom margin only", () => {
            expect.assertions(1);
            return expect(setTopBottomMargins(null, 10)).toBe(CSI + SEP + "10r");
        });
        it("should handle 0 or invalid params by omitting them", () => {
            expect.assertions(3);
            expect(setTopBottomMargins(0, 0)).toBe(CSI + SEP + "r");
            expect(setTopBottomMargins(-1, 20)).toBe(CSI + SEP + "20r");
            expect(setTopBottomMargins(10, -5)).toBe(CSI + "10" + SEP + "r");
        });
    });

    describe("setLeftRightMargins", () => {
        it("should set left and right margins", () => {
            expect.assertions(1);
            return expect(setLeftRightMargins(2, 78)).toBe(CSI + "2" + SEP + "78s");
        });
        it("should reset margins if no params", () => {
            expect.assertions(1);
            return expect(setLeftRightMargins()).toBe(CSI + SEP + "s");
        });
        it("should set left margin only", () => {
            expect.assertions(1);
            return expect(setLeftRightMargins(2)).toBe(CSI + "2" + SEP + "s");
        });
        it("should set right margin only", () => {
            expect.assertions(1);
            return expect(setLeftRightMargins(null, 78)).toBe(CSI + SEP + "78s");
        });
        it("should handle 0 or invalid params by omitting them", () => {
            expect.assertions(3);
            expect(setLeftRightMargins(0, 0)).toBe(CSI + SEP + "s");
            expect(setLeftRightMargins(-1, 70)).toBe(CSI + SEP + "70s");
            expect(setLeftRightMargins(5, -2)).toBe(CSI + "5" + SEP + "s");
        });
    });

    describe("insertCharacter", () => {
        it("should insert 1 char by default", () => {
            expect.assertions(1);
            return expect(insertCharacter()).toBe(CSI + "@");
        });
        it("should insert 1 char", () => {
            expect.assertions(1);
            return expect(insertCharacter(1)).toBe(CSI + "@");
        });
        it("should insert N chars", () => {
            expect.assertions(1);
            return expect(insertCharacter(7)).toBe(CSI + "7@");
        });
    });

    describe("deleteCharacter", () => {
        it("should delete 1 char by default", () => {
            expect.assertions(1);
            return expect(deleteCharacter()).toBe(CSI + "P");
        });
        it("should delete 1 char", () => {
            expect.assertions(1);
            return expect(deleteCharacter(1)).toBe(CSI + "P");
        });
        it("should delete N chars", () => {
            expect.assertions(1);
            return expect(deleteCharacter(9)).toBe(CSI + "9P");
        });
    });

    describe("clearTabStop", () => {
        it("should clear current tab stop by default", () => {
            expect.assertions(1);
            return expect(clearTabStop()).toBe(CSI + "0g");
        });
        it("should clear current tab stop for mode 0", () => {
            expect.assertions(1);
            return expect(clearTabStop(0)).toBe(CSI + "0g");
        });
        it("should clear all tab stops for mode 3", () => {
            expect.assertions(1);
            return expect(clearTabStop(3)).toBe(CSI + "3g");
        });
    });

    describe("requestPresentationStateReport", () => {
        it("should request text presentation state (mode 0)", () => {
            expect.assertions(1);
            return expect(requestPresentationStateReport(0)).toBe(CSI + "0$u");
        });
        it("should request SGR state (mode 1)", () => {
            expect.assertions(1);
            return expect(requestPresentationStateReport(1)).toBe(CSI + "1$u");
        });
        it("should request color palette state (mode 2)", () => {
            expect.assertions(1);
            return expect(requestPresentationStateReport(2)).toBe(CSI + "2$u");
        });
    });

    describe("repeatPreviousCharacter", () => {
        it("should repeat 1 time by default", () => {
            expect.assertions(1);
            return expect(repeatPreviousCharacter()).toBe(CSI + "b");
        });
        it("should repeat 1 time", () => {
            expect.assertions(1);
            return expect(repeatPreviousCharacter(1)).toBe(CSI + "b");
        });
        it("should repeat N times", () => {
            expect.assertions(1);
            return expect(repeatPreviousCharacter(12)).toBe(CSI + "12b");
        });
    });
});
