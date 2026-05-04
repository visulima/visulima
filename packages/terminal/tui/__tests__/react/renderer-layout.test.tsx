// @ts-nocheck
import React from "react";
import { describe, expect, it } from "vitest";

import { renderToString } from "../../src/react/render-to-string";

// Minimal ratatat components (same as in react.ts)
const Box: React.FC<any> = (props) => React.createElement("box", props, props.children);
const Text: React.FC<any> = (props) => React.createElement("text", props, props.children);
const Spacer: React.FC = () => React.createElement(Box, { flexGrow: 1 });

describe("ratatat renderer layout", () => {
    it("should render a bordered box with full-width content", () => {
        expect.assertions(6);

        const output = renderToString(
            <Box borderStyle="single" height={3} width={20}>
                <Text>Hello World</Text>
            </Box>,
            { columns: 30, rows: 5 },
        );

        const lines = output.split("\n");

        // Top border should have proper corners
        expect(lines[0]).toContain("┌");
        expect(lines[0]).toContain("┐");
        // Content should be inside borders
        expect(lines[1]).toContain("│");
        expect(lines[1]).toContain("Hello World");
        // Bottom border
        expect(lines[2]).toContain("└");
        expect(lines[2]).toContain("┘");
    });

    it("should render tab bar without truncation at sufficient width", () => {
        const SECTIONS = ["Layout", "Focus", "Graph", "Live", "Incremental", "UI", "Static", "Mouse"];

        expect.assertions(SECTIONS.length);

        const TabBar = () => (
            <Box borderStyle="single" flexShrink={0}>
                <Text> </Text>
                {SECTIONS.map((s, i) => (
                    <Box key={s} marginRight={1}>
                        {i === 0
                            ? (
                            <Box paddingX={1}>
                                <Text bold>{s}</Text>
                            </Box>
                            )
                            : (
                            <Box paddingX={1}>
                                <Text>{s}</Text>
                            </Box>
                            )}
                    </Box>
                ))}
                <Spacer />
                <Text>navigate | Q quit</Text>
            </Box>
        );

        const output = renderToString(<TabBar />, { columns: 100, rows: 5 });

        // All tab labels should be fully visible (not truncated)
        for (const section of SECTIONS) {
            expect(output).toContain(section);
        }
    });

    it("should position content correctly inside bordered box with padding", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box borderStyle="single" height={3} paddingX={1} width={12}>
                <Text>test</Text>
            </Box>,
            { columns: 20, rows: 5 },
        );

        const lines = output.split("\n");

        // Content row: border + padding + text + padding + border
        // │ test     │
        expect(lines[1]).toMatch(/│ test\s+│/);
    });

    it("should render nested boxes with borders correctly", () => {
        expect.assertions(3);

        const output = renderToString(
            <Box borderStyle="round" flexDirection="column" height={5} width={20}>
                <Box borderStyle="single" height={3} width={10}>
                    <Text>nested</Text>
                </Box>
            </Box>,
            { columns: 25, rows: 7 },
        );

        // Should have both round and single border chars
        expect(output).toContain("╭"); // round top-left
        expect(output).toContain("┌"); // single top-left (nested)
        expect(output).toContain("nested");
    });

    it("should handle flex row with multiple boxes", () => {
        expect.assertions(4);

        const output = renderToString(
            <Box flexDirection="row" height={3} width={40}>
                <Box borderStyle="single" height={3} width={15}>
                    <Text>A</Text>
                </Box>
                <Box borderStyle="single" height={3} width={15}>
                    <Text>B</Text>
                </Box>
            </Box>,
            { columns: 45, rows: 5 },
        );

        const lines = output.split("\n");

        // Both boxes should appear on the same row
        expect(lines[0]).toContain("┌");

        // Count the top-left corners — should be 2 (one per box)
        const topLeftCount = (lines[0].match(/┌/g) || []).length;

        expect(topLeftCount).toBe(2);
        // Both text content should be present
        expect(output).toContain("A");
        expect(output).toContain("B");
    });

    it("should use Spacer to push content apart", () => {
        expect.assertions(2);

        const output = renderToString(
            <Box borderStyle="single" height={3} width={30}>
                <Text>left</Text>
                <Spacer />
                <Text>right</Text>
            </Box>,
            { columns: 35, rows: 5 },
        );

        const lines = output.split("\n");
        const contentLine = lines[1];

        // "left" should be near the start, "right" near the end
        const leftIndex = contentLine.indexOf("left");
        const rightIndex = contentLine.indexOf("right");

        expect(leftIndex).toBeGreaterThan(0); // after border
        expect(rightIndex).toBeGreaterThan(leftIndex + 10); // well separated
    });

    it("should apply gap between flex children", () => {
        expect.assertions(2);

        const output = renderToString(
            <Box flexDirection="row" gap={3} height={3} width={30}>
                <Box borderStyle="single" height={3} width={10}>
                    <Text>A</Text>
                </Box>
                <Box borderStyle="single" height={3} width={10}>
                    <Text>B</Text>
                </Box>
            </Box>,
            { columns: 35, rows: 5 },
        );

        const lines = output.split("\n");
        const topLine = lines[0];

        // With gap=3, the two box borders should NOT be adjacent
        // Box 1 ends with ┐, then 3 spaces, then Box 2 starts with ┌
        expect(topLine).not.toContain("┐┌");

        // Find positions of the two ┐ and ┌ characters
        const firstClose = topLine.indexOf("┐");
        const secondOpen = topLine.indexOf("┌", firstClose + 1);

        // Gap of 3 means at least 3 chars between them
        expect(secondOpen - firstClose).toBeGreaterThanOrEqual(4); // ┐ + 3 spaces + ┌
    });
});
