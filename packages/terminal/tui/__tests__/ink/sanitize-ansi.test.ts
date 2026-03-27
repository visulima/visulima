import { describe, expect, it } from "vitest";
import stripAnsi from "strip-ansi";
import sanitizeAnsi from "../../src/ink/sanitize-ansi.js";

it("preserve plain text", () => {
    expect(sanitizeAnsi("hello")).toBe("hello");
});

it("preserve SGR sequences", () => {
    const output = sanitizeAnsi("A\u001B[38:2::255:100:0mcolor\u001B[0mB");

    expect(output.includes("\u001B[38:2::255:100:0m")).toBe(true);
    expect(stripAnsi(output)).toBe("AcolorB");
});

it("preserve OSC hyperlinks", () => {
    const output = sanitizeAnsi("\u001B]8;;https://example.com\u001B\\link\u001B]8;;\u001B\\");

    expect(output.includes("\u001B]8;;https://example.com")).toBe(true);
    expect(stripAnsi(output)).toBe("link");
});

it("preserve OSC hyperlinks terminated by C1 ST", () => {
    const output = sanitizeAnsi("\u001B]8;;https://example.com\u009Clink\u001B]8;;\u009C");

    expect(output.includes("\u001B]8;;https://example.com\u009C")).toBe(true);
    expect(stripAnsi(output)).toBe("link");
});

it("preserve C1 OSC hyperlinks terminated by C1 ST", () => {
    const input = "\u009D8;;https://example.com\u009Clink\u009D8;;\u009C";
    const output = sanitizeAnsi(input);

    expect(output.includes("\u009D8;;https://example.com\u009C")).toBe(true);
    expect(output).toBe(input);
});

it("preserve C1 OSC hyperlinks terminated by ESC ST", () => {
    const input = "\u009D8;;https://example.com\u001B\\link\u009D8;;\u001B\\";
    const output = sanitizeAnsi(input);

    expect(output.includes("\u009D8;;https://example.com\u001B\\")).toBe(true);
    expect(output).toBe(input);
});

it("preserve C1 OSC hyperlinks terminated by BEL", () => {
    const input = "\u009D8;;https://example.com\u0007link\u009D8;;\u0007";
    const output = sanitizeAnsi(input);

    expect(output.includes("\u009D8;;https://example.com\u0007")).toBe(true);
    expect(output).toBe(input);
});

it("strip non-SGR CSI sequences as complete units", () => {
    const output = sanitizeAnsi("A\u001B[>4;2mB\u001B[2 qC");

    expect(output.includes("4;2m")).toBe(false);
    expect(output.includes(" q")).toBe(false);
    expect(stripAnsi(output)).toBe("ABC");
});

it("strip C1 non-SGR CSI sequences as complete units", () => {
    const output = sanitizeAnsi("A\u009B>4;2mB\u009B2 qC");

    expect(output.includes("4;2m")).toBe(false);
    expect(output.includes(" q")).toBe(false);
    expect(stripAnsi(output)).toBe("ABC");
});

it("preserve C1 SGR CSI sequences", () => {
    const output = sanitizeAnsi("A\u009B31mgreen\u009B0mB");

    expect(output.includes("\u009B31m")).toBe(true);
    expect(stripAnsi(output)).toBe("AgreenB");
});

it("strip private-parameter m-sequences that are not SGR", () => {
    const output = sanitizeAnsi("A\u001B[>4;2mB");

    expect(output.includes("\u001B[>4;2m")).toBe(false);
    expect(stripAnsi(output)).toBe("AB");
});

it("strip tmux DCS passthrough wrappers with escaped ST payload terminators", () => {
    const wrappedHyperlinkStart = "\u001BPtmux;\u001B\u001B]8;;https://example.com\u001B\u001B\\\u001B\\";
    const wrappedHyperlinkEnd = "\u001BPtmux;\u001B\u001B]8;;\u001B\u001B\\\u001B\\";
    const output = sanitizeAnsi(`${wrappedHyperlinkStart}link${wrappedHyperlinkEnd}`);

    expect(output.includes("tmux;")).toBe(false);
    expect(output.includes("\u001BP")).toBe(false);
    expect(stripAnsi(output)).toBe("link");
});

it("strip incomplete DCS passthrough sequences to avoid payload leaks", () => {
    const output = sanitizeAnsi("A\u001BPtmux;\u001Blink");

    expect(output.includes("tmux;")).toBe(false);
    expect(stripAnsi(output)).toBe("A");
});

it("strip DCS control strings with BEL in payload until ST terminator", () => {
    const output = sanitizeAnsi("A\u001BPpayload\u0007still-payload\u001B\\B");

    expect(output.includes("payload")).toBe(false);
    expect(output.includes("still-payload")).toBe(false);
    expect(stripAnsi(output)).toBe("AB");
});

it("strip ESC SOS control strings as complete units", () => {
    const output = sanitizeAnsi("A\u001BXpayload\u001B\\B");

    expect(output.includes("payload")).toBe(false);
    expect(stripAnsi(output)).toBe("AB");
});

it("strip ESC SOS control strings with C1 ST terminator", () => {
    const output = sanitizeAnsi("A\u001BXpayload\u009CB");

    expect(output.includes("payload")).toBe(false);
    expect(stripAnsi(output)).toBe("AB");
});

it("strip C1 SOS control strings as complete units with C1 ST terminator", () => {
    const output = sanitizeAnsi("A\u0098payload\u009CB");

    expect(output.includes("payload")).toBe(false);
    expect(stripAnsi(output)).toBe("AB");
});

it("strip C1 SOS control strings as complete units with ESC ST terminator", () => {
    const output = sanitizeAnsi("A\u0098payload\u001B\\B");

    expect(output.includes("payload")).toBe(false);
    expect(stripAnsi(output)).toBe("AB");
});

it("strip ESC SOS with BEL terminator as malformed control string", () => {
    const output = sanitizeAnsi("A\u001BXpayload\u0007B");

    expect(output.includes("payload")).toBe(false);
    expect(stripAnsi(output)).toBe("A");
});

it("strip C1 SOS with BEL terminator as malformed control string", () => {
    const output = sanitizeAnsi("A\u0098payload\u0007B");

    expect(output.includes("payload")).toBe(false);
    expect(stripAnsi(output)).toBe("A");
});

it("strip incomplete ESC SOS control strings to avoid payload leaks", () => {
    const output = sanitizeAnsi("A\u001BXpayload");

    expect(output.includes("payload")).toBe(false);
    expect(stripAnsi(output)).toBe("A");
});

it("strip incomplete C1 SOS control strings to avoid payload leaks", () => {
    const output = sanitizeAnsi("A\u0098payload");

    expect(output.includes("payload")).toBe(false);
    expect(stripAnsi(output)).toBe("A");
});

it("strip SOS with escaped ESC in payload until final ST terminator", () => {
    const output = sanitizeAnsi("A\u001BXfoo\u001B\u001B\\bar\u001B\\B");

    expect(output.includes("foo")).toBe(false);
    expect(output.includes("bar")).toBe(false);
    expect(stripAnsi(output)).toBe("AB");
});

it("preserve SGR around stripped SOS control strings", () => {
    const output = sanitizeAnsi("A\u001B[31mR\u001B[0m\u001BXpayload\u001B\\B");

    expect(output.includes("\u001B[31m")).toBe(true);
    expect(output.includes("\u001B[0m")).toBe(true);
    expect(output.includes("payload")).toBe(false);
    expect(stripAnsi(output)).toBe("ARB");
});

it("strip ESC ST sequences", () => {
    const output = sanitizeAnsi("A\u001B\\B");

    expect(output.includes("\u001B\\")).toBe(false);
    expect(stripAnsi(output)).toBe("AB");
});

it("strip malformed ESC control sequences with intermediates and non-final bytes", () => {
    const output = sanitizeAnsi("A\u001B#\u0007payload");

    expect(output.includes("payload")).toBe(false);
    expect(stripAnsi(output)).toBe("A");
});

it("strip incomplete CSI after preserving prior SGR content", () => {
    const output = sanitizeAnsi("A\u001B[31mB\u001B[");

    expect(output.includes("\u001B[31m")).toBe(true);
    expect(stripAnsi(output)).toBe("AB");
});

it("strip standalone ST bytes", () => {
    const output = sanitizeAnsi("A\u009CB");

    expect(output.includes("\u009C")).toBe(false);
    expect(stripAnsi(output)).toBe("AB");
});

it("strip standalone C1 control characters", () => {
    const output = sanitizeAnsi("A\u0085B\u008EC");

    expect(output.includes("\u0085")).toBe(false);
    expect(output.includes("\u008E")).toBe(false);
    expect(stripAnsi(output)).toBe("ABC");
});
