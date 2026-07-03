import type { Options } from "@visulima/boxen";
import { boxen } from "@visulima/boxen";
import { slice as sliceAnsi } from "@visulima/string";
import { describe, expect, it } from "vitest";

import { Box, Text } from "../../src/components/index";
import { renderToString, renderToStringAsync } from "../helpers/ink-render";

const box = (text: string, options?: Options): string =>
    boxen(text, {
        ...options,
        borderStyle: "round",
    });

const clipX = (text: string, columns: number): string =>
    text
        .split("\n")
        .map((line) => sliceAnsi(line, 0, columns).trim())
        .join("\n");

describe("overflow", () => {
    it("overflowX - single text node in a box inside overflow container", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box overflowX="hidden" width={6}>
                <Box flexShrink={0} width={16}>
                    <Text>Hello World</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("Hello");
    });

    it("overflowX - single text node inside overflow container with border", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box borderStyle="round" overflowX="hidden" width={6}>
                <Box flexShrink={0} width={16}>
                    <Text>Hello World</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe(box("Hell"));
    });

    it("overflowX - single text node in a box with border inside overflow container", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box overflowX="hidden" width={6}>
                <Box borderStyle="round" flexShrink={0} width={16}>
                    <Text>Hello World</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe(clipX(box("Hello"), 6));
    });

    it("overflowX - multiple text nodes in a box inside overflow container", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box overflowX="hidden" width={6}>
                <Box flexShrink={0} width={12}>
                    <Text>Hello </Text>
                    <Text>World</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("Hello");
    });

    it("overflowX - multiple text nodes in a box inside overflow container with border", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box borderStyle="round" overflowX="hidden" width={8}>
                <Box flexShrink={0} width={12}>
                    <Text>Hello </Text>
                    <Text>World</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe(box("Hello "));
    });

    it("overflowX - multiple text nodes in a box with border inside overflow container", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box overflowX="hidden" width={8}>
                <Box borderStyle="round" flexShrink={0} width={12}>
                    <Text>Hello </Text>
                    <Text>World</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe(clipX(box("HelloWo\n"), 8));
    });

    it("overflowX - multiple boxes inside overflow container", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box overflowX="hidden" width={6}>
                <Box flexShrink={0} width={6}>
                    <Text>Hello </Text>
                </Box>
                <Box flexShrink={0} width={6}>
                    <Text>World</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("Hello");
    });

    it("overflowX - multiple boxes inside overflow container with border", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box borderStyle="round" overflowX="hidden" width={8}>
                <Box flexShrink={0} width={6}>
                    <Text>Hello </Text>
                </Box>
                <Box flexShrink={0} width={6}>
                    <Text>World</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe(box("Hello "));
    });

    it("overflowX - box before left edge of overflow container", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box overflowX="hidden" width={6}>
                <Box flexShrink={0} marginLeft={-12} width={6}>
                    <Text>Hello</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("");
    });

    it("overflowX - box before left edge of overflow container with border", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box borderStyle="round" overflowX="hidden" width={6}>
                <Box flexShrink={0} marginLeft={-12} width={6}>
                    <Text>Hello</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe(box(" ".repeat(4)));
    });

    it("overflowX - box intersecting with left edge of overflow container", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box overflowX="hidden" width={6}>
                <Box flexShrink={0} marginLeft={-3} width={12}>
                    <Text>Hello World</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("lo Wor");
    });

    it("overflowX - box intersecting with left edge of overflow container with border", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box borderStyle="round" overflowX="hidden" width={8}>
                <Box flexShrink={0} marginLeft={-3} width={12}>
                    <Text>Hello World</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe(box("lo Wor"));
    });

    it("overflowX - box after right edge of overflow container", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box overflowX="hidden" width={6}>
                <Box flexShrink={0} marginLeft={6} width={6}>
                    <Text>Hello</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("");
    });

    it("overflowX - box intersecting with right edge of overflow container", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box overflowX="hidden" width={6}>
                <Box flexShrink={0} marginLeft={3} width={6}>
                    <Text>Hello</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("   Hel");
    });

    it("overflowY - single text node inside overflow container", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={1} overflowY="hidden">
                <Text>
                    Hello
                    {"\n"}
                    World
                </Text>
            </Box>,
        );

        expect(output).toBe("Hello");
    });

    it("overflowY - single text node inside overflow container with border", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box borderStyle="round" height={3} overflowY="hidden" width={20}>
                <Text>
                    Hello
                    {"\n"}
                    World
                </Text>
            </Box>,
        );

        expect(output).toBe(box("Hello".padEnd(18, " ")));
    });

    it("overflowY - multiple boxes inside overflow container", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexDirection="column" height={2} overflowY="hidden">
                <Box flexShrink={0}>
                    <Text>Line #1</Text>
                </Box>
                <Box flexShrink={0}>
                    <Text>Line #2</Text>
                </Box>
                <Box flexShrink={0}>
                    <Text>Line #3</Text>
                </Box>
                <Box flexShrink={0}>
                    <Text>Line #4</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("Line #1\nLine #2");
    });

    it("overflowY - multiple boxes inside overflow container with border", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box borderStyle="round" flexDirection="column" height={4} overflowY="hidden" width={9}>
                <Box flexShrink={0}>
                    <Text>Line #1</Text>
                </Box>
                <Box flexShrink={0}>
                    <Text>Line #2</Text>
                </Box>
                <Box flexShrink={0}>
                    <Text>Line #3</Text>
                </Box>
                <Box flexShrink={0}>
                    <Text>Line #4</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe(box("Line #1\nLine #2"));
    });

    it("overflowY - box above top edge of overflow container", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={1} overflowY="hidden">
                <Box flexShrink={0} height={2} marginTop={-2}>
                    <Text>
                        Hello
                        {"\n"}
                        World
                    </Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("");
    });

    it("overflowY - box above top edge of overflow container with border", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box borderStyle="round" height={3} overflowY="hidden" width={7}>
                <Box flexShrink={0} height={2} marginTop={-3}>
                    <Text>
                        Hello
                        {"\n"}
                        World
                    </Text>
                </Box>
            </Box>,
        );

        expect(output).toBe(box(" ".repeat(5)));
    });

    it("overflowY - box intersecting with top edge of overflow container", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={1} overflowY="hidden">
                <Box flexShrink={0} height={2} marginTop={-1}>
                    <Text>
                        Hello
                        {"\n"}
                        World
                    </Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("World");
    });

    it("overflowY - box intersecting with top edge of overflow container with border", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box borderStyle="round" height={3} overflowY="hidden" width={7}>
                <Box flexShrink={0} height={2} marginTop={-1}>
                    <Text>
                        Hello
                        {"\n"}
                        World
                    </Text>
                </Box>
            </Box>,
        );

        expect(output).toBe(box("World"));
    });

    it("overflowY - box below bottom edge of overflow container", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={1} overflowY="hidden">
                <Box flexShrink={0} height={2} marginTop={1}>
                    <Text>
                        Hello
                        {"\n"}
                        World
                    </Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("");
    });

    it("overflowY - box below bottom edge of overflow container with border", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box borderStyle="round" height={3} overflowY="hidden" width={7}>
                <Box flexShrink={0} height={2} marginTop={2}>
                    <Text>
                        Hello
                        {"\n"}
                        World
                    </Text>
                </Box>
            </Box>,
        );

        expect(output).toBe(box(" ".repeat(5)));
    });

    it("overflowY - box intersecting with bottom edge of overflow container", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={1} overflowY="hidden">
                <Box flexShrink={0} height={2}>
                    <Text>
                        Hello
                        {"\n"}
                        World
                    </Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("Hello");
    });

    it("overflowY - box intersecting with bottom edge of overflow container with border", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box borderStyle="round" height={3} overflowY="hidden" width={7}>
                <Box flexShrink={0} height={2}>
                    <Text>
                        Hello
                        {"\n"}
                        World
                    </Text>
                </Box>
            </Box>,
        );

        expect(output).toBe(box("Hello"));
    });

    it("overflow - single text node inside overflow container", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box paddingBottom={1}>
                <Box height={1} overflow="hidden" width={6}>
                    <Box flexShrink={0} height={2} width={12}>
                        <Text>
                            Hello
                            {"\n"}
                            World
                        </Text>
                    </Box>
                </Box>
            </Box>,
        );

        expect(output).toBe("Hello\n");
    });

    it("overflow - single text node inside overflow container with border", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box paddingBottom={1}>
                <Box borderStyle="round" height={3} overflow="hidden" width={8}>
                    <Box flexShrink={0} height={2} width={12}>
                        <Text>
                            Hello
                            {"\n"}
                            World
                        </Text>
                    </Box>
                </Box>
            </Box>,
        );

        expect(output).toBe(`${box("Hello ")}\n`);
    });

    it("overflow - multiple boxes inside overflow container", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box paddingBottom={1}>
                <Box height={1} overflow="hidden" width={4}>
                    <Box flexShrink={0} height={2} width={2}>
                        <Text>
                            TL
                            {"\n"}
                            BL
                        </Text>
                    </Box>
                    <Box flexShrink={0} height={2} width={2}>
                        <Text>
                            TR
                            {"\n"}
                            BR
                        </Text>
                    </Box>
                </Box>
            </Box>,
        );

        expect(output).toBe("TLTR\n");
    });

    it("overflow - multiple boxes inside overflow container with border", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box paddingBottom={1}>
                <Box borderStyle="round" height={3} overflow="hidden" width={6}>
                    <Box flexShrink={0} height={2} width={2}>
                        <Text>
                            TL
                            {"\n"}
                            BL
                        </Text>
                    </Box>
                    <Box flexShrink={0} height={2} width={2}>
                        <Text>
                            TR
                            {"\n"}
                            BR
                        </Text>
                    </Box>
                </Box>
            </Box>,
        );

        expect(output).toBe(`${box("TLTR")}\n`);
    });

    it("overflow - box intersecting with top left edge of overflow container", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={4} overflow="hidden" width={4}>
                <Box flexShrink={0} height={4} marginLeft={-2} marginTop={-2} width={4}>
                    <Text>
                        AAAA
                        {"\n"}
                        BBBB
                        {"\n"}
                        CCCC
                        {"\n"}
                        DDDD
                    </Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("CC\nDD\n\n");
    });

    it("overflow - box intersecting with top right edge of overflow container", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={4} overflow="hidden" width={4}>
                <Box flexShrink={0} height={4} marginLeft={2} marginTop={-2} width={4}>
                    <Text>
                        AAAA
                        {"\n"}
                        BBBB
                        {"\n"}
                        CCCC
                        {"\n"}
                        DDDD
                    </Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("  CC\n  DD\n\n");
    });

    it("overflow - box intersecting with bottom left edge of overflow container", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={4} overflow="hidden" width={4}>
                <Box flexShrink={0} height={4} marginLeft={-2} marginTop={2} width={4}>
                    <Text>
                        AAAA
                        {"\n"}
                        BBBB
                        {"\n"}
                        CCCC
                        {"\n"}
                        DDDD
                    </Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("\n\nAA\nBB");
    });

    it("overflow - box intersecting with bottom right edge of overflow container", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={4} overflow="hidden" width={4}>
                <Box flexShrink={0} height={4} marginLeft={2} marginTop={2} width={4}>
                    <Text>
                        AAAA
                        {"\n"}
                        BBBB
                        {"\n"}
                        CCCC
                        {"\n"}
                        DDDD
                    </Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("\n\n  AA\n  BB");
    });

    it("nested overflow", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box paddingBottom={1}>
                <Box flexDirection="column" height={4} overflow="hidden" width={4}>
                    <Box height={2} overflow="hidden" width={2}>
                        <Box flexShrink={0} height={4} width={4}>
                            <Text>
                                AAAA
                                {"\n"}
                                BBBB
                                {"\n"}
                                CCCC
                                {"\n"}
                                DDDD
                            </Text>
                        </Box>
                    </Box>

                    <Box height={3} width={4}>
                        <Text>
                            XXXX
                            {"\n"}
                            YYYY
                            {"\n"}
                            ZZZZ
                        </Text>
                    </Box>
                </Box>
            </Box>,
        );

        expect(output).toBe("AA\nBB\nXXXX\nYYYY\n");
    });

    it("out of bounds writes do not crash", () => {
        expect.assertions(1);

        const output = renderToString(<Box borderStyle="round" height={10} width={12} />, { columns: 10 });

        const expected = boxen("", {
            borderStyle: "round",
            height: 10,
            width: 12,
        })
            .split("\n")
            .map((line, index) => (index === 0 || index === 9 ? line : `${line.slice(0, 10)}${line[11] ?? ""}`))
            .join("\n");

        expect(output).toBe(expected);
    });

    it("overflowX - single text node in a box inside overflow container - concurrent", async () => {
        expect.assertions(1);

        const output = await renderToStringAsync(
            <Box overflowX="hidden" width={6}>
                <Box flexShrink={0} width={16}>
                    <Text>Hello World</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("Hello");
    });

    it("overflowY - single text node inside overflow container - concurrent", async () => {
        expect.assertions(1);

        const output = await renderToStringAsync(
            <Box height={1} overflowY="hidden">
                <Text>
                    Hello
                    {"\n"}
                    World
                </Text>
            </Box>,
        );

        expect(output).toBe("Hello");
    });

    it("overflow - single text node inside overflow container - concurrent", async () => {
        expect.assertions(1);

        const output = await renderToStringAsync(
            <Box paddingBottom={1}>
                <Box height={1} overflow="hidden" width={6}>
                    <Box flexShrink={0} height={2} width={12}>
                        <Text>
                            Hello
                            {"\n"}
                            World
                        </Text>
                    </Box>
                </Box>
            </Box>,
        );

        expect(output).toBe("Hello\n");
    });

    it("nested overflow - concurrent", async () => {
        expect.assertions(1);

        const output = await renderToStringAsync(
            <Box paddingBottom={1}>
                <Box flexDirection="column" height={4} overflow="hidden" width={4}>
                    <Box height={2} overflow="hidden" width={2}>
                        <Box flexShrink={0} height={4} width={4}>
                            <Text>
                                AAAA
                                {"\n"}
                                BBBB
                                {"\n"}
                                CCCC
                                {"\n"}
                                DDDD
                            </Text>
                        </Box>
                    </Box>

                    <Box height={3} width={4}>
                        <Text>
                            XXXX
                            {"\n"}
                            YYYY
                            {"\n"}
                            ZZZZ
                        </Text>
                    </Box>
                </Box>
            </Box>,
        );

        expect(output).toBe("AA\nBB\nXXXX\nYYYY\n");
    });
});
