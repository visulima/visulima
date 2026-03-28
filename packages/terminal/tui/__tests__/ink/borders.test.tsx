import { strip } from "@visulima/ansi";
import { boxen } from "@visulima/boxen";
import { blue, bold, dim, green } from "@visulima/colorize";
import { indent as indentString } from "@visulima/string";
import cliBoxes from "cli-boxes";
import { describe, expect, it } from "vitest";

import { Box, render, Text } from "../../src/ink/index";
import createStdout from "../helpers/ink-create-stdout";
import { renderToString, renderToStringAsync } from "../helpers/ink-render";
import { renderAsync } from "../helpers/ink-test-renderer";

describe("borders", () => {
    it("single node - full width box", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box borderStyle="round">
                <Text>Hello World</Text>
            </Box>,
        );

        expect(output).toBe(boxen("Hello World", { borderStyle: "round", width: 100 }));
    });

    it("single node - full width box with colorful border", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box borderColor="green" borderStyle="round">
                <Text>Hello World</Text>
            </Box>,
        );

        expect(strip(output)).toBe(
            strip(
                boxen("Hello World", {
                    borderStyle: "round",
                    width: 100,
                }),
            ),
        );
    });

    it("single node - fit-content box", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignSelf="flex-start" borderStyle="round">
                <Text>Hello World</Text>
            </Box>,
        );

        expect(output).toBe(boxen("Hello World", { borderStyle: "round" }));
    });

    it("single node - fit-content box with wide characters", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignSelf="flex-start" borderStyle="round">
                <Text>こんにちは</Text>
            </Box>,
        );

        expect(output).toBe(boxen("こんにちは", { borderStyle: "round" }));
    });

    it("single node - fit-content box with emojis", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignSelf="flex-start" borderStyle="round">
                <Text>🌊🌊</Text>
            </Box>,
        );

        expect(output).toBe(boxen("🌊🌊", { borderStyle: "round" }));
    });

    it("single node - fit-content box with variation selector emojis", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignSelf="flex-start" borderStyle="round">
                <Text>🌡️⚠️✅</Text>
            </Box>,
        );

        expect(output).toBe(boxen("🌡️⚠️✅", { borderStyle: "round" }));
    });

    it("single node - fixed width box", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box borderStyle="round" width={20}>
                <Text>Hello World</Text>
            </Box>,
        );

        expect(output).toBe(boxen("Hello World".padEnd(18, " "), { borderStyle: "round" }));
    });

    it("single node - fixed width and height box", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box borderStyle="round" height={20} width={20}>
                <Text>Hello World</Text>
            </Box>,
        );

        expect(output).toBe(
            boxen("Hello World".padEnd(18, " ") + "\n".repeat(17), {
                borderStyle: "round",
            }),
        );
    });

    it("single node - box with padding", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignSelf="flex-start" borderStyle="round" padding={1}>
                <Text>Hello World</Text>
            </Box>,
        );

        expect(output).toBe(boxen("\n Hello World \n", { borderStyle: "round" }));
    });

    it("single node - box with horizontal alignment", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box borderStyle="round" justifyContent="center" width={20}>
                <Text>Hello World</Text>
            </Box>,
        );

        expect(output).toBe(boxen("   Hello World    ", { borderStyle: "round" }));
    });

    it("single node - box with vertical alignment", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignItems="center" alignSelf="flex-start" borderStyle="round" height={20}>
                <Text>Hello World</Text>
            </Box>,
        );

        expect(output).toBe(
            boxen(`${"\n".repeat(8)}Hello World${"\n".repeat(9)}`, {
                borderStyle: "round",
            }),
        );
    });

    it("single node - box with wrapping", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box borderStyle="round" width={10}>
                <Text>Hello World</Text>
            </Box>,
        );

        expect(output).toBe(boxen("Hello   \nWorld", { borderStyle: "round" }));
    });

    it("multiple nodes - full width box", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box borderStyle="round">
                <Text>
                    {"Hello "}
                    World
                </Text>
            </Box>,
        );

        expect(output).toBe(boxen("Hello World", { borderStyle: "round", width: 100 }));
    });

    it("multiple nodes - full width box with colorful border", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box borderColor="green" borderStyle="round">
                <Text>
                    {"Hello "}
                    World
                </Text>
            </Box>,
        );

        expect(strip(output)).toBe(
            strip(
                boxen("Hello World", {
                    borderStyle: "round",
                    width: 100,
                }),
            ),
        );
    });

    it("multiple nodes - fit-content box", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignSelf="flex-start" borderStyle="round">
                <Text>
                    {"Hello "}
                    World
                </Text>
            </Box>,
        );

        expect(output).toBe(boxen("Hello World", { borderStyle: "round" }));
    });

    it("multiple nodes - fixed width box", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box borderStyle="round" width={20}>
                <Text>
                    {"Hello "}
                    World
                </Text>
            </Box>,
        );

        expect(output).toBe(boxen("Hello World".padEnd(18, " "), { borderStyle: "round" }));
    });

    it("multiple nodes - fixed width and height box", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box borderStyle="round" height={20} width={20}>
                <Text>
                    {"Hello "}
                    World
                </Text>
            </Box>,
        );

        expect(output).toBe(
            boxen("Hello World".padEnd(18, " ") + "\n".repeat(17), {
                borderStyle: "round",
            }),
        );
    });

    it("multiple nodes - box with padding", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignSelf="flex-start" borderStyle="round" padding={1}>
                <Text>
                    {"Hello "}
                    World
                </Text>
            </Box>,
        );

        expect(output).toBe(boxen("\n Hello World \n", { borderStyle: "round" }));
    });

    it("multiple nodes - box with horizontal alignment", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box borderStyle="round" justifyContent="center" width={20}>
                <Text>
                    {"Hello "}
                    World
                </Text>
            </Box>,
        );

        expect(output).toBe(boxen("   Hello World    ", { borderStyle: "round" }));
    });

    it("multiple nodes - box with vertical alignment", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignItems="center" alignSelf="flex-start" borderStyle="round" height={20}>
                <Text>
                    {"Hello "}
                    World
                </Text>
            </Box>,
        );

        expect(output).toBe(
            boxen(`${"\n".repeat(8)}Hello World${"\n".repeat(9)}`, {
                borderStyle: "round",
            }),
        );
    });

    it("multiple nodes - box with wrapping", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box borderStyle="round" width={10}>
                <Text>
                    {"Hello "}
                    World
                </Text>
            </Box>,
        );

        expect(output).toBe(boxen("Hello   \nWorld", { borderStyle: "round" }));
    });

    it("multiple nodes - box with wrapping and long first node", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box borderStyle="round" width={10}>
                <Text>Helloooooo World</Text>
            </Box>,
        );

        expect(output).toBe(boxen("Helloooo\noo World", { borderStyle: "round" }));
    });

    it("multiple nodes - box with wrapping and very long first node", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box borderStyle="round" width={10}>
                <Text>Hellooooooooooooo World</Text>
            </Box>,
        );

        expect(output).toBe(boxen("Helloooo\noooooooo\no World", { borderStyle: "round" }));
    });

    it("nested boxes", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box borderStyle="round" padding={1} width={40}>
                <Box borderStyle="round" justifyContent="center" padding={1}>
                    <Text>Hello World</Text>
                </Box>
            </Box>,
        );

        const nestedBox = indentString(boxen("\n Hello World \n", { borderStyle: "round" }), 1);

        expect(output).toBe(boxen(`${" ".repeat(38)}\n${nestedBox}\n`, { borderStyle: "round" }));
    });

    it("nested boxes - fit-content box with wide characters on flex-direction row", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignSelf="flex-start" borderStyle="round">
                <Box borderStyle="round">
                    <Text>ミスター</Text>
                </Box>
                <Box borderStyle="round">
                    <Text>スポック</Text>
                </Box>
                <Box borderStyle="round">
                    <Text>カーク船長</Text>
                </Box>
            </Box>,
        );

        const box1 = boxen("ミスター", { borderStyle: "round" });
        const box2 = boxen("スポック", { borderStyle: "round" });
        const box3 = boxen("カーク船長", { borderStyle: "round" });

        const expected = boxen(
            box1
                .split("\n")
                .map((line, index) => line + box2.split("\n")[index]! + box3.split("\n")[index]!)
                .join("\n"),
            { borderStyle: "round" },
        );

        expect(output).toBe(expected);
    });

    // TODO: @visulima/boxen measures emoji widths differently than the ink renderer
    it.skip("nested boxes - fit-content box with emojis on flex-direction row", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignSelf="flex-start" borderStyle="round">
                <Box borderStyle="round">
                    <Text>🦾</Text>
                </Box>
                <Box borderStyle="round">
                    <Text>🌏</Text>
                </Box>
                <Box borderStyle="round">
                    <Text>😋</Text>
                </Box>
            </Box>,
        );

        const box1 = boxen("🦾", { borderStyle: "round" });
        const box2 = boxen("🌏", { borderStyle: "round" });
        const box3 = boxen("😋", { borderStyle: "round" });

        const expected = boxen(
            box1
                .split("\n")
                .map((line, index) => line + box2.split("\n")[index]! + box3.split("\n")[index]!)
                .join("\n"),
            { borderStyle: "round" },
        );

        expect(strip(output)).toBe(strip(expected));
    });

    it("nested boxes - fit-content box with wide characters on flex-direction column", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignSelf="flex-start" borderStyle="round" flexDirection="column">
                <Box borderStyle="round">
                    <Text>ミスター</Text>
                </Box>
                <Box borderStyle="round">
                    <Text>スポック</Text>
                </Box>
                <Box borderStyle="round">
                    <Text>カーク船長</Text>
                </Box>
            </Box>,
        );

        const expected = boxen(
            `${boxen("ミスター  ", { borderStyle: "round" })}\n${boxen("スポック  ", { borderStyle: "round" })}\n${boxen("カーク船長", {
                borderStyle: "round",
            })}`,
            { borderStyle: "round" },
        );

        expect(output).toBe(expected);
    });

    // TODO: @visulima/boxen measures emoji widths differently than the ink renderer
    it.skip("nested boxes - fit-content box with emojis on flex-direction column", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignSelf="flex-start" borderStyle="round" flexDirection="column">
                <Box borderStyle="round">
                    <Text>🦾</Text>
                </Box>
                <Box borderStyle="round">
                    <Text>🌏</Text>
                </Box>
                <Box borderStyle="round">
                    <Text>😋</Text>
                </Box>
            </Box>,
        );

        const expected = boxen(`${boxen("🦾", { borderStyle: "round" })}\n${boxen("🌏", { borderStyle: "round" })}\n${boxen("😋", { borderStyle: "round" })}`, {
            borderStyle: "round",
        });

        expect(strip(output)).toBe(strip(expected));
    });

    it("render border after update", () => {
        expect.hasAssertions();

        const stdout = createStdout();

        const Test = ({ borderColor }: { readonly borderColor?: string }) => (
            <Box borderColor={borderColor} borderStyle="round">
                <Text>Hello World</Text>
            </Box>
        );

        const { rerender } = render(<Test />, {
            debug: true,
            stdout,
        });

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(boxen("Hello World", { borderStyle: "round", width: 100 }));

        rerender(<Test borderColor="green" />);

        expect(strip((stdout.write as any).mock.calls.at(-1)[0])).toBe(
            strip(
                boxen("Hello World", {
                    borderStyle: "round",
                    width: 100,
                }),
            ),
        );

        rerender(<Test />);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(
            boxen("Hello World", {
                borderStyle: "round",
                width: 100,
            }),
        );
    });

    it("render border edge changes after update when borderStyle is unchanged", () => {
        expect.hasAssertions();

        const stdout = createStdout();

        const Test = ({ borderTop }: { readonly borderTop?: boolean }) => (
            <Box alignSelf="flex-start" borderStyle="round" borderTop={borderTop}>
                <Text>Content</Text>
            </Box>
        );

        const { rerender } = render(<Test />, {
            debug: true,
            stdout,
        });

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(boxen("Content", { borderStyle: "round" }));

        rerender(<Test borderTop={false} />);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(
            [
                `${cliBoxes.round.left}Content${cliBoxes.round.right}`,
                `${cliBoxes.round.bottomLeft}${cliBoxes.round.bottom.repeat(7)}${cliBoxes.round.bottomRight}`,
            ].join("\n"),
        );

        rerender(<Test />);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(boxen("Content", { borderStyle: "round" }));
    });

    it("hide top border", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignItems="flex-start" flexDirection="column">
                <Text>Above</Text>
                <Box borderStyle="round" borderTop={false}>
                    <Text>Content</Text>
                </Box>
                <Text>Below</Text>
            </Box>,
        );

        expect(output).toBe(
            [
                "Above",
                `${cliBoxes.round.left}Content${cliBoxes.round.right}`,
                `${cliBoxes.round.bottomLeft}${cliBoxes.round.bottom.repeat(7)}${cliBoxes.round.bottomRight}`,
                "Below",
            ].join("\n"),
        );
    });

    it("hide bottom border", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignItems="flex-start" flexDirection="column">
                <Text>Above</Text>
                <Box borderBottom={false} borderStyle="round">
                    <Text>Content</Text>
                </Box>
                <Text>Below</Text>
            </Box>,
        );

        expect(output).toBe(
            [
                "Above",
                `${cliBoxes.round.topLeft}${cliBoxes.round.top.repeat(7)}${cliBoxes.round.topRight}`,
                `${cliBoxes.round.left}Content${cliBoxes.round.right}`,
                "Below",
            ].join("\n"),
        );
    });

    it("hide top and bottom borders", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignItems="flex-start" flexDirection="column">
                <Text>Above</Text>
                <Box borderBottom={false} borderStyle="round" borderTop={false}>
                    <Text>Content</Text>
                </Box>
                <Text>Below</Text>
            </Box>,
        );

        expect(output).toBe(["Above", `${cliBoxes.round.left}Content${cliBoxes.round.right}`, "Below"].join("\n"));
    });

    it("hide left border", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignItems="flex-start" flexDirection="column">
                <Text>Above</Text>
                <Box borderLeft={false} borderStyle="round">
                    <Text>Content</Text>
                </Box>
                <Text>Below</Text>
            </Box>,
        );

        expect(output).toBe(
            [
                "Above",
                `${cliBoxes.round.top.repeat(7)}${cliBoxes.round.topRight}`,
                `Content${cliBoxes.round.right}`,
                `${cliBoxes.round.bottom.repeat(7)}${cliBoxes.round.bottomRight}`,
                "Below",
            ].join("\n"),
        );
    });

    it("hide right border", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignItems="flex-start" flexDirection="column">
                <Text>Above</Text>
                <Box borderRight={false} borderStyle="round">
                    <Text>Content</Text>
                </Box>
                <Text>Below</Text>
            </Box>,
        );

        expect(output).toBe(
            [
                "Above",
                `${cliBoxes.round.topLeft}${cliBoxes.round.top.repeat(7)}`,
                `${cliBoxes.round.left}Content`,
                `${cliBoxes.round.bottomLeft}${cliBoxes.round.bottom.repeat(7)}`,
                "Below",
            ].join("\n"),
        );
    });

    it("hide left and right border", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignItems="flex-start" flexDirection="column">
                <Text>Above</Text>
                <Box borderLeft={false} borderRight={false} borderStyle="round">
                    <Text>Content</Text>
                </Box>
                <Text>Below</Text>
            </Box>,
        );

        expect(output).toBe(["Above", cliBoxes.round.top.repeat(7), "Content", cliBoxes.round.bottom.repeat(7), "Below"].join("\n"));
    });

    it("hide all borders", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignItems="flex-start" flexDirection="column">
                <Text>Above</Text>
                <Box borderBottom={false} borderLeft={false} borderRight={false} borderStyle="round" borderTop={false}>
                    <Text>Content</Text>
                </Box>
                <Text>Below</Text>
            </Box>,
        );

        expect(output).toBe(["Above", "Content", "Below"].join("\n"));
    });

    it("change color of top border", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignItems="flex-start" flexDirection="column">
                <Text>Above</Text>
                <Box borderStyle="round" borderTopColor="green">
                    <Text>Content</Text>
                </Box>
                <Text>Below</Text>
            </Box>,
        );

        expect(output).toBe(
            [
                "Above",
                green(`${cliBoxes.round.topLeft}${cliBoxes.round.top.repeat(7)}${cliBoxes.round.topRight}`),
                `${cliBoxes.round.left}Content${cliBoxes.round.right}`,
                `${cliBoxes.round.bottomLeft}${cliBoxes.round.bottom.repeat(7)}${cliBoxes.round.bottomRight}`,
                "Below",
            ].join("\n"),
        );
    });

    it("change color of bottom border", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignItems="flex-start" flexDirection="column">
                <Text>Above</Text>
                <Box borderBottomColor="green" borderStyle="round">
                    <Text>Content</Text>
                </Box>
                <Text>Below</Text>
            </Box>,
        );

        expect(output).toBe(
            [
                "Above",
                `${cliBoxes.round.topLeft}${cliBoxes.round.top.repeat(7)}${cliBoxes.round.topRight}`,
                `${cliBoxes.round.left}Content${cliBoxes.round.right}`,
                green(`${cliBoxes.round.bottomLeft}${cliBoxes.round.bottom.repeat(7)}${cliBoxes.round.bottomRight}`),
                "Below",
            ].join("\n"),
        );
    });

    it("change color of left border", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignItems="flex-start" flexDirection="column">
                <Text>Above</Text>
                <Box borderLeftColor="green" borderStyle="round">
                    <Text>Content</Text>
                </Box>
                <Text>Below</Text>
            </Box>,
        );

        expect(output).toBe(
            [
                "Above",
                `${cliBoxes.round.topLeft}${cliBoxes.round.top.repeat(7)}${cliBoxes.round.topRight}`,
                `${green(cliBoxes.round.left)}Content${cliBoxes.round.right}`,
                `${cliBoxes.round.bottomLeft}${cliBoxes.round.bottom.repeat(7)}${cliBoxes.round.bottomRight}`,
                "Below",
            ].join("\n"),
        );
    });

    it("change color of right border", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignItems="flex-start" flexDirection="column">
                <Text>Above</Text>
                <Box borderRightColor="green" borderStyle="round">
                    <Text>Content</Text>
                </Box>
                <Text>Below</Text>
            </Box>,
        );

        expect(output).toBe(
            [
                "Above",
                `${cliBoxes.round.topLeft}${cliBoxes.round.top.repeat(7)}${cliBoxes.round.topRight}`,
                `${cliBoxes.round.left}Content${green(cliBoxes.round.right)}`,
                `${cliBoxes.round.bottomLeft}${cliBoxes.round.bottom.repeat(7)}${cliBoxes.round.bottomRight}`,
                "Below",
            ].join("\n"),
        );
    });

    it("custom border style", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box
                borderStyle={{
                    bottom: "↑",
                    bottomLeft: "↗",
                    bottomRight: "↖",
                    left: "→",
                    right: "←",
                    top: "↓",
                    topLeft: "↘",
                    topRight: "↙",
                }}
            >
                <Text>Content</Text>
            </Box>,
        );

        expect(output).toBe(boxen("Content", { borderStyle: "arrow", width: 100 }));
    });

    it("dim border color", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box borderDimColor borderStyle="round">
                <Text>Content</Text>
            </Box>,
        );

        expect(strip(output)).toBe(
            strip(
                boxen("Content", {
                    borderStyle: "round",
                    dimBorder: true,
                    width: 100,
                }),
            ),
        );
    });

    it("dim top border color", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignItems="flex-start" flexDirection="column">
                <Text>Above</Text>
                <Box borderStyle="round" borderTopDimColor>
                    <Text>Content</Text>
                </Box>
                <Text>Below</Text>
            </Box>,
        );

        expect(output).toBe(
            [
                "Above",
                dim(`${cliBoxes.round.topLeft}${cliBoxes.round.top.repeat(7)}${cliBoxes.round.topRight}`),
                `${cliBoxes.round.left}Content${cliBoxes.round.right}`,
                `${cliBoxes.round.bottomLeft}${cliBoxes.round.bottom.repeat(7)}${cliBoxes.round.bottomRight}`,
                "Below",
            ].join("\n"),
        );
    });

    it("dim bottom border color", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignItems="flex-start" flexDirection="column">
                <Text>Above</Text>
                <Box borderBottomDimColor borderStyle="round">
                    <Text>Content</Text>
                </Box>
                <Text>Below</Text>
            </Box>,
        );

        expect(output).toBe(
            [
                "Above",
                `${cliBoxes.round.topLeft}${cliBoxes.round.top.repeat(7)}${cliBoxes.round.topRight}`,
                `${cliBoxes.round.left}Content${cliBoxes.round.right}`,
                dim(`${cliBoxes.round.bottomLeft}${cliBoxes.round.bottom.repeat(7)}${cliBoxes.round.bottomRight}`),
                "Below",
            ].join("\n"),
        );
    });

    it("dim left border color", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignItems="flex-start" flexDirection="column">
                <Text>Above</Text>
                <Box borderLeftDimColor borderStyle="round">
                    <Text>Content</Text>
                </Box>
                <Text>Below</Text>
            </Box>,
        );

        expect(output).toBe(
            [
                "Above",
                `${cliBoxes.round.topLeft}${cliBoxes.round.top.repeat(7)}${cliBoxes.round.topRight}`,
                `${dim(cliBoxes.round.left)}Content${cliBoxes.round.right}`,
                `${cliBoxes.round.bottomLeft}${cliBoxes.round.bottom.repeat(7)}${cliBoxes.round.bottomRight}`,
                "Below",
            ].join("\n"),
        );
    });

    it("dim right border color", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignItems="flex-start" flexDirection="column">
                <Text>Above</Text>
                <Box borderRightDimColor borderStyle="round">
                    <Text>Content</Text>
                </Box>
                <Text>Below</Text>
            </Box>,
        );

        expect(output).toBe(
            [
                "Above",
                `${cliBoxes.round.topLeft}${cliBoxes.round.top.repeat(7)}${cliBoxes.round.topRight}`,
                `${cliBoxes.round.left}Content${dim(cliBoxes.round.right)}`,
                `${cliBoxes.round.bottomLeft}${cliBoxes.round.bottom.repeat(7)}${cliBoxes.round.bottomRight}`,
                "Below",
            ].join("\n"),
        );
    });

    it("borderDimColor does not dim styled child Text touching left edge", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignSelf="flex-start" borderDimColor borderStyle="round">
                <Text bold color="blue">
                    styled text
                </Text>
            </Box>,
        );

        const styledText = bold(blue("styled text"));

        expect(output).toContain(styledText);

        const dimmedTopBorder = dim(cliBoxes.round.topLeft + cliBoxes.round.top.repeat(11) + cliBoxes.round.topRight);

        expect(output).toContain(dimmedTopBorder);
    });

    it("single node - full width box - concurrent", async () => {
        expect.hasAssertions();

        const output = await renderToStringAsync(
            <Box borderStyle="round">
                <Text>Hello World</Text>
            </Box>,
        );

        expect(output).toBe(boxen("Hello World", { borderStyle: "round", width: 100 }));
    });

    it("single node - fit-content box - concurrent", async () => {
        expect.hasAssertions();

        const output = await renderToStringAsync(
            <Box alignSelf="flex-start" borderStyle="round">
                <Text>Hello World</Text>
            </Box>,
        );

        expect(output).toBe(boxen("Hello World", { borderStyle: "round" }));
    });

    it("nested boxes - concurrent", async () => {
        expect.hasAssertions();

        const output = await renderToStringAsync(
            <Box borderStyle="round" padding={1} width={40}>
                <Box borderStyle="round" justifyContent="center" padding={1}>
                    <Text>Hello World</Text>
                </Box>
            </Box>,
        );

        const nestedBox = indentString(boxen("\n Hello World \n", { borderStyle: "round" }), 1);

        expect(output).toBe(boxen(`${" ".repeat(38)}\n${nestedBox}\n`, { borderStyle: "round" }));
    });

    it("render border after update - concurrent", async () => {
        expect.hasAssertions();

        const Test = ({ borderColor }: { readonly borderColor?: string }) => (
            <Box borderColor={borderColor} borderStyle="round">
                <Text>Hello World</Text>
            </Box>
        );

        const { getOutput, rerenderAsync } = await renderAsync(<Test />);

        expect(getOutput()).toBe(boxen("Hello World", { borderStyle: "round", width: 100 }));

        await rerenderAsync(<Test borderColor="green" />);

        expect(strip(getOutput())).toBe(
            strip(
                boxen("Hello World", {
                    borderStyle: "round",
                    width: 100,
                }),
            ),
        );
    });
});
