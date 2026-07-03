import { strip as stripAnsi } from "@visulima/ansi";
import { describe, expect, it } from "vitest";

import sanitizeAnsi from "../../src/ink/sanitize-ansi";

describe("sanitize-ansi", () => {
    it("preserve plain text", () => {
        expect.assertions(1);

        expect(sanitizeAnsi("hello")).toBe("hello");
    });

    it("preserve SGR sequences", () => {
        expect.assertions(2);

        const output = sanitizeAnsi("A\u001B[38:2::255:100:0mcolor\u001B[0mB");

        expect(output).toContain("\u001B[38:2::255:100:0m");
        expect(stripAnsi(output)).toBe("AcolorB");
    });

    it("preserve OSC hyperlinks", () => {
        expect.assertions(2);

        const output = sanitizeAnsi("\u001B]8;;https://example.com\u001B\\link\u001B]8;;\u001B\\");

        expect(output).toContain("\u001B]8;;https://example.com");
        expect(stripAnsi(output)).toBe("link");
    });

    it("preserve OSC hyperlinks terminated by C1 ST", () => {
        expect.assertions(2);

        const output = sanitizeAnsi("\u001B]8;;https://example.com\u009Clink\u001B]8;;\u009C");

        expect(output).toContain("\u001B]8;;https://example.com\u009C");
        expect(stripAnsi(output)).toBe("link");
    });

    it("preserve C1 OSC hyperlinks terminated by C1 ST", () => {
        expect.assertions(2);

        const input = "\u009D8;;https://example.com\u009Clink\u009D8;;\u009C";
        const output = sanitizeAnsi(input);

        expect(output).toContain("\u009D8;;https://example.com\u009C");
        expect(output).toBe(input);
    });

    it("preserve C1 OSC hyperlinks terminated by ESC ST", () => {
        expect.assertions(2);

        const input = "\u009D8;;https://example.com\u001B\\link\u009D8;;\u001B\\";
        const output = sanitizeAnsi(input);

        expect(output).toContain("\u009D8;;https://example.com\u001B\\");
        expect(output).toBe(input);
    });

    it("preserve C1 OSC hyperlinks terminated by BEL", () => {
        expect.assertions(2);

        const input = "\u009D8;;https://example.com\u0007link\u009D8;;\u0007";
        const output = sanitizeAnsi(input);

        expect(output).toContain("\u009D8;;https://example.com\u0007");
        expect(output).toBe(input);
    });

    it("strip non-SGR CSI sequences as complete units", () => {
        expect.assertions(3);

        const output = sanitizeAnsi("A\u001B[>4;2mB\u001B[2 qC");

        expect(output).not.toContain("4;2m");
        expect(output).not.toContain(" q");
        expect(stripAnsi(output)).toBe("ABC");
    });

    it("strip C1 non-SGR CSI sequences as complete units", () => {
        expect.assertions(3);

        const output = sanitizeAnsi("A\u009B>4;2mB\u009B2 qC");

        expect(output).not.toContain("4;2m");
        expect(output).not.toContain(" q");
        expect(stripAnsi(output)).toBe("ABC");
    });

    it("preserve C1 SGR CSI sequences", () => {
        expect.assertions(2);

        const output = sanitizeAnsi("A\u009B31mgreen\u009B0mB");

        expect(output).toContain("\u009B31m");
        expect(stripAnsi(output)).toBe("AgreenB");
    });

    it("strip private-parameter m-sequences that are not SGR", () => {
        expect.assertions(2);

        const output = sanitizeAnsi("A\u001B[>4;2mB");

        expect(output).not.toContain("\u001B[>4;2m");
        expect(stripAnsi(output)).toBe("AB");
    });

    it("strip tmux DCS passthrough wrappers with escaped ST payload terminators", () => {
        expect.assertions(3);

        const wrappedHyperlinkStart = "\u001BPtmux;\u001B\u001B]8;;https://example.com\u001B\u001B\\\u001B\\";
        const wrappedHyperlinkEnd = "\u001BPtmux;\u001B\u001B]8;;\u001B\u001B\\\u001B\\";
        const output = sanitizeAnsi(`${wrappedHyperlinkStart}link${wrappedHyperlinkEnd}`);

        expect(output).not.toContain("tmux;");
        expect(output).not.toContain("\u001BP");
        expect(stripAnsi(output)).toBe("link");
    });

    it("strip incomplete DCS passthrough sequences to avoid payload leaks", () => {
        expect.assertions(2);

        const output = sanitizeAnsi("A\u001BPtmux;\u001Blink");

        expect(output).not.toContain("tmux;");
        expect(stripAnsi(output)).toBe("A");
    });

    it("strip DCS control strings with BEL in payload until ST terminator", () => {
        expect.assertions(3);

        const output = sanitizeAnsi("A\u001BPpayload\u0007still-payload\u001B\\B");

        expect(output).not.toContain("payload");
        expect(output).not.toContain("still-payload");
        expect(stripAnsi(output)).toBe("AB");
    });

    it("strip ESC SOS control strings as complete units", () => {
        expect.assertions(2);

        const output = sanitizeAnsi("A\u001BXpayload\u001B\\B");

        expect(output).not.toContain("payload");
        expect(stripAnsi(output)).toBe("AB");
    });

    it("strip ESC SOS control strings with C1 ST terminator", () => {
        expect.assertions(2);

        const output = sanitizeAnsi("A\u001BXpayload\u009CB");

        expect(output).not.toContain("payload");
        expect(stripAnsi(output)).toBe("AB");
    });

    it("strip C1 SOS control strings as complete units with C1 ST terminator", () => {
        expect.assertions(2);

        const output = sanitizeAnsi("A\u0098payload\u009CB");

        expect(output).not.toContain("payload");
        expect(stripAnsi(output)).toBe("AB");
    });

    it("strip C1 SOS control strings as complete units with ESC ST terminator", () => {
        expect.assertions(2);

        const output = sanitizeAnsi("A\u0098payload\u001B\\B");

        expect(output).not.toContain("payload");
        expect(stripAnsi(output)).toBe("AB");
    });

    it("strip ESC SOS with BEL terminator as malformed control string", () => {
        expect.assertions(2);

        const output = sanitizeAnsi("A\u001BXpayload\u0007B");

        expect(output).not.toContain("payload");
        expect(stripAnsi(output)).toBe("A");
    });

    it("strip C1 SOS with BEL terminator as malformed control string", () => {
        expect.assertions(2);

        const output = sanitizeAnsi("A\u0098payload\u0007B");

        expect(output).not.toContain("payload");
        expect(stripAnsi(output)).toBe("A");
    });

    it("strip incomplete ESC SOS control strings to avoid payload leaks", () => {
        expect.assertions(2);

        const output = sanitizeAnsi("A\u001BXpayload");

        expect(output).not.toContain("payload");
        expect(stripAnsi(output)).toBe("A");
    });

    it("strip incomplete C1 SOS control strings to avoid payload leaks", () => {
        expect.assertions(2);

        const output = sanitizeAnsi("A\u0098payload");

        expect(output).not.toContain("payload");
        expect(stripAnsi(output)).toBe("A");
    });

    it("strip SOS with escaped ESC in payload until final ST terminator", () => {
        expect.assertions(3);

        const output = sanitizeAnsi("A\u001BXfoo\u001B\u001B\\bar\u001B\\B");

        expect(output).not.toContain("foo");
        expect(output).not.toContain("bar");
        expect(stripAnsi(output)).toBe("AB");
    });

    it("preserve SGR around stripped SOS control strings", () => {
        expect.assertions(4);

        const output = sanitizeAnsi("A\u001B[31mR\u001B[0m\u001BXpayload\u001B\\B");

        expect(output).toContain("\u001B[31m");
        expect(output).toContain("\u001B[0m");
        expect(output).not.toContain("payload");
        expect(stripAnsi(output)).toBe("ARB");
    });

    it("strip ESC ST sequences", () => {
        expect.assertions(2);

        const output = sanitizeAnsi("A\u001B\\B");

        expect(output).not.toContain("\u001B\\");
        expect(stripAnsi(output)).toBe("AB");
    });

    it("strip malformed ESC control sequences with intermediates and non-final bytes", () => {
        expect.assertions(2);

        const output = sanitizeAnsi("A\u001B#\u0007payload");

        expect(output).not.toContain("payload");
        expect(stripAnsi(output)).toBe("A");
    });

    it("strip incomplete CSI after preserving prior SGR content", () => {
        expect.assertions(2);

        const output = sanitizeAnsi("A\u001B[31mB\u001B[");

        expect(output).toContain("\u001B[31m");
        expect(stripAnsi(output)).toBe("AB");
    });

    it("strip standalone ST bytes", () => {
        expect.assertions(2);

        const output = sanitizeAnsi("A\u009CB");

        expect(output).not.toContain("\u009C");
        expect(stripAnsi(output)).toBe("AB");
    });

    it("strip standalone C1 control characters", () => {
        expect.assertions(3);

        const output = sanitizeAnsi("A\u0085B\u008EC");

        expect(output).not.toContain("\u0085");
        expect(output).not.toContain("\u008E");
        expect(stripAnsi(output)).toBe("ABC");
    });

    it("strip OSC 0 title-set sequences", () => {
        expect.assertions(2);

        const output = sanitizeAnsi("A]0;EVILB");

        expect(output).not.toContain("EVIL");
        expect(stripAnsi(output)).toBe("AB");
    });

    it("strip OSC 1 icon-name sequences", () => {
        expect.assertions(2);

        const output = sanitizeAnsi("A]1;EVILB");

        expect(output).not.toContain("EVIL");
        expect(stripAnsi(output)).toBe("AB");
    });

    it("strip OSC 2 window-title sequences (BEL terminated)", () => {
        expect.assertions(2);

        const output = sanitizeAnsi("A]2;HACKEDB");

        expect(output).not.toContain("HACKED");
        expect(stripAnsi(output)).toBe("AB");
    });

    it("strip OSC 2 window-title sequences (ST terminated)", () => {
        expect.assertions(2);

        const output = sanitizeAnsi(String.raw`A]2;HACKED\B`);

        expect(output).not.toContain("HACKED");
        expect(stripAnsi(output)).toBe("AB");
    });

    it("strip OSC 52 clipboard-write sequences", () => {
        expect.assertions(2);

        const output = sanitizeAnsi("A]52;c;ZXZpbA==B");

        expect(output).not.toContain("ZXZpbA==");
        expect(stripAnsi(output)).toBe("AB");
    });

    it("strip OSC 4 palette-set sequences", () => {
        expect.assertions(2);

        const output = sanitizeAnsi("A]4;0;#ff0000B");

        expect(output).not.toContain("#ff0000");
        expect(stripAnsi(output)).toBe("AB");
    });

    it("strip OSC 9 notification sequences", () => {
        expect.assertions(2);

        const output = sanitizeAnsi("A]9;EVILB");

        expect(output).not.toContain("EVIL");
        expect(stripAnsi(output)).toBe("AB");
    });

    it("strip C1 OSC non-hyperlink sequences", () => {
        expect.assertions(2);

        const output = sanitizeAnsi("A\u009D2;HACKED\u009CB");

        expect(output).not.toContain("HACKED");
        expect(stripAnsi(output)).toBe("AB");
    });

    it("does not allow OSC 80+ through the OSC 8 prefix check (ESC form)", () => {
        expect.assertions(2);

        const output = sanitizeAnsi("A]80;evilB");

        expect(output).not.toContain("evil");
        expect(stripAnsi(output)).toBe("AB");
    });

    it("does not allow OSC 80+ through the OSC 8 prefix check (C1 form)", () => {
        expect.assertions(2);

        const output = sanitizeAnsi("A\u009D80;evil\u009CB");

        expect(output).not.toContain("evil");
        expect(stripAnsi(output)).toBe("AB");
    });
});
