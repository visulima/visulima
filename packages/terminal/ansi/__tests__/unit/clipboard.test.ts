import { describe, expect, it } from "vitest";

import { clearClipboard, requestClipboard, setClipboard } from "../../src/clipboard";
import { BEL, OSC, ST } from "../../src/constants";

const b64 = (value: string): string => Buffer.from(value, "utf8").toString("base64");

describe("clipboard (OSC 52)", () => {
    describe(setClipboard, () => {
        it("should write to the system clipboard by default (BEL terminated)", () => {
            expect.assertions(1);

            expect(setClipboard("hello")).toBe(`${OSC}52;c;${b64("hello")}${BEL}`);
        });

        it("should honour a custom selection", () => {
            expect.assertions(1);

            expect(setClipboard("hello", "p")).toBe(`${OSC}52;p;${b64("hello")}${BEL}`);
        });

        it("should honour combined selections", () => {
            expect.assertions(1);

            expect(setClipboard("x", "cp")).toBe(`${OSC}52;cp;${b64("x")}${BEL}`);
        });

        it("should support the ST terminator", () => {
            expect.assertions(1);

            expect(setClipboard("hello", "c", ST)).toBe(`${OSC}52;c;${b64("hello")}${ST}`);
        });

        it("should base64-encode unicode payloads", () => {
            expect.assertions(1);

            expect(setClipboard("héllo €")).toBe(`${OSC}52;c;${b64("héllo €")}${BEL}`);
        });
    });

    describe(requestClipboard, () => {
        it("should produce a query with the '?' payload", () => {
            expect.assertions(2);

            expect(requestClipboard()).toBe(`${OSC}52;c;?${BEL}`);
            expect(requestClipboard("p", ST)).toBe(`${OSC}52;p;?${ST}`);
        });
    });

    describe(clearClipboard, () => {
        it("should produce an empty payload to clear the selection", () => {
            expect.assertions(2);

            expect(clearClipboard()).toBe(`${OSC}52;c;${BEL}`);
            expect(clearClipboard("p", ST)).toBe(`${OSC}52;p;${ST}`);
        });
    });
});
