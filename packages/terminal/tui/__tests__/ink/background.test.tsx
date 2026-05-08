import { bgAnsi256, bgBlue, bgGreen, bgHex, bgRed, bgRgb, bgYellow } from "@visulima/colorize";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Box, Text } from "../../src/components/index";
import { render } from "../../src/ink/index";
import createStdout from "../helpers/ink-create-stdout";
import { disableTestColors, enableTestColors } from "../helpers/ink-force-colors";
import { renderToString, renderToStringAsync } from "../helpers/ink-render";
import { renderAsync } from "../helpers/ink-test-renderer";

// ANSI escape sequences for background colors
const ansi = {
    bgAnsi256Nine: "\u001B[48;5;9m",
    bgBlue: "\u001B[44m",
    bgCyan: "\u001B[46m",
    bgGreen: "\u001B[42m",
    bgHexRed: "\u001B[48;2;255;0;0m",
    bgMagenta: "\u001B[45m",
    bgRed: "\u001B[41m",
    bgReset: "\u001B[49m",
    bgYellow: "\u001B[43m",
} as const;

describe("background", () => {
    beforeAll(() => {
        enableTestColors();
    });

    afterAll(() => {
        disableTestColors();
    });

    it("text inherits parent Box background color", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box alignSelf="flex-start" backgroundColor="green">
                <Text>Hello World</Text>
            </Box>,
        );

        expect(output).toBe(bgGreen("Hello World"));
    });

    it("text explicit background color overrides inherited", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box alignSelf="flex-start" backgroundColor="red">
                <Text backgroundColor="blue">Hello World</Text>
            </Box>,
        );

        expect(output).toBe(bgBlue("Hello World"));
    });

    it("nested Box background inheritance", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box alignSelf="flex-start" backgroundColor="red">
                <Box backgroundColor="blue">
                    <Text>Hello World</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe(bgBlue("Hello World"));
    });

    it("text without parent Box background has no inheritance", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box alignSelf="flex-start">
                <Text>Hello World</Text>
            </Box>,
        );

        expect(output).toBe("Hello World");
    });

    it("multiple Text elements inherit same background", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box alignSelf="flex-start" backgroundColor="yellow">
                <Text>Hello </Text>
                <Text>World</Text>
            </Box>,
        );

        expect(output).toBe(bgYellow("Hello World"));
    });

    it("mixed text with and without background inheritance", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box alignSelf="flex-start" backgroundColor="green">
                <Text>Inherited </Text>
                <Text backgroundColor="">No BG </Text>
                <Text backgroundColor="red">Red BG</Text>
            </Box>,
        );

        expect(output).toBe(`${bgGreen("Inherited ")}No BG ${bgRed("Red BG")}`);
    });

    it("complex nested structure with background inheritance", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box alignSelf="flex-start" backgroundColor="yellow">
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

    it("box background with standard color", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box alignSelf="flex-start" backgroundColor="red">
                <Text>Hello</Text>
            </Box>,
        );

        expect(output).toBe(bgRed("Hello"));
    });

    it("box background with hex color", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box alignSelf="flex-start" backgroundColor="#FF0000">
                <Text>Hello</Text>
            </Box>,
        );

        expect(output).toBe(bgHex("#FF0000")("Hello"));
    });

    it("box background with rgb color", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box alignSelf="flex-start" backgroundColor="rgb(255, 0, 0)">
                <Text>Hello</Text>
            </Box>,
        );

        expect(output).toBe(bgRgb(255, 0, 0)("Hello"));
    });

    it("box background with ansi256 color", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box alignSelf="flex-start" backgroundColor="ansi256(9)">
                <Text>Hello</Text>
            </Box>,
        );

        expect(output).toBe(bgAnsi256(9)("Hello"));
    });

    it("box background with wide characters", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box alignSelf="flex-start" backgroundColor="yellow">
                <Text>こんにちは</Text>
            </Box>,
        );

        expect(output).toBe(bgYellow("こんにちは"));
    });

    it("box background with emojis", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box alignSelf="flex-start" backgroundColor="red">
                <Text>🎉🎊</Text>
            </Box>,
        );

        expect(output).toBe(bgRed("🎉🎊"));
    });

    it("box background fills entire area with standard color", () => {
        expect.assertions(4);

        const output = renderToString(
            <Box alignSelf="flex-start" backgroundColor="red" height={3} width={10}>
                <Text>Hello</Text>
            </Box>,
        );

        expect(output).toContain(ansi.bgRed);
        expect(output).toContain(ansi.bgReset);
        expect(output).toContain("Hello");
        expect(output).toContain(`${ansi.bgRed}          ${ansi.bgReset}`);
    });

    it("box background fills with hex color", () => {
        expect.assertions(3);

        const output = renderToString(
            <Box alignSelf="flex-start" backgroundColor="#FF0000" height={3} width={10}>
                <Text>Hello</Text>
            </Box>,
        );

        expect(output).toContain("Hello");
        expect(output).toContain(ansi.bgHexRed);
        expect(output).toContain(ansi.bgReset);
    });

    it("box background fills with rgb color", () => {
        expect.assertions(3);

        const output = renderToString(
            <Box alignSelf="flex-start" backgroundColor="rgb(255, 0, 0)" height={3} width={10}>
                <Text>Hello</Text>
            </Box>,
        );

        expect(output).toContain("Hello");
        expect(output).toContain(ansi.bgHexRed);
        expect(output).toContain(ansi.bgReset);
    });

    it("box background fills with ansi256 color", () => {
        expect.assertions(3);

        const output = renderToString(
            <Box alignSelf="flex-start" backgroundColor="ansi256(9)" height={3} width={10}>
                <Text>Hello</Text>
            </Box>,
        );

        expect(output).toContain("Hello");
        expect(output).toContain(ansi.bgAnsi256Nine);
        expect(output).toContain(ansi.bgReset);
    });

    it("box background with border fills content area", () => {
        expect.assertions(5);

        const output = renderToString(
            <Box alignSelf="flex-start" backgroundColor="cyan" borderStyle="round" height={5} width={10}>
                <Text>Hi</Text>
            </Box>,
        );

        expect(output).toContain("Hi");
        expect(output).toContain(ansi.bgCyan);
        expect(output).toContain(ansi.bgReset);
        expect(output).toContain("╭");
        expect(output).toContain("╮");
    });

    it("box background with padding fills entire padded area", () => {
        expect.assertions(3);

        const output = renderToString(
            <Box alignSelf="flex-start" backgroundColor="magenta" height={5} padding={1} width={10}>
                <Text>Hi</Text>
            </Box>,
        );

        expect(output).toContain("Hi");
        expect(output).toContain(ansi.bgMagenta);
        expect(output).toContain(ansi.bgReset);
    });

    it("box background with center alignment fills entire area", () => {
        expect.assertions(3);

        const output = renderToString(
            <Box alignSelf="flex-start" backgroundColor="blue" height={3} justifyContent="center" width={10}>
                <Text>Hi</Text>
            </Box>,
        );

        expect(output).toContain("Hi");
        expect(output).toContain(ansi.bgBlue);
        expect(output).toContain(ansi.bgReset);
    });

    it("box background with column layout fills entire area", () => {
        expect.assertions(4);

        const output = renderToString(
            <Box alignSelf="flex-start" backgroundColor="green" flexDirection="column" height={5} width={10}>
                <Text>Line 1</Text>
                <Text>Line 2</Text>
            </Box>,
        );

        expect(output).toContain("Line 1");
        expect(output).toContain("Line 2");
        expect(output).toContain(ansi.bgGreen);
        expect(output).toContain(ansi.bgReset);
    });

    it("box background updates on rerender", () => {
        expect.assertions(3);

        const stdout = createStdout();

        const Test = ({ bgColor }: { readonly bgColor?: string }) => (
            <Box alignSelf="flex-start" backgroundColor={bgColor}>
                <Text>Hello</Text>
            </Box>
        );

        const { rerender } = render(<Test />, {
            debug: true,
            stdout,
        });

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("Hello");

        rerender(<Test bgColor="green" />);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(bgGreen("Hello"));

        rerender(<Test />);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("Hello");
    });

    it("text inherits parent Box background color - concurrent", async () => {
        expect.assertions(1);

        const output = await renderToStringAsync(
            <Box alignSelf="flex-start" backgroundColor="green">
                <Text>Hello World</Text>
            </Box>,
        );

        expect(output).toBe(bgGreen("Hello World"));
    });

    it("nested Box background inheritance - concurrent", async () => {
        expect.assertions(1);

        const output = await renderToStringAsync(
            <Box alignSelf="flex-start" backgroundColor="red">
                <Box backgroundColor="blue">
                    <Text>Hello World</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe(bgBlue("Hello World"));
    });

    it("box background with hex color - concurrent", async () => {
        expect.assertions(1);

        const output = await renderToStringAsync(
            <Box alignSelf="flex-start" backgroundColor="#FF0000">
                <Text>Hello</Text>
            </Box>,
        );

        expect(output).toBe(bgHex("#FF0000")("Hello"));
    });

    it("box background updates on rerender - concurrent", async () => {
        expect.assertions(3);

        const Test = ({ bgColor }: { readonly bgColor?: string }) => (
            <Box alignSelf="flex-start" backgroundColor={bgColor}>
                <Text>Hello</Text>
            </Box>
        );

        const { getOutput, rerenderAsync } = await renderAsync(<Test />);

        expect(getOutput()).toBe("Hello");

        await rerenderAsync(<Test bgColor="green" />);

        expect(getOutput()).toBe(bgGreen("Hello"));

        await rerenderAsync(<Test />);

        expect(getOutput()).toBe("Hello");
    });

    it("box backgroundColor fills full width on every line when text wraps", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box alignSelf="flex-start" backgroundColor="red" width={10}>
                <Text>Hello World!!</Text>
            </Box>,
        );

        expect(output).toBe(`${ansi.bgRed}Hello     ${ansi.bgReset}\n${ansi.bgRed}World!!   ${ansi.bgReset}`);
    });

    it("text-only backgroundColor colors text content but does not fill Box width", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box alignSelf="flex-start" width={10}>
                <Text backgroundColor="red">Hello World!!</Text>
            </Box>,
        );

        expect(output).toBe(`${ansi.bgRed}Hello ${ansi.bgReset}\n${ansi.bgRed}World!!${ansi.bgReset}`);
    });

    it("background does not mutate empty line cache", () => {
        expect.assertions(2);

        const output = renderToString(
            <Box flexDirection="column">
                <Box backgroundColor="red" width={10}>
                    <Text>A</Text>
                </Box>
                <Box width={10}>
                    <Text>B</Text>
                </Box>
            </Box>,
        );

        expect(output).toContain(`${ansi.bgRed}A${" ".repeat(9)}${ansi.bgReset}`);
        expect(output).toBe(`${ansi.bgRed}A${" ".repeat(9)}${ansi.bgReset}\nB`);
    });
});
