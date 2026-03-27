import { describe, expect, it } from "vitest";
import chalk from "chalk";
import stripAnsi from "strip-ansi";
import { render, Box, Text } from "../../src/ink/index.js";
import { renderToString, renderToStringAsync } from "../helpers/ink-render.js";
import createStdout from "../helpers/ink-create-stdout.js";
import { renderAsync } from "../helpers/ink-test-renderer.js";

const renderText = (text: string): string =>
    renderToString(
        <Box>
            <Text>{text}</Text>
        </Box>,
    );

it("<Text> with undefined children", () => {
    const output = renderToString(<Text />);
    expect(output).toBe("");
});

it("<Text> with null children", () => {
    const output = renderToString(<Text>{null}</Text>);
    expect(output).toBe("");
});

it("text with standard color", () => {
    const output = renderToString(<Text color="green">Test</Text>);
    expect(output).toBe(chalk.green("Test"));
});

it("text with dim+bold", () => {
    const originalLevel = chalk.level;
    chalk.level = 3;

    const output = renderToString(
        <Text dimColor bold>
            Test
        </Text>,
    );

    chalk.level = originalLevel;
    expect(stripAnsi(output)).toBe("Test");
    expect(output).not.toBe("Test");
});

it("text with dimmed color", () => {
    const output = renderToString(
        <Text dimColor color="green">
            Test
        </Text>,
    );
    expect(output).toBe(chalk.green.dim("Test"));
});

it("text with hex color", () => {
    const output = renderToString(<Text color="#FF8800">Test</Text>);
    expect(output).toBe(chalk.hex("#FF8800")("Test"));
});

it("text with rgb color", () => {
    const output = renderToString(<Text color="rgb(255, 136, 0)">Test</Text>);
    expect(output).toBe(chalk.rgb(255, 136, 0)("Test"));
});

it("text with ansi256 color", () => {
    const output = renderToString(<Text color="ansi256(194)">Test</Text>);
    expect(output).toBe(chalk.ansi256(194)("Test"));
});

it("text with standard background color", () => {
    const output = renderToString(<Text backgroundColor="green">Test</Text>);
    expect(output).toBe(chalk.bgGreen("Test"));
});

it("text with hex background color", () => {
    const output = renderToString(<Text backgroundColor="#FF8800">Test</Text>);
    expect(output).toBe(chalk.bgHex("#FF8800")("Test"));
});

it("text with rgb background color", () => {
    const output = renderToString(<Text backgroundColor="rgb(255, 136, 0)">Test</Text>);
    expect(output).toBe(chalk.bgRgb(255, 136, 0)("Test"));
});

it("text with ansi256 background color", () => {
    const output = renderToString(<Text backgroundColor="ansi256(194)">Test</Text>);
    expect(output).toBe(chalk.bgAnsi256(194)("Test"));
});

it("text with inversion", () => {
    const output = renderToString(<Text inverse>Test</Text>);
    expect(output).toBe(chalk.inverse("Test"));
});

it("text with empty-to-nonempty sibling does not wrap", () => {
    function Test({ show }: { readonly show?: boolean }) {
        return (
            <Box>
                <Text>
                    {show ? "x" : ""}
                    {"hello"}
                </Text>
            </Box>
        );
    }

    const stdout = createStdout();
    const { rerender } = render(<Test />, { stdout, debug: true });
    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("hello");

    rerender(<Test show />);
    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("xhello");
});

it("remeasure text when text is changed", () => {
    function Test({ add }: { readonly add?: boolean }) {
        return (
            <Box>
                <Text>{add ? "abcx" : "abc"}</Text>
            </Box>
        );
    }

    const stdout = createStdout();
    const { rerender } = render(<Test />, { stdout, debug: true });
    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("abc");

    rerender(<Test add />);
    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("abcx");
});

it("remeasure text when text nodes are changed", () => {
    function Test({ add }: { readonly add?: boolean }) {
        return (
            <Box>
                <Text>
                    abc
                    {add ? <Text>x</Text> : null}
                </Text>
            </Box>
        );
    }

    const stdout = createStdout();

    const { rerender } = render(<Test />, { stdout, debug: true });
    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("abc");

    rerender(<Test add />);
    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("abcx");
});

it('text with content "constructor" wraps correctly', () => {
    const output = renderToString(<Text>constructor</Text>);
    expect(output).toBe("constructor");
});

it("strip ANSI cursor movement sequences from text", () => {
    const input = "\u001B[1A\u001B[2KStarting client ... \u001B[32mdone\u001B[0m\u001B[1B";

    const output = renderToString(
        <Box>
            <Text>{input}</Text>
        </Box>,
    );

    expect(output.includes("\u001B[1A")).toBe(false);
    expect(output.includes("\u001B[2K")).toBe(false);
    expect(output.includes("\u001B[1B")).toBe(false);
    expect(stripAnsi(output)).toBe("Starting client ... done");
});

it("strip ANSI cursor position and erase sequences from text", () => {
    const output = renderToString(
        <Box>
            <Text>{"Hello\u001B[5;10HWorld\u001B[2J!"}</Text>
        </Box>,
    );

    expect(output.includes("\u001B[5;10H")).toBe(false);
    expect(output.includes("\u001B[2J")).toBe(false);
    expect(stripAnsi(output)).toBe("HelloWorld!");
});

it("preserve SGR color sequences in text", () => {
    const output = renderToString(
        <Box>
            <Text>{"\u001B[32mgreen\u001B[0m normal"}</Text>
        </Box>,
    );

    expect(output.includes("\u001B[")).toBe(true);
    expect(stripAnsi(output)).toBe("green normal");
});

it("preserve OSC hyperlink sequences in text", () => {
    const output = renderText("\u001B]8;;https://example.com\u0007link\u001B]8;;\u0007");

    expect(output.includes("\u001B]8;;")).toBe(true);
    expect(stripAnsi(output)).toBe("link");
});

it("preserve OSC hyperlink sequences with ST terminator in text", () => {
    const output = renderText("\u001B]8;;https://example.com\u001B\\link\u001B]8;;\u001B\\");

    expect(output.includes("\u001B]8;;")).toBe(true);
    expect(output.includes("\u001B\\")).toBe(true);
    expect(stripAnsi(output)).toBe("link");
});

it("preserve C1 OSC sequences in text", () => {
    const input = "\u009D8;;https://example.com\u0007link\u009D8;;\u0007";
    const output = renderText(input);

    expect(output.includes("\u009D8;;https://example.com")).toBe(true);
    expect(output.includes("\u009D8;;\u0007")).toBe(true);
    expect(output).toBe(input);
});

it("preserve C1 OSC hyperlink sequences with ST terminator in text", () => {
    const input = "\u009D8;;https://example.com\u001B\\link\u009D8;;\u001B\\";
    const output = renderText(input);

    expect(output.includes("\u009D8;;https://example.com")).toBe(true);
    expect(output.includes("\u001B\\")).toBe(true);
    expect(output).toBe(input);
});

it("preserve SGR sequences with colon parameters", () => {
    const output = renderText("A\u001B[38:2::255:100:0mcolor\u001B[0mB");

    expect(output.includes("\u001B[38:2::255:100:0m")).toBe(true);
    expect(stripAnsi(output)).toBe("AcolorB");
});

it("strip complete non-SGR CSI sequences without leaking parameters", () => {
    const input = "A\u001B[>4;2mB\u001B[2 qC";
    const output = renderText(input);

    expect(output.includes("4;2m")).toBe(false);
    expect(output.includes(" q")).toBe(false);
    expect(stripAnsi(output)).toBe("ABC");
});

it("strip complete C1 non-SGR CSI sequences without leaking parameters", () => {
    const output = renderText("A\u009B>4;2mB\u009B2 qC");

    expect(output.includes("4;2m")).toBe(false);
    expect(output.includes(" q")).toBe(false);
    expect(stripAnsi(output)).toBe("ABC");
});

it("strip complete ESC control sequences with intermediates", () => {
    const output = renderText("A\u001B#8B\u001BcC");

    expect(output.includes("\u001B#8")).toBe(false);
    expect(output.includes("\u001Bc")).toBe(false);
    expect(stripAnsi(output)).toBe("ABC");
});

it("strip tmux DCS passthrough wrappers without leaking payload", () => {
    const wrappedHyperlinkStart = "\u001BPtmux;\u001B\u001B]8;;https://example.com\u0007\u001B\\";
    const wrappedHyperlinkEnd = "\u001BPtmux;\u001B\u001B]8;;\u0007\u001B\\";
    const output = renderText(`${wrappedHyperlinkStart}link${wrappedHyperlinkEnd}`);

    expect(output.includes("tmux;")).toBe(false);
    expect(output.includes("\u001BP")).toBe(false);
    expect(output.includes("\u001B\\")).toBe(false);
    expect(stripAnsi(output)).toBe("link");
});

it("strip ESC SOS control strings as complete units", () => {
    const output = renderText("A\u001BXpayload\u001B\\B");

    expect(output.includes("payload")).toBe(false);
    expect(stripAnsi(output)).toBe("AB");
});

it("strip C1 SOS control strings as complete units", () => {
    const output = renderText("A\u0098payload\u001B\\B\u0098payload\u009CC");

    expect(output.includes("payload")).toBe(false);
    expect(stripAnsi(output)).toBe("ABC");
});

it("strip standalone ST bytes from text output", () => {
    const output = renderText("A\u009CB");

    expect(output.includes("\u009C")).toBe(false);
    expect(stripAnsi(output)).toBe("AB");
});

it("strip standalone C1 control characters from text output", () => {
    const output = renderText("A\u0085B\u008EC");

    expect(output.includes("\u0085")).toBe(false);
    expect(output.includes("\u008E")).toBe(false);
    expect(stripAnsi(output)).toBe("ABC");
});

// Concurrent mode tests
it("<Text> with undefined children - concurrent", async () => {
    const output = await renderToStringAsync(<Text />);
    expect(output).toBe("");
});

it("<Text> with null children - concurrent", async () => {
    const output = await renderToStringAsync(<Text>{null}</Text>);
    expect(output).toBe("");
});

it("text with standard color - concurrent", async () => {
    const output = await renderToStringAsync(<Text color="green">Test</Text>);
    expect(output).toBe(chalk.green("Test"));
});

it("text with dim+bold - concurrent", async () => {
    const originalLevel = chalk.level;
    chalk.level = 3;

    const output = await renderToStringAsync(
        <Text dimColor bold>
            Test
        </Text>,
    );

    chalk.level = originalLevel;
    expect(stripAnsi(output)).toBe("Test");
    expect(output).not.toBe("Test");
});

it("text with hex color - concurrent", async () => {
    const output = await renderToStringAsync(<Text color="#FF8800">Test</Text>);
    expect(output).toBe(chalk.hex("#FF8800")("Test"));
});

it("text with inversion - concurrent", async () => {
    const output = await renderToStringAsync(<Text inverse>Test</Text>);
    expect(output).toBe(chalk.inverse("Test"));
});

it("remeasure text when text is changed - concurrent", async () => {
    function Test({ add }: { readonly add?: boolean }) {
        return (
            <Box>
                <Text>{add ? "abcx" : "abc"}</Text>
            </Box>
        );
    }

    const { getOutput, rerenderAsync } = await renderAsync(<Test />);
    expect(getOutput()).toBe("abc");

    await rerenderAsync(<Test add />);
    expect(getOutput()).toBe("abcx");
});

it("remeasure text when text nodes are changed - concurrent", async () => {
    function Test({ add }: { readonly add?: boolean }) {
        return (
            <Box>
                <Text>
                    abc
                    {add ? <Text>x</Text> : null}
                </Text>
            </Box>
        );
    }

    const { getOutput, rerenderAsync } = await renderAsync(<Test />);
    expect(getOutput()).toBe("abc");

    await rerenderAsync(<Test add />);
    expect(getOutput()).toBe("abcx");
});
