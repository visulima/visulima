import { describe, expect, it } from "vitest";

import { BEL, OSC } from "../../src/constants";
import { desktopNotification, notify } from "../../src/notification";

describe("desktop notification sequences", () => {
    it("should build an OSC 9 notification", () => {
        expect.assertions(1);
        expect(notify("Build finished")).toBe(`${OSC}9;Build finished${BEL}`);
    });

    it("should build an OSC 99 notification without metadata", () => {
        expect.assertions(1);
        expect(desktopNotification("hello")).toBe(`${OSC}99;;hello${BEL}`);
    });

    it("should join OSC 99 metadata with colons", () => {
        expect.assertions(1);
        expect(desktopNotification("hello", "i=1", "d=1")).toBe(`${OSC}99;i=1:d=1;hello${BEL}`);
    });

    it("should strip escape-sequence terminators from the message", () => {
        expect.assertions(1);
        expect(notify("hi\u001B]0;pwned\u0007")).toBe(`${OSC}9;hi]0;pwned${BEL}`);
    });
});
