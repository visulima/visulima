/* eslint-disable import/no-extraneous-dependencies */
import { PassThrough } from "node:stream";

import { render as jrInkRender, Box as JrInkBox, Text as JrInkText } from "@jrichman/ink";
import { render as inkRender, Box as InkBox, Text as InkText } from "ink";
import React from "react";
import { bench, describe } from "vitest";

import tuiRender from "../src/ink/render";

function createMockStdout() {
    const stream = new PassThrough() as NodeJS.WriteStream;

    stream.columns = 80;
    stream.rows = 24;

    return stream;
}

// --- @visulima/tui components ---

function TuiSimpleApp() {
    return React.createElement(
        "box",
        { flexDirection: "column", padding: 1 },
        React.createElement("text", { color: "green", bold: true }, "Hello World"),
        React.createElement("text", {}, "A simple line of text."),
    );
}

function TuiDashboardApp() {
    return React.createElement(
        "box",
        { flexDirection: "column", width: 80, height: 24 },
        React.createElement(
            "box",
            { borderStyle: "round", borderColor: "green", padding: 1, marginBottom: 1 },
            React.createElement("text", { bold: true, color: "cyan" }, "Dashboard"),
        ),
        React.createElement(
            "box",
            { flexDirection: "row", gap: 2 },
            React.createElement(
                "box",
                { borderStyle: "single", width: 20 },
                React.createElement("text", { color: "yellow" }, "Panel A"),
                React.createElement("text", {}, "val: 42"),
            ),
            React.createElement(
                "box",
                { borderStyle: "single", width: 20 },
                React.createElement("text", { color: "magenta" }, "Panel B"),
                React.createElement("text", {}, "val: 77"),
            ),
            React.createElement(
                "box",
                { borderStyle: "single", width: 20 },
                React.createElement("text", { color: "blue" }, "Panel C"),
                React.createElement("text", {}, "val: 13"),
            ),
        ),
    );
}

// --- ink components ---

function InkSimpleApp() {
    return React.createElement(
        InkBox,
        { flexDirection: "column", padding: 1 },
        React.createElement(InkText, { color: "green", bold: true }, "Hello World"),
        React.createElement(InkText, {}, "A simple line of text."),
    );
}

function InkDashboardApp() {
    return React.createElement(
        InkBox,
        { flexDirection: "column", width: 80, height: 24 },
        React.createElement(
            InkBox,
            { borderStyle: "round", borderColor: "green", padding: 1, marginBottom: 1 },
            React.createElement(InkText, { bold: true, color: "cyan" }, "Dashboard"),
        ),
        React.createElement(
            InkBox,
            { flexDirection: "row", gap: 2 },
            React.createElement(
                InkBox,
                { borderStyle: "single", width: 20 },
                React.createElement(InkText, { color: "yellow" }, "Panel A"),
                React.createElement(InkText, {}, "val: 42"),
            ),
            React.createElement(
                InkBox,
                { borderStyle: "single", width: 20 },
                React.createElement(InkText, { color: "magenta" }, "Panel B"),
                React.createElement(InkText, {}, "val: 77"),
            ),
            React.createElement(
                InkBox,
                { borderStyle: "single", width: 20 },
                React.createElement(InkText, { color: "blue" }, "Panel C"),
                React.createElement(InkText, {}, "val: 13"),
            ),
        ),
    );
}

// --- @jrichman/ink components ---

function JrInkSimpleApp() {
    return React.createElement(
        JrInkBox,
        { flexDirection: "column", padding: 1 },
        React.createElement(JrInkText, { color: "green", bold: true }, "Hello World"),
        React.createElement(JrInkText, {}, "A simple line of text."),
    );
}

function JrInkDashboardApp() {
    return React.createElement(
        JrInkBox,
        { flexDirection: "column", width: 80, height: 24 },
        React.createElement(
            JrInkBox,
            { borderStyle: "round", borderColor: "green", padding: 1, marginBottom: 1 },
            React.createElement(JrInkText, { bold: true, color: "cyan" }, "Dashboard"),
        ),
        React.createElement(
            JrInkBox,
            { flexDirection: "row", gap: 2 },
            React.createElement(
                JrInkBox,
                { borderStyle: "single", width: 20 },
                React.createElement(JrInkText, { color: "yellow" }, "Panel A"),
                React.createElement(JrInkText, {}, "val: 42"),
            ),
            React.createElement(
                JrInkBox,
                { borderStyle: "single", width: 20 },
                React.createElement(JrInkText, { color: "magenta" }, "Panel B"),
                React.createElement(JrInkText, {}, "val: 77"),
            ),
            React.createElement(
                JrInkBox,
                { borderStyle: "single", width: 20 },
                React.createElement(JrInkText, { color: "blue" }, "Panel C"),
                React.createElement(JrInkText, {}, "val: 13"),
            ),
        ),
    );
}

const renderOpts = { exitOnCtrlC: false, patchConsole: false };

describe("render (mount + first paint)", () => {
    describe("Simple component", () => {
        bench("@visulima/tui", () => {
            const stdout = createMockStdout();
            const inst = tuiRender(React.createElement(TuiSimpleApp), { ...renderOpts, stdout } as any);

            inst.unmount();
        });

        bench("ink", () => {
            const stdout = createMockStdout();
            const inst = inkRender(React.createElement(InkSimpleApp), { ...renderOpts, stdout } as any);

            inst.unmount();
        });

        bench("@jrichman/ink", () => {
            const stdout = createMockStdout();
            const inst = jrInkRender(React.createElement(JrInkSimpleApp), { ...renderOpts, stdout } as any);

            inst.unmount();
        });
    });

    describe("Dashboard (borders + multi-panel)", () => {
        bench("@visulima/tui", () => {
            const stdout = createMockStdout();
            const inst = tuiRender(React.createElement(TuiDashboardApp), { ...renderOpts, stdout } as any);

            inst.unmount();
        });

        bench("ink", () => {
            const stdout = createMockStdout();
            const inst = inkRender(React.createElement(InkDashboardApp), { ...renderOpts, stdout } as any);

            inst.unmount();
        });

        bench("@jrichman/ink", () => {
            const stdout = createMockStdout();
            const inst = jrInkRender(React.createElement(JrInkDashboardApp), { ...renderOpts, stdout } as any);

            inst.unmount();
        });
    });
});

describe("render (rerender)", () => {
    describe("Simple component", () => {
        const tuiStdout = createMockStdout();
        const tuiInst = tuiRender(React.createElement(TuiSimpleApp), { ...renderOpts, stdout: tuiStdout } as any);
        let tuiFrame = 0;

        bench(
            "@visulima/tui",
            () => {
                tuiInst.rerender(
                    React.createElement(
                        "box",
                        { flexDirection: "column", padding: 1 },
                        React.createElement("text", { color: "green", bold: true }, "Hello World"),
                        React.createElement("text", {}, `Counter: ${++tuiFrame}`),
                    ),
                );
            },
            { teardown: () => tuiInst.unmount() },
        );

        const inkStdout = createMockStdout();
        const inkInst = inkRender(React.createElement(InkSimpleApp), { ...renderOpts, stdout: inkStdout } as any);
        let inkFrame = 0;

        bench(
            "ink",
            () => {
                inkInst.rerender(
                    React.createElement(
                        InkBox,
                        { flexDirection: "column", padding: 1 },
                        React.createElement(InkText, { color: "green", bold: true }, "Hello World"),
                        React.createElement(InkText, {}, `Counter: ${++inkFrame}`),
                    ),
                );
            },
            { teardown: () => inkInst.unmount() },
        );

        const jrStdout = createMockStdout();
        const jrInst = jrInkRender(React.createElement(JrInkSimpleApp), { ...renderOpts, stdout: jrStdout } as any);
        let jrFrame = 0;

        bench(
            "@jrichman/ink",
            () => {
                jrInst.rerender(
                    React.createElement(
                        JrInkBox,
                        { flexDirection: "column", padding: 1 },
                        React.createElement(JrInkText, { color: "green", bold: true }, "Hello World"),
                        React.createElement(JrInkText, {}, `Counter: ${++jrFrame}`),
                    ),
                );
            },
            { teardown: () => jrInst.unmount() },
        );
    });
});
