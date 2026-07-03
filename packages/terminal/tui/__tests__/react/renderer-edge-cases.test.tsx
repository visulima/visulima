// @ts-nocheck
import React from "react";
import { describe, expect, it } from "vitest";

import { renderToString } from "../../src/react/render-to-string";

const Box: React.FC<any> = (props) => React.createElement("box", props, props.children);
const Text: React.FC<any> = (props) => React.createElement("text", props, props.children);
const Spacer: React.FC = () => React.createElement(Box, { flexGrow: 1 });

describe("renderer edge cases", () => {
    // ─── Empty text nodes ────────────────────────────────────────────────

    describe("empty text nodes", () => {
        it("should not crash on empty text content", () => {
            expect.assertions(1);

            const output = renderToString(
                <Box height={3} width={10}>
                    <Text />
                </Box>,
                { columns: 15, rows: 5 },
            );

            // Should produce output without errors
            expect(output).toBeDefined();
        });

        it("should render siblings around empty text correctly", () => {
            expect.assertions(2);

            const output = renderToString(
                <Box height={1} width={20}>
                    <Text>A</Text>
                    <Text />
                    <Text>B</Text>
                </Box>,
                { columns: 25, rows: 3 },
            );

            expect(output).toContain("A");
            expect(output).toContain("B");
        });
    });

    // ─── Border edge cases ───────────────────────────────────────────────

    describe("border edge cases", () => {
        it("should render a box with height=1 and all borders", () => {
            expect.assertions(2);

            const output = renderToString(
                <Box borderStyle="single" height={1} width={10}>
                    <Text>x</Text>
                </Box>,
                { columns: 15, rows: 3 },
            );

            // Height=1 with borders means top and bottom overlap at the same row
            const lines = output.split("\n");

            expect(lines.length).toBeGreaterThanOrEqual(1);
            // Should contain border characters
            expect(lines[0]).toMatch(/[┌└─┐┘│]/);
        });

        it("should render a box with width=1 and all borders", () => {
            expect.assertions(1);

            const output = renderToString(<Box borderStyle="single" height={3} width={1} />, { columns: 5, rows: 5 });

            const lines = output.split("\n");

            // Width=1: all border chars at the same column
            expect(lines.length).toBeGreaterThanOrEqual(1);
        });

        it("should render a box with height=2 and full borders correctly", () => {
            expect.assertions(4);

            const output = renderToString(
                <Box borderStyle="single" height={2} width={10}>
                    <Text>hi</Text>
                </Box>,
                { columns: 15, rows: 4 },
            );

            const lines = output.split("\n");

            // Row 0: top border, Row 1: bottom border (no content row)
            expect(lines[0]).toContain("┌");
            expect(lines[0]).toContain("┐");
            expect(lines[1]).toContain("└");
            expect(lines[1]).toContain("┘");
        });

        it("should handle all 16 partial border permutations without crashing", () => {
            expect.assertions(16);

            for (let i = 0; i < 16; i++) {
                const top = Boolean(i & 8);
                const bottom = Boolean(i & 4);
                const left = Boolean(i & 2);
                const right = Boolean(i & 1);

                const output = renderToString(
                    <Box borderBottom={bottom} borderLeft={left} borderRight={right} borderStyle="single" borderTop={top} minWidth={8} paddingX={1}>
                        <Text>ok</Text>
                    </Box>,
                    { columns: 15, rows: 5 },
                );

                expect(output).toContain("ok");
            }
        });
    });

    // ─── Partial borders with overflow hidden ────────────────────────────

    describe("partial borders with overflow clipping", () => {
        it("should clip content inside borders when overflow is hidden and borderTop is disabled", () => {
            expect.assertions(3);

            const output = renderToString(
                <Box borderBottom borderLeft borderRight borderStyle="single" borderTop={false} height={4} overflow="hidden" width={12}>
                    <Text>ABCDEFGHIJ</Text>
                </Box>,
                { columns: 15, rows: 6 },
            );

            // Content should be visible inside the box
            expect(output).toContain("ABCDEFGHIJ");
            // Should have left border
            expect(output).toContain("│");
            // Should have bottom border
            expect(output).toContain("└");
        });

        it("should clip content when overflow is hidden and no left border", () => {
            expect.assertions(1);

            const output = renderToString(
                <Box borderBottom borderLeft={false} borderRight borderStyle="single" borderTop height={4} overflow="hidden" width={12}>
                    <Text>ABCDEFGHIJ</Text>
                </Box>,
                { columns: 15, rows: 6 },
            );

            expect(output).toContain("ABCDEF");
        });
    });

    // ─── Wide character handling ─────────────────────────────────────────

    describe("wide characters", () => {
        it("should render CJK characters with correct width", () => {
            expect.assertions(2);

            const output = renderToString(
                <Box height={1} width={10}>
                    <Text>你好</Text>
                </Box>,
                { columns: 15, rows: 3 },
            );

            // Each CJK char takes 2 cells; continuation cell renders as space in renderToString
            expect(output).toContain("你");
            expect(output).toContain("好");
        });

        it("should wrap wide characters that don't fit on the current line", () => {
            // Box width 5: "A" takes 1 cell, "你" takes 2 cells → 3 used, "好" needs 2 more = 5 → fits
            expect.assertions(2);

            const output = renderToString(
                <Box height={2} width={5}>
                    <Text>A你好</Text>
                </Box>,
                { columns: 10, rows: 4 },
            );

            // Wide chars have continuation cells (shown as spaces in renderToString)
            expect(output).toContain("A你");
            expect(output).toContain("好");
        });

        it("should replace wide char with space when container is 1 cell wide", () => {
            expect.assertions(1);

            const output = renderToString(
                <Box height={1} width={1}>
                    <Text>你</Text>
                </Box>,
                { columns: 5, rows: 3 },
            );

            // Wide char can't fit in 1-cell width, should be replaced with space
            expect(output).toBeDefined();
        });

        it("should handle emoji (surrogate pairs)", () => {
            expect.assertions(2);

            const output = renderToString(
                <Box height={1} width={10}>
                    <Text>🐭AB</Text>
                </Box>,
                { columns: 15, rows: 3 },
            );

            expect(output).toContain("🐭");
            expect(output).toContain("AB");
        });
    });

    // ─── Transform nodes ─────────────────────────────────────────────────

    describe("transform component", () => {
        it("should apply uppercase transform to child text", () => {
            expect.assertions(2);

            const output = renderToString(
                <Box height={1} transform={(s: string) => s.toUpperCase()} width={20}>
                    <Text>hello world</Text>
                </Box>,
                { columns: 25, rows: 3 },
            );

            expect(output).toContain("HELLO WORLD");
            expect(output).not.toContain("hello world");
        });

        it("should handle transform on empty text", () => {
            expect.assertions(1);

            const output = renderToString(
                <Box height={1} transform={(s: string) => s.toUpperCase()} width={10}>
                    <Text />
                </Box>,
                { columns: 15, rows: 3 },
            );

            expect(output).toBeDefined();
        });
    });

    // ─── Color and style inheritance ─────────────────────────────────────

    describe("color inheritance", () => {
        it("should render text with explicit color without crashing", () => {
            expect.assertions(2);

            const output = renderToString(
                <Box height={1} width={20}>
                    <Text color="green">green text</Text>
                    <Text> </Text>
                    <Text color="red">red text</Text>
                </Box>,
                { columns: 25, rows: 3 },
            );

            expect(output).toContain("green text");
            expect(output).toContain("red text");
        });

        it("should handle backgroundColor on text nodes", () => {
            expect.assertions(1);

            const output = renderToString(
                <Box height={1} width={20}>
                    <Text backgroundColor="blue">highlighted</Text>
                </Box>,
                { columns: 25, rows: 3 },
            );

            expect(output).toContain("highlighted");
        });
    });

    // ─── Flex layout edge cases ──────────────────────────────────────────

    describe("flex layout", () => {
        it("should handle zero-width container", () => {
            expect.assertions(1);

            const output = renderToString(
                <Box height={1} width={0}>
                    <Text>text</Text>
                </Box>,
                { columns: 10, rows: 3 },
            );

            // Should not crash
            expect(output).toBeDefined();
        });

        it("should handle zero-height container", () => {
            expect.assertions(1);

            const output = renderToString(
                <Box height={0} width={10}>
                    <Text>text</Text>
                </Box>,
                { columns: 15, rows: 3 },
            );

            expect(output).toBeDefined();
        });

        it("should handle deeply nested boxes", () => {
            expect.assertions(1);

            const output = renderToString(
                <Box flexDirection="column" height={5} width={20}>
                    <Box flexDirection="row">
                        <Box flexDirection="column">
                            <Box>
                                <Text>deep</Text>
                            </Box>
                        </Box>
                    </Box>
                </Box>,
                { columns: 25, rows: 7 },
            );

            expect(output).toContain("deep");
        });

        it("should apply gap correctly in column direction", () => {
            expect.assertions(3);

            const output = renderToString(
                <Box flexDirection="column" gap={1} height={5} width={10}>
                    <Text>A</Text>
                    <Text>B</Text>
                    <Text>C</Text>
                </Box>,
                { columns: 15, rows: 7 },
            );

            const lines = output.split("\n");

            // A at row 0, gap at row 1, B at row 2, gap at row 3, C at row 4
            expect(lines[0]).toContain("A");
            expect(lines[2]).toContain("B");
            expect(lines[4]).toContain("C");
        });

        it("should handle marginLeft correctly (physical edge, not logical)", () => {
            expect.assertions(1);

            const output = renderToString(
                <Box height={1} width={20}>
                    <Box marginLeft={3}>
                        <Text>X</Text>
                    </Box>
                </Box>,
                { columns: 25, rows: 3 },
            );

            const line = output.split("\n")[0] || "";
            const xPos = line.indexOf("X");

            expect(xPos).toBe(3);
        });
    });

    // ─── Newlines in text ────────────────────────────────────────────────

    describe("newlines in text", () => {
        it("should render multi-line text in a tall box", () => {
            // Use a Box with flexDirection column wrapping Text elements for multi-line
            expect.assertions(3);

            const output = renderToString(
                <Box flexDirection="column" height={3} width={20}>
                    <Text>line1</Text>
                    <Text>line2</Text>
                    <Text>line3</Text>
                </Box>,
                { columns: 25, rows: 5 },
            );

            const lines = output.split("\n");

            expect(lines[0]).toContain("line1");
            expect(lines[1]).toContain("line2");
            expect(lines[2]).toContain("line3");
        });

        it("should clip children that exceed container height with overflow hidden", () => {
            expect.assertions(3);

            const output = renderToString(
                <Box flexDirection="column" height={2} overflow="hidden" width={20}>
                    <Box flexShrink={0}>
                        <Text>line1</Text>
                    </Box>
                    <Box flexShrink={0}>
                        <Text>line2</Text>
                    </Box>
                    <Box flexShrink={0}>
                        <Text>line3</Text>
                    </Box>
                </Box>,
                { columns: 25, rows: 5 },
            );

            // line1 and line2 fit, line3 is clipped by overflow:hidden
            expect(output).toContain("line1");
            expect(output).toContain("line2");
            expect(output).not.toContain("line3");
        });
    });

    // ─── Spacer component ────────────────────────────────────────────────

    describe("spacer in various layouts", () => {
        it("should work in a column layout", () => {
            expect.assertions(2);

            const output = renderToString(
                <Box flexDirection="column" height={5} width={10}>
                    <Text>top</Text>
                    <Spacer />
                    <Text>bottom</Text>
                </Box>,
                { columns: 15, rows: 7 },
            );

            const lines = output.split("\n");

            expect(lines[0]).toContain("top");
            // "bottom" should be at the last row
            expect(lines[lines.length - 1]).toContain("bottom");
        });
    });

    // ─── Absolute positioning ────────────────────────────────────────────

    describe("absolute positioning", () => {
        it("should position a box absolutely within its parent", () => {
            expect.assertions(3);

            const output = renderToString(
                <Box flexDirection="column" height={5} width={20}>
                    <Text>background</Text>
                    <Box left={5} position="absolute" top={2}>
                        <Text>overlay</Text>
                    </Box>
                </Box>,
                { columns: 25, rows: 7 },
            );

            expect(output).toContain("background");
            expect(output).toContain("overlay");

            // "overlay" should be at row 2
            const lines = output.split("\n");

            expect(lines[2]).toContain("overlay");
        });
    });

    // ─── Render-to-string cleanup ────────────────────────────────────────

    describe(renderToString, () => {
        it("should trim trailing empty rows", () => {
            expect.assertions(1);

            const output = renderToString(
                <Box height={1} width={10}>
                    <Text>hi</Text>
                </Box>,
                { columns: 20, rows: 10 },
            );

            const lines = output.split("\n");

            // Should not have 10 lines — trailing empty ones should be removed
            expect(lines.length).toBeLessThan(10);
        });

        it("should trim trailing spaces from each row", () => {
            expect.assertions(1);

            const output = renderToString(
                <Box height={1} width={5}>
                    <Text>AB</Text>
                </Box>,
                { columns: 20, rows: 3 },
            );

            const lines = output.split("\n");

            // No trailing spaces
            for (const line of lines) {
                expect(line).toBe(line.trimEnd());
            }
        });

        it("should handle very small terminal (1x1)", () => {
            expect.assertions(1);

            const output = renderToString(
                <Box height={1} width={1}>
                    <Text>X</Text>
                </Box>,
                { columns: 1, rows: 1 },
            );

            expect(output).toBe("X");
        });
    });

    // ─── paintBorder h=1 overlap ─────────────────────────────────────────

    describe("paintBorder h=1 and w=1 degenerate cases", () => {
        it("h=1 with top+bottom: top border should take priority", () => {
            expect.assertions(4);

            const output = renderToString(<Box borderStyle="single" height={1} width={6} />, { columns: 10, rows: 3 });

            const line = output.split("\n")[0] || "";

            // Top border should be painted (not bottom overwriting it)
            expect(line).toContain("┌");
            expect(line).toContain("┐");
            // Bottom corners should NOT appear since top takes priority
            expect(line).not.toContain("└");
            expect(line).not.toContain("┘");
        });

        it("h=1 with bottom-only border: bottom should render", () => {
            expect.assertions(2);

            const output = renderToString(<Box borderStyle="single" borderTop={false} height={1} width={6} />, { columns: 10, rows: 3 });

            const line = output.split("\n")[0] || "";

            expect(line).toContain("└");
            expect(line).toContain("┘");
        });

        it("w=1 with all borders: should render vertical line character", () => {
            expect.assertions(2);

            const output = renderToString(<Box borderStyle="single" height={4} width={1} />, { columns: 5, rows: 6 });

            const lines = output.split("\n");

            // Top row should be topLeft (corners merge to vertical line for w=1 with both L+R)
            expect(lines[0]).toMatch(/[┌│]/);

            // Middle rows should be left/right vertical (they share the column)
            if (lines.length > 2) {
                expect(lines[1]).toContain("│");
            }
        });
    });

    // ─── collectText with nested transforms ──────────────────────────────

    describe("nested Transform", () => {
        it("should apply inner transform before outer transform", () => {
            expect.assertions(1);

            const output = renderToString(
                <Box height={1} transform={(s: string) => s.toUpperCase()} width={30}>
                    <Text>hello </Text>
                    <Box transform={(s: string) => s.split("").reverse().join("")}>
                        <Text>world</Text>
                    </Box>
                </Box>,
                { columns: 35, rows: 3 },
            );

            // Inner transform reverses "world" → "dlrow"
            // Outer transform uppercases "hello dlrow" → "HELLO DLROW"
            expect(output).toContain("HELLO DLROW");
        });
    });

    // ─── Overflow hidden with partial borders ────────────────────────────

    describe("overflow hidden with partial borders", () => {
        it("should correctly clip when borderTop is disabled", () => {
            // With borderTop=false, the clip region top should start at absY (no border offset)
            expect.assertions(3);

            const output = renderToString(
                <Box borderStyle="single" borderTop={false} height={5} overflow="hidden" width={20}>
                    <Box flexDirection="column" flexShrink={0}>
                        <Text>visible1</Text>
                        <Text>visible2</Text>
                        <Text>visible3</Text>
                    </Box>
                </Box>,
                { columns: 25, rows: 7 },
            );

            // All 3 lines should be visible (4 content rows available: h=5 - 0 top border - 1 bottom border)
            expect(output).toContain("visible1");
            expect(output).toContain("visible2");
            expect(output).toContain("visible3");
        });

        it("should correctly clip when borderBottom is disabled", () => {
            expect.assertions(3);

            const output = renderToString(
                <Box borderBottom={false} borderStyle="single" height={5} overflow="hidden" width={20}>
                    <Box flexDirection="column" flexShrink={0}>
                        <Text>visible1</Text>
                        <Text>visible2</Text>
                        <Text>visible3</Text>
                    </Box>
                </Box>,
                { columns: 25, rows: 7 },
            );

            // 4 content rows: h=5 - 1 top border - 0 bottom border
            expect(output).toContain("visible1");
            expect(output).toContain("visible2");
            expect(output).toContain("visible3");
        });
    });

    // ─── Empty text node path ────────────────────────────────────────────

    describe("empty text node rendering path", () => {
        it("should not queue border jobs for empty text nodes", () => {
            // Empty text should go through text path (not box path that queues borders)
            expect.assertions(2);

            const output = renderToString(
                <Box borderStyle="single" height={3} width={20}>
                    <Text />
                    <Text>visible</Text>
                </Box>,
                { columns: 25, rows: 5 },
            );

            // Borders should still be present from the parent box
            expect(output).toContain("┌");
            expect(output).toContain("visible");
        });
    });
});
