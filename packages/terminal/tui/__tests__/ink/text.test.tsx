import { strip as stripAnsi } from "@visulima/ansi";
import { ansi256, bgAnsi256, bgGreen, bgHex, bgRgb, green, hex, inverse, rgb } from "@visulima/colorize";
import { describe, expect, it } from "vitest";

import { Box, render, Text } from "../../src/ink/index";
import createStdout from "../helpers/ink-create-stdout";
import { renderToString, renderToStringAsync } from "../helpers/ink-render";
import { renderAsync } from "../helpers/ink-test-renderer";

const renderText = (text: string): string =>
    renderToString(
        <Box>
            <Text>{text}</Text>
        </Box>,
    );

describe("text", () => {
    it("<Text> with undefined children", () => {
        expect.assertions(1);

        const output = renderToString(<Text />);

        expect(output).toBe("");
    });

    it("<Text> with null children", () => {
        expect.assertions(1);

        const output = renderToString(<Text>{null}</Text>);

        expect(output).toBe("");
    });

    it("text with standard color", () => {
        expect.assertions(1);

        const output = renderToString(<Text color="green">Test</Text>);

        expect(output).toBe(green("Test"));
    });

    it("text with dim+bold", () => {
        expect.assertions(2);

        const output = renderToString(
            <Text bold dimColor>
                Test
            </Text>,
        );

        expect(stripAnsi(output)).toBe("Test");
        expect(output).not.toBe("Test");
    });

    it("text with dimmed color", () => {
        expect.assertions(3);

        const output = renderToString(
            <Text color="green" dimColor>
                Test
            </Text>,
        );

        // StyledLine serializer may emit dim+green in either order; both
        // are visually identical. Check for presence of both codes.
        expect(output).toContain("\u001B[2m"); // dim
        expect(output).toContain("\u001B[32m"); // green
        expect(stripAnsi(output)).toBe("Test");
    });

    it("text with hex color", () => {
        expect.assertions(1);

        const output = renderToString(<Text color="#FF8800">Test</Text>);

        expect(output).toBe(hex("#FF8800")("Test"));
    });

    it("text with rgb color", () => {
        expect.assertions(1);

        const output = renderToString(<Text color="rgb(255, 136, 0)">Test</Text>);

        expect(output).toBe(rgb(255, 136, 0)("Test"));
    });

    it("text with ansi256 color", () => {
        expect.assertions(1);

        const output = renderToString(<Text color="ansi256(194)">Test</Text>);

        expect(output).toBe(ansi256(194)("Test"));
    });

    it("text with standard background color", () => {
        expect.assertions(1);

        const output = renderToString(<Text backgroundColor="green">Test</Text>);

        expect(output).toBe(bgGreen("Test"));
    });

    it("text with hex background color", () => {
        expect.assertions(1);

        const output = renderToString(<Text backgroundColor="#FF8800">Test</Text>);

        expect(output).toBe(bgHex("#FF8800")("Test"));
    });

    it("text with rgb background color", () => {
        expect.assertions(1);

        const output = renderToString(<Text backgroundColor="rgb(255, 136, 0)">Test</Text>);

        expect(output).toBe(bgRgb(255, 136, 0)("Test"));
    });

    it("text with ansi256 background color", () => {
        expect.assertions(1);

        const output = renderToString(<Text backgroundColor="ansi256(194)">Test</Text>);

        expect(output).toBe(bgAnsi256(194)("Test"));
    });

    it("text with inversion", () => {
        expect.assertions(1);

        const output = renderToString(<Text inverse>Test</Text>);

        expect(output).toBe(inverse("Test"));
    });

    it("text with empty-to-nonempty sibling does not wrap", () => {
        expect.assertions(2);

        const Test = ({ show }: { readonly show?: boolean }) => (
            <Box>
                <Text>
                    {show ? "x" : ""}
                    hello
                </Text>
            </Box>
        );

        const stdout = createStdout();
        const { rerender } = render(<Test />, { debug: true, stdout });

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("hello");

        rerender(<Test show />);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("xhello");
    });

    it("remeasure text when text is changed", () => {
        expect.assertions(2);

        const Test = ({ add }: { readonly add?: boolean }) => (
            <Box>
                <Text>{add ? "abcx" : "abc"}</Text>
            </Box>
        );

        const stdout = createStdout();
        const { rerender } = render(<Test />, { debug: true, stdout });

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("abc");

        rerender(<Test add />);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("abcx");
    });

    it("remeasure text when text nodes are changed", () => {
        expect.assertions(2);

        const Test = ({ add }: { readonly add?: boolean }) => (
            <Box>
                <Text>
                    abc
                    {add ? <Text>x</Text> : null}
                </Text>
            </Box>
        );

        const stdout = createStdout();

        const { rerender } = render(<Test />, { debug: true, stdout });

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("abc");

        rerender(<Test add />);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("abcx");
    });

    it('text with content "constructor" wraps correctly', () => {
        expect.assertions(1);

        const output = renderToString(<Text>constructor</Text>);

        expect(output).toBe("constructor");
    });

    it("strip ANSI cursor movement sequences from text", () => {
        expect.assertions(4);

        const input = "\u001B[1A\u001B[2KStarting client ... \u001B[32mdone\u001B[0m\u001B[1B";

        const output = renderToString(
            <Box>
                <Text>{input}</Text>
            </Box>,
        );

        expect(output).not.toContain("\u001B[1A");
        expect(output).not.toContain("\u001B[2K");
        expect(output).not.toContain("\u001B[1B");
        expect(stripAnsi(output)).toBe("Starting client ... done");
    });

    it("strip ANSI cursor position and erase sequences from text", () => {
        expect.assertions(3);

        const output = renderToString(
            <Box>
                <Text>{"Hello\u001B[5;10HWorld\u001B[2J!"}</Text>
            </Box>,
        );

        expect(output).not.toContain("\u001B[5;10H");
        expect(output).not.toContain("\u001B[2J");
        expect(stripAnsi(output)).toBe("HelloWorld!");
    });

    it("preserve SGR color sequences in text", () => {
        expect.assertions(2);

        const output = renderToString(
            <Box>
                <Text>{"\u001B[32mgreen\u001B[0m normal"}</Text>
            </Box>,
        );

        expect(output).toContain("\u001B[");
        expect(stripAnsi(output)).toBe("green normal");
    });

    it("preserve OSC hyperlink sequences in text", () => {
        expect.assertions(2);

        const output = renderText("\u001B]8;;https://example.com\u0007link\u001B]8;;\u0007");

        expect(output).toContain("\u001B]8;;");
        expect(stripAnsi(output)).toBe("link");
    });

    it("preserve OSC hyperlink sequences with ST terminator in text", () => {
        expect.assertions(3);

        const output = renderText("\u001B]8;;https://example.com\u001B\\link\u001B]8;;\u001B\\");

        expect(output).toContain("\u001B]8;;");
        expect(output).toContain("\u001B\\");
        expect(stripAnsi(output)).toBe("link");
    });

    it("preserve C1 OSC sequences in text", () => {
        expect.assertions(3);

        const input = "\u009D8;;https://example.com\u0007link\u009D8;;\u0007";
        const output = renderText(input);

        // The new pipeline normalizes C1 OSC (\u009D) to ESC-based (\u001B])
        expect(output).toContain("\u001B]8;;https://example.com");
        expect(output).toContain("\u001B]8;;\u0007");
        expect(stripAnsi(output)).toBe("link");
    });

    it("preserve C1 OSC hyperlink sequences with ST terminator in text", () => {
        expect.assertions(3);

        const input = "\u009D8;;https://example.com\u001B\\link\u009D8;;\u001B\\";
        const output = renderText(input);

        // The new pipeline normalizes C1 OSC (\u009D) to ESC-based (\u001B])
        expect(output).toContain("\u001B]8;;https://example.com");
        expect(output).toContain("\u001B\\");
        expect(stripAnsi(output)).toBe("link");
    });

    it("preserve SGR sequences with colon parameters", () => {
        expect.assertions(2);

        const output = renderText("A\u001B[38:2::255:100:0mcolor\u001B[0mB");

        // The new pipeline normalizes colon-delimited SGR to semicolon-delimited
        expect(output).toContain("\u001B[38;2;255;100;0m");
        expect(stripAnsi(output)).toBe("AcolorB");
    });

    it("strip complete non-SGR CSI sequences without leaking parameters", () => {
        expect.assertions(3);

        const input = "A\u001B[>4;2mB\u001B[2 qC";
        const output = renderText(input);

        expect(output).not.toContain("4;2m");
        expect(output).not.toContain(" q");
        expect(stripAnsi(output)).toBe("ABC");
    });

    it("strip complete C1 non-SGR CSI sequences without leaking parameters", () => {
        expect.assertions(3);

        const output = renderText("A\u009B>4;2mB\u009B2 qC");

        expect(output).not.toContain("4;2m");
        expect(output).not.toContain(" q");
        expect(stripAnsi(output)).toBe("ABC");
    });

    it("strip complete ESC control sequences with intermediates", () => {
        expect.assertions(3);

        const output = renderText("A\u001B#8B\u001BcC");

        expect(output).not.toContain("\u001B#8");
        expect(output).not.toContain("\u001Bc");
        expect(stripAnsi(output)).toBe("ABC");
    });

    it("strip tmux DCS passthrough wrappers without leaking payload", () => {
        expect.assertions(4);

        const wrappedHyperlinkStart = "\u001BPtmux;\u001B\u001B]8;;https://example.com\u0007\u001B\\";
        const wrappedHyperlinkEnd = "\u001BPtmux;\u001B\u001B]8;;\u0007\u001B\\";
        const output = renderText(`${wrappedHyperlinkStart}link${wrappedHyperlinkEnd}`);

        expect(output).not.toContain("tmux;");
        expect(output).not.toContain("\u001BP");
        expect(output).not.toContain("\u001B\\");
        expect(stripAnsi(output)).toBe("link");
    });

    it("strip ESC SOS control strings as complete units", () => {
        expect.assertions(2);

        const output = renderText("A\u001BXpayload\u001B\\B");

        expect(output).not.toContain("payload");
        expect(stripAnsi(output)).toBe("AB");
    });

    it("strip C1 SOS control strings as complete units", () => {
        expect.assertions(2);

        const output = renderText("A\u0098payload\u001B\\B\u0098payload\u009CC");

        expect(output).not.toContain("payload");
        expect(stripAnsi(output)).toBe("ABC");
    });

    it("strip standalone ST bytes from text output", () => {
        expect.assertions(2);

        const output = renderText("A\u009CB");

        expect(output).not.toContain("\u009C");
        expect(stripAnsi(output)).toBe("AB");
    });

    it("strip standalone C1 control characters from text output", () => {
        expect.assertions(3);

        const output = renderText("A\u0085B\u008EC");

        expect(output).not.toContain("\u0085");
        expect(output).not.toContain("\u008E");
        expect(stripAnsi(output)).toBe("ABC");
    });

    // Concurrent mode tests
    it("<Text> with undefined children - concurrent", async () => {
        expect.assertions(1);

        const output = await renderToStringAsync(<Text />);

        expect(output).toBe("");
    });

    it("<Text> with null children - concurrent", async () => {
        expect.assertions(1);

        const output = await renderToStringAsync(<Text>{null}</Text>);

        expect(output).toBe("");
    });

    it("text with standard color - concurrent", async () => {
        expect.assertions(1);

        const output = await renderToStringAsync(<Text color="green">Test</Text>);

        expect(output).toBe(green("Test"));
    });

    it("text with dim+bold - concurrent", async () => {
        expect.assertions(2);

        const output = await renderToStringAsync(
            <Text bold dimColor>
                Test
            </Text>,
        );

        expect(stripAnsi(output)).toBe("Test");
        expect(output).not.toBe("Test");
    });

    it("text with hex color - concurrent", async () => {
        expect.assertions(1);

        const output = await renderToStringAsync(<Text color="#FF8800">Test</Text>);

        expect(output).toBe(hex("#FF8800")("Test"));
    });

    it("text with inversion - concurrent", async () => {
        expect.assertions(1);

        const output = await renderToStringAsync(<Text inverse>Test</Text>);

        expect(output).toBe(inverse("Test"));
    });

    it("remeasure text when text is changed - concurrent", async () => {
        expect.assertions(2);

        const Test = ({ add }: { readonly add?: boolean }) => (
            <Box>
                <Text>{add ? "abcx" : "abc"}</Text>
            </Box>
        );

        const { getOutput, rerenderAsync } = await renderAsync(<Test />);

        expect(getOutput()).toBe("abc");

        await rerenderAsync(<Test add />);

        expect(getOutput()).toBe("abcx");
    });

    it("remeasure text when text nodes are changed - concurrent", async () => {
        expect.assertions(2);

        const Test = ({ add }: { readonly add?: boolean }) => (
            <Box>
                <Text>
                    abc
                    {add ? <Text>x</Text> : null}
                </Text>
            </Box>
        );

        const { getOutput, rerenderAsync } = await renderAsync(<Test />);

        expect(getOutput()).toBe("abc");

        await rerenderAsync(<Test add />);

        expect(getOutput()).toBe("abcx");
    });
});
