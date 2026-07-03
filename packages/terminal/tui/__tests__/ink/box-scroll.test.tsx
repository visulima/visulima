/**
 * Integration tests for Box overflow="scroll" — ported from upstream ink.
 *
 * These verify that &lt;Box overflowY="scroll" scrollTop={n}> renders correct
 * clipping, scrollbar characters, and scroll position behavior.
 */
import { describe, expect, it } from "vitest";

import { Box, Text } from "../../src/components/index";
import { render } from "../../src/ink/index";
import createStdout from "../helpers/ink-create-stdout";
import { renderToString } from "../helpers/ink-render";

const tallText = Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n");

// ── Vertical scroll ────────────────────────────────────────────────────

describe("box scroll – vertical", () => {
    it("renders vertical scrollbar at default scrollTop 0", () => {
        expect.assertions(4);

        const output = renderToString(
            <Box borderStyle="round" flexDirection="column" height={5} overflowY="scroll" width={15}>
                <Box flexDirection="column" flexShrink={0}>
                    <Text>{tallText}</Text>
                </Box>
            </Box>,
        );

        // Should show first lines and a scrollbar thumb near the top
        expect(output).toContain("line 0");
        expect(output).toContain("line 1");
        expect(output).toContain("line 2");
        // Scrollbar character should appear somewhere (█ or ▀ or ▄)
        expect(output).toMatch(/[█▀▄]/);
    });

    it("renders vertical scroll with scrollTop offset", () => {
        expect.assertions(3);

        const output = renderToString(
            <Box borderStyle="round" flexDirection="column" height={5} overflowY="scroll" scrollTop={10} width={15}>
                <Box flexDirection="column" flexShrink={0}>
                    <Text>{tallText}</Text>
                </Box>
            </Box>,
        );

        // Should show lines around index 10
        expect(output).toContain("line 10");
        expect(output).toContain("line 11");
        // Should NOT show line 0 (scrolled past)
        expect(output).not.toMatch(/\bline 0\b/);
    });

    it("clamps scrollTop to bottom when exceeding content", () => {
        expect.assertions(2);

        const output = renderToString(
            <Box borderStyle="round" flexDirection="column" height={5} overflowY="scroll" scrollTop={Number.MAX_SAFE_INTEGER} width={15}>
                <Box flexDirection="column" flexShrink={0}>
                    <Text>{tallText}</Text>
                </Box>
            </Box>,
        );

        // Should show last lines
        expect(output).toContain("line 19");
        // Scrollbar thumb should be at the bottom (█)
        expect(output).toMatch(/[█▀▄]/);
    });

    it("renders in narrow container", () => {
        expect.assertions(2);

        const output = renderToString(
            <Box borderStyle="round" flexDirection="column" height={5} overflowY="scroll" width={9}>
                <Box flexDirection="column" flexShrink={0}>
                    <Text>{tallText}</Text>
                </Box>
            </Box>,
        );

        expect(output).toContain("line");
        expect(output).toMatch(/[█▀▄]/);
    });
});

// ── Horizontal scroll ──────────────────────────────────────────────────

describe("box scroll – horizontal", () => {
    it("renders horizontal scrollbar at default scrollLeft 0", () => {
        expect.assertions(2);

        const output = renderToString(
            <Box borderStyle="round" flexDirection="row" height={4} overflowX="scroll" overflowY="hidden" width={15}>
                <Box flexDirection="column" flexShrink={0} paddingX={1}>
                    <Text>The quick brown fox jumps over the lazy dog</Text>
                </Box>
            </Box>,
        );

        // Should show beginning of text
        expect(output).toContain("The quick");
        // Horizontal scrollbar characters
        expect(output).toMatch(/[█▌▐]/);
    });

    it("renders horizontal scroll with scrollLeft offset", () => {
        expect.assertions(2);

        const output = renderToString(
            <Box borderStyle="round" flexDirection="row" height={4} overflowX="scroll" overflowY="hidden" scrollLeft={9} width={15}>
                <Box flexDirection="column" flexShrink={0} paddingX={1}>
                    <Text>The quick brown fox jumps over the lazy dog</Text>
                </Box>
            </Box>,
        );

        // Should show middle of text, not the beginning
        expect(output).toContain("brown");
        expect(output).not.toContain("The q");
    });

    it("clamps scrollLeft to end when exceeding content", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box borderStyle="round" flexDirection="row" height={4} overflowX="scroll" overflowY="hidden" scrollLeft={Number.MAX_SAFE_INTEGER} width={15}>
                <Box flexDirection="column" flexShrink={0} paddingX={1}>
                    <Text>The quick brown fox jumps over the lazy dog</Text>
                </Box>
            </Box>,
        );

        // Should show end of text
        expect(output).toContain("dog");
    });
});

// ── Both axes ──────────────────────────────────────────────────────────

describe("box scroll – both axes", () => {
    it("renders both vertical and horizontal scrollbars", () => {
        expect.assertions(2);

        const output = renderToString(
            <Box borderStyle="round" flexDirection="column" height={5} overflow="scroll" padding={1} width={15}>
                <Box flexShrink={0} height={100} width={100}>
                    <Text>Scroll me</Text>
                </Box>
            </Box>,
        );

        expect(output).toContain("Scroll me");
        // Should have scrollbar characters for both axes
        expect(output).toMatch(/[█▀▄▌▐]/);
    });

    it("renders both axes with scroll offsets", () => {
        expect.assertions(2);

        const output = renderToString(
            <Box borderStyle="round" flexDirection="column" height={5} overflow="scroll" padding={1} scrollLeft={50} scrollTop={50} width={15}>
                <Box flexShrink={0} height={100} width={100}>
                    <Text>Scroll me</Text>
                </Box>
            </Box>,
        );

        // Content should be scrolled past
        expect(output).not.toContain("Scroll me");
        expect(output).toMatch(/[█▀▄▌▐]/);
    });
});

// ── Dynamic scroll update ──────────────────────────────────────────────

describe("box scroll – dynamic updates", () => {
    it("updates scroll position on rerender", () => {
        expect.assertions(3);

        const stdout = createStdout(100);

        const { rerender } = render(
            <Box borderStyle="round" flexDirection="column" height={5} overflowY="scroll" scrollTop={0} width={15}>
                <Box flexDirection="column" flexShrink={0}>
                    <Text>{tallText}</Text>
                </Box>
            </Box>,
            { debug: true, stdout },
        );

        const firstRender = stdout.get();

        expect(firstRender).toContain("line 0");

        rerender(
            <Box borderStyle="round" flexDirection="column" height={5} overflowY="scroll" scrollTop={5} width={15}>
                <Box flexDirection="column" flexShrink={0}>
                    <Text>{tallText}</Text>
                </Box>
            </Box>,
        );

        const secondRender = stdout.get();

        expect(secondRender).toContain("line 5");
        expect(secondRender).not.toMatch(/\bline 0\b/);
    });
});

// ── Scroll with flexGrow ───────────────────────────────────────────────

describe("box scroll – flexGrow", () => {
    it("renders scrollbar in flexGrow container", () => {
        expect.assertions(2);

        const output = renderToString(
            <Box height={5} width={20}>
                <Box borderStyle="round" flexDirection="column" flexGrow={1} overflowY="scroll" scrollTop={10}>
                    <Box flexDirection="column" flexShrink={0}>
                        <Text>{tallText}</Text>
                    </Box>
                </Box>
                <Text>Side</Text>
            </Box>,
        );

        expect(output).toContain("Side");
        expect(output).toMatch(/[█▀▄]/);
    });
});

// ── Scroll with padding ────────────────────────────────────────────────

describe("box scroll – padding", () => {
    it("scrollTop 0 with padding preserves padding space", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box borderStyle="round" flexDirection="column" height={7} overflow="hidden" overflowY="scroll" padding={2} scrollTop={0} width={15}>
                <Box flexDirection="column" flexShrink={0}>
                    <Text>{tallText}</Text>
                </Box>
            </Box>,
        );

        expect(output).toContain("line 0");
    });

    it("scrollTop max with padding shows last lines", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box
                borderStyle="round"
                flexDirection="column"
                height={7}
                overflow="hidden"
                overflowY="scroll"
                padding={2}
                scrollTop={Number.MAX_SAFE_INTEGER}
                width={15}
            >
                <Box flexDirection="column" flexShrink={0}>
                    <Text>{tallText}</Text>
                </Box>
            </Box>,
        );

        expect(output).toContain("line 19");
    });
});

// ── No scrollbar when content fits ─────────────────────────────────────

describe("box scroll – no scrollbar needed", () => {
    it("does not render scrollbar when content is smaller than container", () => {
        expect.assertions(2);

        const output = renderToString(
            <Box borderStyle="round" flexDirection="column" height={10} overflow="scroll" width={20}>
                <Box flexDirection="column" flexShrink={0}>
                    <Text>Fit</Text>
                </Box>
            </Box>,
        );

        expect(output).toContain("Fit");
        // No scrollbar characters should appear
        expect(output).not.toMatch(/[█▀▄▌▐]/);
    });

    it("does not render scrollbar when content exactly matches container", () => {
        expect.assertions(3);

        const content = Array.from({ length: 8 }, (_, i) => `line ${i}`).join("\n");

        const output = renderToString(
            <Box borderStyle="round" flexDirection="column" height={10} overflow="scroll" width={20}>
                <Box flexShrink={0} height={8} width={18}>
                    <Text>{content}</Text>
                </Box>
            </Box>,
        );

        expect(output).toContain("line 0");
        expect(output).toContain("line 7");
        expect(output).not.toMatch(/[█▀▄▌▐]/);
    });
});

// ── Nested scrolling ───────────────────────────────────────────────────

describe("box scroll – nested", () => {
    it("renders nested scroll containers independently", () => {
        expect.assertions(2);

        const output = renderToString(
            <Box borderStyle="double" flexDirection="column" height={10} overflow="scroll" scrollTop={17} width={40}>
                <Box flexDirection="column" flexShrink={0}>
                    <Box flexDirection="column">
                        <Text>{tallText}</Text>
                    </Box>
                    <Box borderStyle="round" flexDirection="column" height={5} overflow="scroll" scrollTop={12} width={20}>
                        <Box flexDirection="column" flexShrink={0}>
                            <Text>{tallText}</Text>
                        </Box>
                    </Box>
                    <Box flexDirection="column">
                        <Text>Footer</Text>
                    </Box>
                </Box>
            </Box>,
        );

        // Outer should show lines near 17
        expect(output).toContain("line 17");
        // Inner should show lines near 12-14
        expect(output).toMatch(/line 1[234]/);
    });
});

// ── Scrollbar thumb color ──────────────────────────────────────────────

describe("box scroll – scrollbar color", () => {
    it("applies custom scrollbar thumb color", () => {
        expect.assertions(2);

        const output = renderToString(
            <Box borderStyle="round" height={5} overflow="scroll" scrollbarThumbColor="red" width={15}>
                <Box flexShrink={0} height={100} width={100}>
                    <Text>Scroll me</Text>
                </Box>
            </Box>,
        );

        expect(output).toContain("Scroll me");
        // Should contain ANSI red color code (31)
        expect(output).toContain("\u001B[31m");
    });
});

// ── Overflow hidden vs visible ─────────────────────────────────────────

describe("box scroll – overflow modes", () => {
    it("overflow hidden clips content without scrollbar", () => {
        expect.assertions(4);

        const output = renderToString(
            <Box borderStyle="round" height={5} overflow="hidden" width={15}>
                <Box flexShrink={0} height={100} width={100}>
                    <Text>{tallText}</Text>
                </Box>
            </Box>,
        );

        // Should show first few lines only
        expect(output).toContain("line 0");
        expect(output).toContain("line 1");
        expect(output).toContain("line 2");
        // No scrollbar
        expect(output).not.toMatch(/[█▀▄▌▐]/);
    });

    it("overflow visible does not clip", () => {
        expect.assertions(2);

        const output = renderToString(
            <Box borderStyle="round" height={5} overflow="visible" width={15}>
                <Box flexShrink={0} height={100} width={100}>
                    <Text>{tallText}</Text>
                </Box>
            </Box>,
        );

        // Content should overflow beyond the container
        expect(output).toContain("line 0");
        // line 3 would be below the 5-row border box but should still appear
        expect(output).toContain("line 3");
    });
});
