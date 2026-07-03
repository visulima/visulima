/* eslint-disable import/no-extraneous-dependencies */
import React from "react";
import { bench, describe } from "vitest";

import { LayoutNode } from "../src/react/layout";
import { TuiReconciler } from "../src/react/reconciler";
import { renderTreeToBuffer } from "../src/react/renderer";

const COLS = 80;
const ROWS = 24;
const CELLS = COLS * ROWS;

const simpleTree = (n: number) =>
    React.createElement(
        "box",
        { flexDirection: "column", padding: 1 },
        React.createElement("text", { bold: true, color: "green" }, "Hello World"),
        React.createElement("text", {}, `Counter: ${n}`),
    );

const complexTree = (n: number) =>
    React.createElement(
        "box",
        { flexDirection: "column", height: ROWS, width: COLS },
        React.createElement(
            "box",
            { borderColor: "green", borderStyle: "round", marginBottom: 1, padding: 1 },
            React.createElement("text", { bold: true, color: "cyan" }, "ratatat benchmark"),
            React.createElement("text", { color: "white" }, `Frame: ${n}`),
        ),
        React.createElement(
            "box",
            { flexDirection: "row", gap: 2 },
            React.createElement(
                "box",
                { borderStyle: "single", width: 20 },
                React.createElement("text", { color: "yellow" }, "Panel A"),
                React.createElement("text", {}, `val: ${n % 100}`),
            ),
            React.createElement(
                "box",
                { borderStyle: "single", width: 20 },
                React.createElement("text", { color: "magenta" }, "Panel B"),
                React.createElement("text", {}, `val: ${(n * 7) % 100}`),
            ),
            React.createElement(
                "box",
                { borderStyle: "single", width: 20 },
                React.createElement("text", { color: "blue" }, "Panel C"),
                React.createElement("text", {}, `val: ${(n * 13) % 100}`),
            ),
        ),
        React.createElement("box", { marginTop: 1 }, React.createElement("text", { dim: true }, "Press Ctrl+C to exit")),
    );

const makeContainer = () => {
    const root = new LayoutNode();

    root.yogaNode.setWidth(COLS);
    root.yogaNode.setHeight(ROWS);

    const container = (TuiReconciler as any).createContainer(root, 0, null, false, null, "", () => {}, null);

    return { buffer: new Uint32Array(CELLS * 2), container, root };
};

const doRender = (context: ReturnType<typeof makeContainer>, element: React.ReactElement) => {
    TuiReconciler.updateContainer(element as any, context.container, null, () => {});
    context.root.calculateLayout(COLS, ROWS);
    renderTreeToBuffer(context.root, context.buffer, COLS, ROWS);
};

describe("Render Pipeline", () => {
    describe("Mount + Render", () => {
        const mountContext = makeContainer();

        bench("simple tree", () => {
            doRender(mountContext, simpleTree(0));
        });

        bench("complex tree", () => {
            doRender(mountContext, complexTree(0));
        });
    });

    describe("Rerender (state change)", () => {
        let frameSimple = 0;
        const simpleContext = makeContainer();

        doRender(simpleContext, simpleTree(0));

        bench("simple tree", () => {
            doRender(simpleContext, simpleTree(++frameSimple));
        });

        let frameComplex = 0;
        const complexContext = makeContainer();

        doRender(complexContext, complexTree(0));

        bench("complex tree", () => {
            doRender(complexContext, complexTree(++frameComplex));
        });
    });
});
