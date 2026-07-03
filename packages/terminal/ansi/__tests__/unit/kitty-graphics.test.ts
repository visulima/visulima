import { describe, expect, it } from "vitest";

import { APC, ST } from "../../src/constants";
import kittyGraphics from "../../src/kitty-graphics";

describe("kitty graphics wrapper", () => {
    it("should frame options and a payload", () => {
        expect.assertions(1);
        expect(kittyGraphics("AAAA", "a=T", "f=100")).toBe(`${APC}Ga=T,f=100;AAAA${ST}`);
    });

    it("should omit the payload separator for control-only sequences", () => {
        expect.assertions(1);
        expect(kittyGraphics("", "a=d")).toBe(`${APC}Ga=d${ST}`);
    });

    it("should support a bare payload with no options", () => {
        expect.assertions(1);
        expect(kittyGraphics("AAAA")).toBe(`${APC}G;AAAA${ST}`);
    });
});
