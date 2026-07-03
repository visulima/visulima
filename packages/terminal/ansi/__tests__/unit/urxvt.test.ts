import { describe, expect, it } from "vitest";

import { BEL, OSC } from "../../src/constants";
import urxvtExtension from "../../src/urxvt";

describe("urxvt OSC 777 extension", () => {
    it("should build an extension call with parameters", () => {
        expect.assertions(1);
        expect(urxvtExtension("notify", "title", "body")).toBe(`${OSC}777;notify;title;body${BEL}`);
    });

    it("should build an extension call without parameters", () => {
        expect.assertions(1);
        expect(urxvtExtension("notify")).toBe(`${OSC}777;notify;${BEL}`);
    });

    it("should strip escape-sequence terminators from parameters", () => {
        expect.assertions(1);
        expect(urxvtExtension("notify", "a\u001Bb\u0007")).toBe(`${OSC}777;notify;ab${BEL}`);
    });
});
