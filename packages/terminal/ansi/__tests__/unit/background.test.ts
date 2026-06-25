import { describe, expect, it } from "vitest";

import {
    requestBackgroundColor,
    requestCursorColor,
    requestForegroundColor,
    resetBackgroundColor,
    resetCursorColor,
    resetForegroundColor,
    setBackgroundColor,
    setCursorColor,
    setForegroundColor,
} from "../../src/background";
import { BEL, OSC } from "../../src/constants";

describe("background/foreground/cursor color sequences", () => {
    it("should set the foreground color", () => {
        expect.assertions(1);
        expect(setForegroundColor("#ff0000")).toBe(`${OSC}10;#ff0000${BEL}`);
    });

    it("should request the foreground color", () => {
        expect.assertions(1);
        expect(requestForegroundColor).toBe(`${OSC}10;?${BEL}`);
    });

    it("should reset the foreground color", () => {
        expect.assertions(1);
        expect(resetForegroundColor).toBe(`${OSC}110${BEL}`);
    });

    it("should set the background color", () => {
        expect.assertions(1);
        expect(setBackgroundColor("rgb:00/00/00")).toBe(`${OSC}11;rgb:00/00/00${BEL}`);
    });

    it("should request the background color", () => {
        expect.assertions(1);
        expect(requestBackgroundColor).toBe(`${OSC}11;?${BEL}`);
    });

    it("should reset the background color", () => {
        expect.assertions(1);
        expect(resetBackgroundColor).toBe(`${OSC}111${BEL}`);
    });

    it("should set the cursor color", () => {
        expect.assertions(1);
        expect(setCursorColor("white")).toBe(`${OSC}12;white${BEL}`);
    });

    it("should request the cursor color", () => {
        expect.assertions(1);
        expect(requestCursorColor).toBe(`${OSC}12;?${BEL}`);
    });

    it("should reset the cursor color", () => {
        expect.assertions(1);
        expect(resetCursorColor).toBe(`${OSC}112${BEL}`);
    });

    it("should strip escape-sequence terminators from the color", () => {
        expect.assertions(1);
        expect(setForegroundColor("red\u001B]0;pwned\u0007")).toBe(`${OSC}10;red]0;pwned${BEL}`);
    });
});
