/**
 * Integration tests for Box overflow="scroll" — ported from upstream ink.
 *
 * These verify that <Box overflowY="scroll" scrollTop={n}> renders correct
 * clipping, scrollbar characters, and scroll position behavior.
 */
import { describe, expect, it } from "vitest";

import { Box, render, Text } from "../../src/ink/index";
import createStdout from "../helpers/ink-create-stdout";
import { renderToString } from "../helpers/ink-render";

const tallText = Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n");

// ── Vertical scroll ────────────────────────────────────────────────────

describe("box scroll – vertical", () => {
    it("renders vertical scrollbar at default scrollTop 0", () => {
        const output = renderToString(
            <Box height={5} overflowY="scroll" borderStyle="round" flexDirection="column" width={15}>
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
        const output = renderToString(
            <Box height={5} overflowY="scroll" borderStyle="round" flexDirection="column" width={15} scrollTop={10}>
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
        const output = renderToString(
            <Box height={5} overflowY="scroll" borderStyle="round" flexDirection="column" width={15} scrollTop={Number.MAX_SAFE_INTEGER}>
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
        const output = renderToString(
            <Box height={5} overflowY="scroll" borderStyle="round" flexDirection="column" width={9}>
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
        const output = renderToString(
            <Box width={15} height={4} overflowX="scroll" overflowY="hidden" borderStyle="round" flexDirection="row">
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
        const output = renderToString(
            <Box width={15} height={4} overflowX="scroll" overflowY="hidden" borderStyle="round" flexDirection="row" scrollLeft={9}>
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
        const output = renderToString(
            <Box width={15} height={4} overflowX="scroll" overflowY="hidden" borderStyle="round" flexDirection="row" scrollLeft={Number.MAX_SAFE_INTEGER}>
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
        const output = renderToString(
            <Box width={15} height={5} overflow="scroll" borderStyle="round" padding={1} flexDirection="column">
                <Box width={100} height={100} flexShrink={0}>
                    <Text>Scroll me</Text>
                </Box>
            </Box>,
        );

        expect(output).toContain("Scroll me");
        // Should have scrollbar characters for both axes
        expect(output).toMatch(/[█▀▄▌▐]/);
    });

    it("renders both axes with scroll offsets", () => {
        const output = renderToString(
            <Box width={15} height={5} overflow="scroll" borderStyle="round" padding={1} flexDirection="column" scrollTop={50} scrollLeft={50}>
                <Box width={100} height={100} flexShrink={0}>
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
        const stdout = createStdout(100);

        const { rerender } = render(
            <Box width={15} height={5} overflowY="scroll" borderStyle="round" scrollTop={0} flexDirection="column">
                <Box flexDirection="column" flexShrink={0}>
                    <Text>{tallText}</Text>
                </Box>
            </Box>,
            { stdout, debug: true },
        );

        const firstRender = stdout.get();
        expect(firstRender).toContain("line 0");

        rerender(
            <Box width={15} height={5} overflowY="scroll" borderStyle="round" scrollTop={5} flexDirection="column">
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
        const output = renderToString(
            <Box width={20} height={5}>
                <Box flexGrow={1} overflowY="scroll" borderStyle="round" flexDirection="column" scrollTop={10}>
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
        const output = renderToString(
            <Box width={15} height={7} overflowY="scroll" borderStyle="round" padding={2} flexDirection="column" overflow="hidden" scrollTop={0}>
                <Box flexDirection="column" flexShrink={0}>
                    <Text>{tallText}</Text>
                </Box>
            </Box>,
        );

        expect(output).toContain("line 0");
    });

    it("scrollTop max with padding shows last lines", () => {
        const output = renderToString(
            <Box
                width={15}
                height={7}
                overflowY="scroll"
                borderStyle="round"
                padding={2}
                flexDirection="column"
                overflow="hidden"
                scrollTop={Number.MAX_SAFE_INTEGER}
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
        const output = renderToString(
            <Box width={20} height={10} overflow="scroll" borderStyle="round" flexDirection="column">
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
        const content = Array.from({ length: 8 }, (_, i) => `line ${i}`).join("\n");

        const output = renderToString(
            <Box width={20} height={10} overflow="scroll" borderStyle="round" flexDirection="column">
                <Box width={18} height={8} flexShrink={0}>
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
        const output = renderToString(
            <Box width={40} height={10} overflow="scroll" borderStyle="double" flexDirection="column" scrollTop={17}>
                <Box flexDirection="column" flexShrink={0}>
                    <Box flexDirection="column">
                        <Text>{tallText}</Text>
                    </Box>
                    <Box width={20} height={5} overflow="scroll" borderStyle="round" flexDirection="column" scrollTop={12}>
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
        const output = renderToString(
            <Box width={15} height={5} overflow="scroll" borderStyle="round" scrollbarThumbColor="red">
                <Box width={100} height={100} flexShrink={0}>
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
        const output = renderToString(
            <Box width={15} height={5} overflow="hidden" borderStyle="round">
                <Box width={100} height={100} flexShrink={0}>
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
        const output = renderToString(
            <Box width={15} height={5} overflow="visible" borderStyle="round">
                <Box width={100} height={100} flexShrink={0}>
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
