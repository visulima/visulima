/* eslint-disable import/no-extraneous-dependencies */
import React from "react";
import { bench, describe } from "vitest";

import { LayoutNode } from "../src/react/layout";
import { RatatatReconciler } from "../src/react/reconciler";
import { renderTreeToBuffer } from "../src/react/renderer";

const COLS = 80;
const ROWS = 24;
const CELLS = COLS * ROWS;

function simpleTree(n: number) {
    return React.createElement(
        "box",
        { flexDirection: "column", padding: 1 },
        React.createElement("text", { color: "green", bold: true }, "Hello World"),
        React.createElement("text", {}, `Counter: ${n}`),
    );
}

function complexTree(n: number) {
    return React.createElement(
        "box",
        { flexDirection: "column", width: COLS, height: ROWS },
        React.createElement(
            "box",
            { borderStyle: "round", borderColor: "green", padding: 1, marginBottom: 1 },
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
}

function makeContainer() {
    const root = new LayoutNode();

    root.yogaNode.setWidth(COLS);
    root.yogaNode.setHeight(ROWS);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const container = (RatatatReconciler as any).createContainer(root, 0, null, false, null, "", () => {}, null);

    return { buffer: new Uint32Array(CELLS * 2), container, root };
}

function doRender(ctx: ReturnType<typeof makeContainer>, element: React.ReactElement) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    RatatatReconciler.updateContainer(element as any, ctx.container, null, () => {});
    ctx.root.calculateLayout(COLS, ROWS);
    renderTreeToBuffer(ctx.root, ctx.buffer, COLS, ROWS);
}

describe("Render Pipeline", () => {
    describe("Mount + Render", () => {
        const mountCtx = makeContainer();

        bench("simple tree", () => {
            doRender(mountCtx, simpleTree(0));
        });

        bench("complex tree", () => {
            doRender(mountCtx, complexTree(0));
        });
    });

    describe("Rerender (state change)", () => {
        let frameSimple = 0;
        const simpleCtx = makeContainer();

        doRender(simpleCtx, simpleTree(0));

        bench("simple tree", () => {
            doRender(simpleCtx, simpleTree(++frameSimple));
        });

        let frameComplex = 0;
        const complexCtx = makeContainer();

        doRender(complexCtx, complexTree(0));

        bench("complex tree", () => {
            doRender(complexCtx, complexTree(++frameComplex));
        });
    });
});
