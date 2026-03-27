import { afterAll, beforeAll, describe, expect, it } from "vitest";
import colorizeDefault from "@visulima/colorize";
import { render, Box, Text } from "../../src/ink/index.js";
import { renderToString, renderToStringAsync } from "../helpers/ink-render.js";
import createStdout from "../helpers/ink-create-stdout.js";
import { renderAsync } from "../helpers/ink-test-renderer.js";
import { enableTestColors, disableTestColors } from "../helpers/ink-force-colors.js";

// ANSI escape sequences for background colors
const ansi = {
    bgRed: "\u001B[41m",
    bgGreen: "\u001B[42m",
    bgYellow: "\u001B[43m",
    bgBlue: "\u001B[44m",
    bgMagenta: "\u001B[45m",
    bgCyan: "\u001B[46m",
    bgHexRed: "\u001B[48;2;255;0;0m",
    bgAnsi256Nine: "\u001B[48;5;9m",
    bgReset: "\u001B[49m",
} as const;

beforeAll(() => {
    enableTestColors();
});

afterAll(() => {
    disableTestColors();
});

it("Text inherits parent Box background color", () => {
    const output = renderToString(
        <Box backgroundColor="green" alignSelf="flex-start">
            <Text>Hello World</Text>
        </Box>,
    );

    expect(output).toBe(colorizeDefault.bgGreen("Hello World"));
});

it("Text explicit background color overrides inherited", () => {
    const output = renderToString(
        <Box backgroundColor="red" alignSelf="flex-start">
            <Text backgroundColor="blue">Hello World</Text>
        </Box>,
    );

    expect(output).toBe(colorizeDefault.bgBlue("Hello World"));
});

it("Nested Box background inheritance", () => {
    const output = renderToString(
        <Box backgroundColor="red" alignSelf="flex-start">
            <Box backgroundColor="blue">
                <Text>Hello World</Text>
            </Box>
        </Box>,
    );

    expect(output).toBe(colorizeDefault.bgBlue("Hello World"));
});

it("Text without parent Box background has no inheritance", () => {
    const output = renderToString(
        <Box alignSelf="flex-start">
            <Text>Hello World</Text>
        </Box>,
    );

    expect(output).toBe("Hello World");
});

it("Multiple Text elements inherit same background", () => {
    const output = renderToString(
        <Box backgroundColor="yellow" alignSelf="flex-start">
            <Text>Hello </Text>
            <Text>World</Text>
        </Box>,
    );

    expect(output).toBe(colorizeDefault.bgYellow("Hello World"));
});

it("Mixed text with and without background inheritance", () => {
    const output = renderToString(
        <Box backgroundColor="green" alignSelf="flex-start">
            <Text>Inherited </Text>
            <Text backgroundColor="">No BG </Text>
            <Text backgroundColor="red">Red BG</Text>
        </Box>,
    );

    expect(output).toBe(colorizeDefault.bgGreen("Inherited ") + "No BG " + colorizeDefault.bgRed("Red BG"));
});

it("Complex nested structure with background inheritance", () => {
    const output = renderToString(
        <Box backgroundColor="yellow" alignSelf="flex-start">
            <Box>
                <Text>Outer: </Text>
                <Box backgroundColor="blue">
                    <Text>Inner: </Text>
                    <Text backgroundColor="red">Explicit</Text>
                </Box>
            </Box>
        </Box>,
    );

    expect(output).toBe(`${ansi.bgYellow}Outer: ${ansi.bgBlue}Inner: ${ansi.bgRed}Explicit${ansi.bgReset}`);
});

it("Box background with standard color", () => {
    const output = renderToString(
        <Box backgroundColor="red" alignSelf="flex-start">
            <Text>Hello</Text>
        </Box>,
    );

    expect(output).toBe(colorizeDefault.bgRed("Hello"));
});

it("Box background with hex color", () => {
    const output = renderToString(
        <Box backgroundColor="#FF0000" alignSelf="flex-start">
            <Text>Hello</Text>
        </Box>,
    );

    expect(output).toBe(colorizeDefault.bgHex("#FF0000")("Hello"));
});

it("Box background with rgb color", () => {
    const output = renderToString(
        <Box backgroundColor="rgb(255, 0, 0)" alignSelf="flex-start">
            <Text>Hello</Text>
        </Box>,
    );

    expect(output).toBe(colorizeDefault.bgRgb(255, 0, 0)("Hello"));
});

it("Box background with ansi256 color", () => {
    const output = renderToString(
        <Box backgroundColor="ansi256(9)" alignSelf="flex-start">
            <Text>Hello</Text>
        </Box>,
    );

    expect(output).toBe(colorizeDefault.bgAnsi256(9)("Hello"));
});

it("Box background with wide characters", () => {
    const output = renderToString(
        <Box backgroundColor="yellow" alignSelf="flex-start">
            <Text>こんにちは</Text>
        </Box>,
    );

    expect(output).toBe(colorizeDefault.bgYellow("こんにちは"));
});

it("Box background with emojis", () => {
    const output = renderToString(
        <Box backgroundColor="red" alignSelf="flex-start">
            <Text>🎉🎊</Text>
        </Box>,
    );

    expect(output).toBe(colorizeDefault.bgRed("🎉🎊"));
});

it("Box background fills entire area with standard color", () => {
    const output = renderToString(
        <Box backgroundColor="red" width={10} height={3} alignSelf="flex-start">
            <Text>Hello</Text>
        </Box>,
    );

    expect(output.includes(ansi.bgRed)).toBe(true);
    expect(output.includes(ansi.bgReset)).toBe(true);
    expect(output.includes("Hello")).toBe(true);
    expect(output.includes(`${ansi.bgRed}          ${ansi.bgReset}`)).toBe(true);
});

it("Box background fills with hex color", () => {
    const output = renderToString(
        <Box backgroundColor="#FF0000" width={10} height={3} alignSelf="flex-start">
            <Text>Hello</Text>
        </Box>,
    );

    expect(output.includes("Hello")).toBe(true);
    expect(output.includes(ansi.bgHexRed)).toBe(true);
    expect(output.includes(ansi.bgReset)).toBe(true);
});

it("Box background fills with rgb color", () => {
    const output = renderToString(
        <Box backgroundColor="rgb(255, 0, 0)" width={10} height={3} alignSelf="flex-start">
            <Text>Hello</Text>
        </Box>,
    );

    expect(output.includes("Hello")).toBe(true);
    expect(output.includes(ansi.bgHexRed)).toBe(true);
    expect(output.includes(ansi.bgReset)).toBe(true);
});

it("Box background fills with ansi256 color", () => {
    const output = renderToString(
        <Box backgroundColor="ansi256(9)" width={10} height={3} alignSelf="flex-start">
            <Text>Hello</Text>
        </Box>,
    );

    expect(output.includes("Hello")).toBe(true);
    expect(output.includes(ansi.bgAnsi256Nine)).toBe(true);
    expect(output.includes(ansi.bgReset)).toBe(true);
});

it("Box background with border fills content area", () => {
    const output = renderToString(
        <Box backgroundColor="cyan" borderStyle="round" width={10} height={5} alignSelf="flex-start">
            <Text>Hi</Text>
        </Box>,
    );

    expect(output.includes("Hi")).toBe(true);
    expect(output.includes(ansi.bgCyan)).toBe(true);
    expect(output.includes(ansi.bgReset)).toBe(true);
    expect(output.includes("╭")).toBe(true);
    expect(output.includes("╮")).toBe(true);
});

it("Box background with padding fills entire padded area", () => {
    const output = renderToString(
        <Box backgroundColor="magenta" padding={1} width={10} height={5} alignSelf="flex-start">
            <Text>Hi</Text>
        </Box>,
    );

    expect(output.includes("Hi")).toBe(true);
    expect(output.includes(ansi.bgMagenta)).toBe(true);
    expect(output.includes(ansi.bgReset)).toBe(true);
});

it("Box background with center alignment fills entire area", () => {
    const output = renderToString(
        <Box backgroundColor="blue" width={10} height={3} justifyContent="center" alignSelf="flex-start">
            <Text>Hi</Text>
        </Box>,
    );

    expect(output.includes("Hi")).toBe(true);
    expect(output.includes(ansi.bgBlue)).toBe(true);
    expect(output.includes(ansi.bgReset)).toBe(true);
});

it("Box background with column layout fills entire area", () => {
    const output = renderToString(
        <Box backgroundColor="green" flexDirection="column" width={10} height={5} alignSelf="flex-start">
            <Text>Line 1</Text>
            <Text>Line 2</Text>
        </Box>,
    );

    expect(output.includes("Line 1")).toBe(true);
    expect(output.includes("Line 2")).toBe(true);
    expect(output.includes(ansi.bgGreen)).toBe(true);
    expect(output.includes(ansi.bgReset)).toBe(true);
});

it("Box background updates on rerender", () => {
    const stdout = createStdout();

    function Test({ bgColor }: { readonly bgColor?: string }) {
        return (
            <Box backgroundColor={bgColor} alignSelf="flex-start">
                <Text>Hello</Text>
            </Box>
        );
    }

    const { rerender } = render(<Test />, {
        stdout,
        debug: true,
    });

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("Hello");

    rerender(<Test bgColor="green" />);
    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(colorizeDefault.bgGreen("Hello"));

    rerender(<Test />);
    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("Hello");
});

it("Text inherits parent Box background color - concurrent", async () => {
    const output = await renderToStringAsync(
        <Box backgroundColor="green" alignSelf="flex-start">
            <Text>Hello World</Text>
        </Box>,
    );

    expect(output).toBe(colorizeDefault.bgGreen("Hello World"));
});

it("Nested Box background inheritance - concurrent", async () => {
    const output = await renderToStringAsync(
        <Box backgroundColor="red" alignSelf="flex-start">
            <Box backgroundColor="blue">
                <Text>Hello World</Text>
            </Box>
        </Box>,
    );

    expect(output).toBe(colorizeDefault.bgBlue("Hello World"));
});

it("Box background with hex color - concurrent", async () => {
    const output = await renderToStringAsync(
        <Box backgroundColor="#FF0000" alignSelf="flex-start">
            <Text>Hello</Text>
        </Box>,
    );

    expect(output).toBe(colorizeDefault.bgHex("#FF0000")("Hello"));
});

it("Box background updates on rerender - concurrent", async () => {
    function Test({ bgColor }: { readonly bgColor?: string }) {
        return (
            <Box backgroundColor={bgColor} alignSelf="flex-start">
                <Text>Hello</Text>
            </Box>
        );
    }

    const { getOutput, rerenderAsync } = await renderAsync(<Test />);

    expect(getOutput()).toBe("Hello");

    await rerenderAsync(<Test bgColor="green" />);
    expect(getOutput()).toBe(colorizeDefault.bgGreen("Hello"));

    await rerenderAsync(<Test />);
    expect(getOutput()).toBe("Hello");
});

it("Box backgroundColor fills full width on every line when text wraps", () => {
    const output = renderToString(
        <Box backgroundColor="red" width={10} alignSelf="flex-start">
            <Text>Hello World!!</Text>
        </Box>,
    );

    expect(output).toBe(`${ansi.bgRed}Hello     ${ansi.bgReset}\n${ansi.bgRed}World!!   ${ansi.bgReset}`);
});

it("Text-only backgroundColor colors text content but does not fill Box width", () => {
    const output = renderToString(
        <Box width={10} alignSelf="flex-start">
            <Text backgroundColor="red">Hello World!!</Text>
        </Box>,
    );

    expect(output).toBe(`${ansi.bgRed}Hello ${ansi.bgReset}\n${ansi.bgRed}World!!${ansi.bgReset}`);
});
