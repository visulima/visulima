// @ts-nocheck

/**
 * Snapshot tests for the kitchen-sink Layout (Flexbox) section.
 *
 * These verify the exact rendered output of every flexbox feature
 * demonstrated in the kitchen-sink: justifyContent modes, alignItems
 * modes, Spacer, nested borders, and the staircase boxes.
 *
 * If a renderer or layout change causes visual differences, these
 * snapshots will catch it immediately.
 */
import React from "react";
import { describe, expect, it } from "vitest";

import { renderToString } from "../../src/react/render-to-string";

const Box: React.FC<any> = (props) => React.createElement("box", props, props.children);
const Text: React.FC<any> = (props) => React.createElement("text", props, props.children);
const Spacer: React.FC = () => React.createElement(Box, { flexGrow: 1 });

// ─── Helpers (mirror kitchen-sink.tsx) ───────────────────────────────────────

const SectionHeading = ({ title }: { title: string }) => (
    <Box marginBottom={1}>
        <Text bold color="cyan">
            ━━
{" "}
{title}
{" "}
        </Text>
        <Text dim>{"━".repeat(Math.max(0, 40 - title.length - 4))}</Text>
    </Box>
);

// ─── Full Layout section (exactly as in kitchen-sink.tsx) ────────────────────

const LayoutSection = () => (
    <Box flexDirection="column">
        <SectionHeading title="Layout (Flexbox)" />
        <Box flexDirection="row" gap={3}>
            {/* justify-content */}
            <Box flexDirection="column" gap={1}>
                <Text bold dim>
                    justifyContent
                </Text>
                {(["flex-start", "center", "flex-end", "space-between", "space-around"] as const).map((j) => (
                    <Box borderColor="gray" borderStyle="single" justifyContent={j} key={j} width={26}>
                        <Text color="yellow">▪</Text>
                        <Text color="cyan">▪</Text>
                        <Text color="green">▪</Text>
                    </Box>
                ))}
            </Box>
            {/* align-items */}
            <Box flexDirection="column" gap={1}>
                <Text bold dim>
                    alignItems
                </Text>
                {(["flex-start", "center", "flex-end"] as const).map((a) => (
                    <Box alignItems={a} borderColor="gray" borderStyle="single" height={5} key={a} width={16}>
                        <Text color="magenta">▪▪▪</Text>
                    </Box>
                ))}
            </Box>
            {/* Spacer + nesting */}
            <Box flexDirection="column" gap={1}>
                <Text bold dim>
                    Spacer / nesting
                </Text>
                <Box borderColor="gray" borderStyle="single" width={24}>
                    <Text color="green">◀ left</Text>
                    <Spacer />
                    <Text color="red">right ▶</Text>
                </Box>
                <Box borderColor="cyan" borderStyle="round" padding={1} width={24}>
                    <Box borderColor="yellow" borderStyle="single" paddingX={1}>
                        <Text color="yellow">nested</Text>
                    </Box>
                </Box>
                <Box flexDirection="row" gap={1}>
                    {[1, 2, 3].map((n) => (
                        <Box alignItems="center" borderColor="blue" borderStyle="single" height={n + 1} justifyContent="center" key={n} width={6}>
                            <Text color="blue">{n}</Text>
                        </Box>
                    ))}
                </Box>
            </Box>
        </Box>
    </Box>
);

// ─── Snapshot tests ──────────────────────────────────────────────────────────

describe("kitchen-sink Layout (Flexbox) snapshots", () => {
    it("should render the full layout section at 130x40", () => {
        expect.assertions(1);

        const output = renderToString(<LayoutSection />, { columns: 130, rows: 40 });

        expect(output).toMatchSnapshot();
    });

    it("should render the full layout section at 80x30 (narrower terminal)", () => {
        expect.assertions(1);

        const output = renderToString(<LayoutSection />, { columns: 80, rows: 30 });

        expect(output).toMatchSnapshot();
    });

    // ─── justifyContent ──────────────────────────────────────────────────

    describe("justifyContent", () => {
        it.each(["flex-start", "center", "flex-end", "space-between", "space-around"] as const)("should render justifyContent=%s correctly", (mode) => {
            expect.assertions(1);

            const output = renderToString(
                <Box borderStyle="single" justifyContent={mode} width={26}>
                    <Text>▪</Text>
                    <Text>▪</Text>
                    <Text>▪</Text>
                </Box>,
                { columns: 30, rows: 5 },
            );

            expect(output).toMatchSnapshot();
        });
    });

    // ─── alignItems ──────────────────────────────────────────────────────

    describe("alignItems", () => {
        it.each(["flex-start", "center", "flex-end"] as const)("should render alignItems=%s with height=5", (mode) => {
            expect.assertions(1);

            const output = renderToString(
                <Box alignItems={mode} borderStyle="single" height={5} width={16}>
                    <Text>▪▪▪</Text>
                </Box>,
                { columns: 20, rows: 7 },
            );

            expect(output).toMatchSnapshot();
        });
    });

    // ─── Spacer ──────────────────────────────────────────────────────────

    describe("spacer", () => {
        it("should push content to opposite ends of a row", () => {
            expect.assertions(1);

            const output = renderToString(
                <Box borderStyle="single" width={24}>
                    <Text>◀ left</Text>
                    <Spacer />
                    <Text>right ▶</Text>
                </Box>,
                { columns: 30, rows: 5 },
            );

            expect(output).toMatchSnapshot();
        });
    });

    // ─── Nested borders ──────────────────────────────────────────────────

    describe("nested borders", () => {
        it("should render nested box with different border styles", () => {
            expect.assertions(1);

            const output = renderToString(
                <Box borderStyle="round" padding={1} width={24}>
                    <Box borderStyle="single" paddingX={1}>
                        <Text>nested</Text>
                    </Box>
                </Box>,
                { columns: 30, rows: 7 },
            );

            expect(output).toMatchSnapshot();
        });
    });

    // ─── Staircase (increasing heights) ──────────────────────────────────

    describe("staircase boxes", () => {
        it("should render boxes with increasing heights in a row", () => {
            expect.assertions(1);

            const output = renderToString(
                <Box flexDirection="row" gap={1}>
                    {[1, 2, 3].map((n) => (
                        <Box alignItems="center" borderStyle="single" height={n + 1} justifyContent="center" key={n} width={6}>
                            <Text>{n}</Text>
                        </Box>
                    ))}
                </Box>,
                { columns: 25, rows: 7 },
            );

            expect(output).toMatchSnapshot();
        });
    });

    // ─── Gap ─────────────────────────────────────────────────────────────

    describe("gap spacing", () => {
        it("should apply row gap=3 between columns", () => {
            expect.assertions(1);

            const output = renderToString(
                <Box flexDirection="row" gap={3}>
                    <Box borderStyle="single" height={3} width={8}>
                        <Text>A</Text>
                    </Box>
                    <Box borderStyle="single" height={3} width={8}>
                        <Text>B</Text>
                    </Box>
                    <Box borderStyle="single" height={3} width={8}>
                        <Text>C</Text>
                    </Box>
                </Box>,
                { columns: 40, rows: 5 },
            );

            expect(output).toMatchSnapshot();
        });

        it("should apply column gap=1 between rows", () => {
            expect.assertions(1);

            const output = renderToString(
                <Box flexDirection="column" gap={1}>
                    <Box borderStyle="single" height={3} width={12}>
                        <Text>Row 1</Text>
                    </Box>
                    <Box borderStyle="single" height={3} width={12}>
                        <Text>Row 2</Text>
                    </Box>
                </Box>,
                { columns: 20, rows: 10 },
            );

            expect(output).toMatchSnapshot();
        });
    });

    // ─── flexDirection ───────────────────────────────────────────────────

    describe("flexDirection", () => {
        it("should lay out children in a column", () => {
            expect.assertions(1);

            const output = renderToString(
                <Box flexDirection="column" width={10}>
                    <Text>first</Text>
                    <Text>second</Text>
                    <Text>third</Text>
                </Box>,
                { columns: 15, rows: 5 },
            );

            expect(output).toMatchSnapshot();
        });

        it("should lay out children in a row (default)", () => {
            expect.assertions(1);

            const output = renderToString(
                <Box width={20}>
                    <Text>A </Text>
                    <Text>B </Text>
                    <Text>C</Text>
                </Box>,
                { columns: 25, rows: 3 },
            );

            expect(output).toMatchSnapshot();
        });
    });

    // ─── flexGrow / flexShrink ───────────────────────────────────────────

    describe("flexGrow", () => {
        it("should distribute remaining space according to flexGrow", () => {
            expect.assertions(1);

            const output = renderToString(
                <Box height={3} width={30}>
                    <Box borderStyle="single" flexGrow={1} height={3}>
                        <Text>grow</Text>
                    </Box>
                    <Box borderStyle="single" height={3} width={8}>
                        <Text>fixed</Text>
                    </Box>
                </Box>,
                { columns: 35, rows: 5 },
            );

            expect(output).toMatchSnapshot();
        });
    });

    // ─── Padding and margin ──────────────────────────────────────────────

    describe("padding and margin", () => {
        it("should render box with padding", () => {
            expect.assertions(1);

            const output = renderToString(
                <Box borderStyle="single" height={5} paddingX={2} paddingY={1} width={20}>
                    <Text>padded</Text>
                </Box>,
                { columns: 25, rows: 7 },
            );

            expect(output).toMatchSnapshot();
        });

        it("should render box with margin", () => {
            expect.assertions(1);

            const output = renderToString(
                <Box flexDirection="column" height={5} width={20}>
                    <Box borderStyle="single" height={3} marginLeft={3} width={10}>
                        <Text>margin</Text>
                    </Box>
                </Box>,
                { columns: 25, rows: 7 },
            );

            expect(output).toMatchSnapshot();
        });
    });
});
