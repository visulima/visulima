import { strip as stripAnsi } from "@visulima/ansi";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { Paginator } from "../../src/index";
import { renderToString } from "../helpers/ink-render";

const items = Array.from({ length: 20 }, (_, i) => `Item ${i + 1}`);

describe("paginator", () => {
    it("renders first page of items", () => {
        expect.assertions(2);

        const output = stripAnsi(
            renderToString(
                <Paginator isFocused={false} items={items} pageSize={5}>
                    {(pageItems) => (
                        <Box flexDirection="column">
                            {pageItems.map((item, i) => (
                                <Text key={i}>{item}</Text>
                            ))}
                        </Box>
                    )}
                </Paginator>,
            ),
        );

        expect(output).toContain("Item 1");
        expect(output).toContain("Item 5");
    });

    it("does not show Item 6 on first page", () => {
        expect.assertions(1);

        const output = stripAnsi(
            renderToString(
                <Paginator isFocused={false} items={items} pageSize={5}>
                    {(pageItems) => (
                        <Box flexDirection="column">
                            {pageItems.map((item, i) => (
                                <Text key={i}>{item}</Text>
                            ))}
                        </Box>
                    )}
                </Paginator>,
            ),
        );

        expect(output).not.toContain("Item 6");
    });

    it("renders dots indicator for multiple pages", () => {
        expect.assertions(1);

        const output = stripAnsi(
            renderToString(
                <Paginator isFocused={false} items={items} pageSize={5}>
                    {(pageItems) => (
                        <Box flexDirection="column">
                            {pageItems.map((item, i) => (
                                <Text key={i}>{item}</Text>
                            ))}
                        </Box>
                    )}
                </Paginator>,
            ),
        );

        // Should have dot indicators (● and ○)
        expect(output).toMatch(/[●○]/u);
    });

    it("renders fraction style indicator", () => {
        expect.assertions(1);

        const output = stripAnsi(
            renderToString(
                <Paginator isFocused={false} items={items} pageSize={5} style="fraction">
                    {(pageItems) => (
                        <Box flexDirection="column">
                            {pageItems.map((item, i) => (
                                <Text key={i}>{item}</Text>
                            ))}
                        </Box>
                    )}
                </Paginator>,
            ),
        );

        expect(output).toContain("1/4");
    });

    it("renders numeric style indicator", () => {
        expect.assertions(2);

        const output = stripAnsi(
            renderToString(
                <Paginator isFocused={false} items={items} pageSize={5} style="numeric">
                    {(pageItems) => (
                        <Box flexDirection="column">
                            {pageItems.map((item, i) => (
                                <Text key={i}>{item}</Text>
                            ))}
                        </Box>
                    )}
                </Paginator>,
            ),
        );

        expect(output).toContain("1");
        expect(output).toContain("4");
    });

    it("passes correct meta to children", () => {
        expect.assertions(1);

        const metaCapture = vi.fn();

        renderToString(
            <Paginator isFocused={false} items={items} pageSize={5}>
                {(pageItems, meta) => {
                    metaCapture(meta);

                    return <Text>{pageItems.join(",")}</Text>;
                }}
            </Paginator>,
        );

        expect(metaCapture).toHaveBeenCalledWith(
            expect.objectContaining({
                currentPage: 0,
                endIndex: 5,
                isFirstPage: true,
                isLastPage: false,
                startIndex: 0,
                totalPages: 4,
            }),
        );
    });

    it("respects defaultPage prop", () => {
        expect.assertions(1);

        const output = stripAnsi(
            renderToString(
                <Paginator defaultPage={2} isFocused={false} items={items} pageSize={5}>
                    {(pageItems) => (
                        <Box flexDirection="column">
                            {pageItems.map((item, i) => (
                                <Text key={i}>{item}</Text>
                            ))}
                        </Box>
                    )}
                </Paginator>,
            ),
        );

        expect(output).toContain("Item 11");
    });

    it("does not show indicator for single page", () => {
        expect.assertions(1);

        const shortItems = ["A", "B", "C"];

        const output = stripAnsi(
            renderToString(
                <Paginator isFocused={false} items={shortItems} pageSize={10}>
                    {(pageItems) => <Text>{pageItems.join(",")}</Text>}
                </Paginator>,
            ),
        );

        expect(output).not.toMatch(/[●○]/u);
    });
});
