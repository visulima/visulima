import { describe, expect, it } from "vitest";

import { Box, Text } from "../../src/components/index";
import { renderToString } from "../helpers/ink-render";

describe("text characters", () => {
    it("zero-width spaces do not overwrite box borders", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box borderStyle="single" width={7}>
                <Text>{"he\u200Bllo"}</Text>
            </Box>,
        );

        expect(output.replaceAll("​", "")).toBe("┌─────┐\n│hello│\n└─────┘");
    });

    it("wide characters crossing the left output edge preserve visible columns", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box height={1} width={4}>
                <Box left={-1} position="absolute">
                    <Text>好AB</Text>
                </Box>
                <Box left={3} position="absolute">
                    <Text>!</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe(" AB!");
    });
});

describe("wide characters at clip edges", () => {
    const blue = (text: string): string => `\u001B[44m${text}\u001B[49m`;

    for (const nested of [false, true]) {
        for (const [offset, width, expected] of [
            [1, 3, " 好"],
            [0, 3, "你 "],
            [1, 2, "  "],
            [0, 4, "你好"],
        ] as const) {
            it(`clipping wide text preserves its background (nested: ${String(nested)}, offset: ${String(offset)}, width: ${String(width)})`, () => {
                expect.hasAssertions();

                const content = <Text backgroundColor="blue">你好</Text>;
                const output = renderToString(
                    <Box contentOffsetX={offset} height={1} overflowX="hidden" width={width}>
                        <Box flexShrink={0} width={4}>
                            {nested ? <Text>{content}</Text> : content}
                        </Box>
                    </Box>,
                );

                expect(output).toBe(blue(expected));
            });
        }
    }

    it("clipping a joined emoji preserves its background and adjacent text", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box contentOffsetX={1} height={1} overflowX="hidden" width={2}>
                <Box flexShrink={0} width={3}>
                    <Text>
                        <Text backgroundColor="blue">👩‍💻X</Text>
                    </Text>
                </Box>
            </Box>,
        );

        expect(output).toBe(blue(" X"));
    });
});

describe("wide characters overwritten by overlays", () => {
    for (const glyph of ["你", "👩‍💻"]) {
        for (const left of [0, 1]) {
            it(`overwriting ${glyph} cell ${String(left)} preserves the other cell's background`, () => {
                expect.hasAssertions();

                const output = renderToString(
                    <Box height={1} width={3}>
                        <Text backgroundColor="blue">
{glyph}
Z
                        </Text>
                        <Box left={left} position="absolute" top={0}>
                            <Text>X</Text>
                        </Box>
                    </Box>,
                );
                const expected = renderToString(
                    <Text>
                        {left === 0
                            ? (
                            <>
                                <Text>X</Text>
                                <Text backgroundColor="blue"> Z</Text>
                            </>
                            )
                            : (
                            <>
                                <Text backgroundColor="blue"> </Text>
                                <Text>X</Text>
                                <Text backgroundColor="blue">Z</Text>
                            </>
                            )}
                    </Text>,
                );

                expect(output).toBe(expected);
            });
        }
    }

    for (const replacement of ["XY", "好"]) {
        it(`fully overwriting a wide character with ${replacement} replaces its styles`, () => {
            expect.hasAssertions();

            const output = renderToString(
                <Box height={1} width={3}>
                    <Text backgroundColor="blue">你Z</Text>
                    <Box left={0} position="absolute" top={0}>
                        <Text backgroundColor="red">{replacement}</Text>
                    </Box>
                </Box>,
            );
            const expected = renderToString(
                <Text>
                    <Text backgroundColor="red">{replacement}</Text>
                    <Text backgroundColor="blue">Z</Text>
                </Text>,
            );

            expect(output).toBe(expected);
        });
    }

    it("an overlay crossing two wide characters preserves both exposed backgrounds", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box height={1} width={4}>
                <Text>
                    <Text backgroundColor="blue">你</Text>
                    <Text backgroundColor="green">好</Text>
                </Text>
                <Box left={1} position="absolute" top={0}>
                    <Text backgroundColor="red">XY</Text>
                </Box>
            </Box>,
        );
        const expected = renderToString(
            <Text>
                <Text backgroundColor="blue"> </Text>
                <Text backgroundColor="red">XY</Text>
                <Text backgroundColor="green"> </Text>
            </Text>,
        );

        expect(output).toBe(expected);
    });
});
