// @ts-nocheck
import React from "react";
import { describe, expect, it } from "vitest";

import { measureElement } from "../../src/react/hooks";
import { LayoutNode } from "../../src/react/layout";
import { renderToString } from "../../src/react/render-to-string";

const Box: React.FC<any> = (props) => React.createElement("box", props, props.children);
const Text: React.FC<any> = (props) => React.createElement("text", props, props.children);

const view = (offset: Record<string, number>) => (
    <Box flexDirection="column" height={2} overflow="hidden" width={6} {...offset}>
        <Box flexDirection="column" flexShrink={0}>
            <Text>AAAAAA</Text>
            <Text>BBBBBB</Text>
            <Text>CCCCCC</Text>
        </Box>
    </Box>
);

describe("react layer: contentOffset and client metrics", () => {
    it("shifts children up by contentOffsetY", () => {
        expect.assertions(3);

        const output = renderToString(view({ contentOffsetY: 1 }), { columns: 10, rows: 4 });

        expect(output).not.toContain("AAAAAA");
        expect(output).toContain("BBBBBB");
        expect(output).toContain("CCCCCC");
    });

    it("shifts children left by contentOffsetX and ignores non-finite offsets", () => {
        expect.assertions(2);

        const shifted = renderToString(
            <Box contentOffsetX={2} height={1} overflow="hidden" width={3}>
                <Box flexShrink={0} width={6}>
                    <Text>ABCDEF</Text>
                </Box>
            </Box>,
            { columns: 10, rows: 2 },
        );

        expect(shifted).toContain("CDE");
        expect(renderToString(view({ contentOffsetY: Number.NaN }), { columns: 10, rows: 4 })).toContain("AAAAAA");
    });

    it("measureElement reports the size without borders", () => {
        expect.assertions(1);

        const node = new LayoutNode();

        node.yogaNode.setWidth(10);
        node.yogaNode.setHeight(5);
        node.yogaNode.setBorder(0, 1);
        node.yogaNode.setBorder(1, 1);
        node.yogaNode.setBorder(2, 1);
        node.yogaNode.setBorder(3, 1);
        node.yogaNode.calculateLayout(10, 5);

        expect(measureElement(node)).toStrictEqual({ clientHeight: 3, clientWidth: 8, height: 5, width: 10 });
    });
});
