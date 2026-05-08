/* eslint-disable import/no-extraneous-dependencies */
import { PassThrough } from "node:stream";

import { Box as JrInkBox, render as jrInkRender, Text as JrInkText } from "@jrichman/ink";
import { Box as InkBox, render as inkRender, Text as InkText } from "ink";
import React from "react";
import { bench, describe } from "vitest";

// Import from production build (pre-compiled JS) for accurate benchmarks.
// Run `pnpm --filter @visulima/tui run build:prod` before benchmarking.
import { Box as TuiBox } from "../dist/components/box.js";
import { Text as TuiText } from "../dist/components/text.js";
import { render as tuiRender } from "../dist/ink/index.js";

const createMockStdout = () => {
    const stream = new PassThrough() as NodeJS.WriteStream;

    stream.columns = 80;
    stream.rows = 24;

    return stream;
};

// --- @visulima/tui components (use exported Box/Text from dist) ---

const TuiSimpleApp = () =>
    React.createElement(
        TuiBox,
        { flexDirection: "column", padding: 1 },
        React.createElement(TuiText, { bold: true, color: "green" }, "Hello World"),
        React.createElement(TuiText, {}, "A simple line of text."),
    );

const TuiDashboardApp = () =>
    React.createElement(
        TuiBox,
        { flexDirection: "column", height: 24, width: 80 },
        React.createElement(
            TuiBox,
            { borderColor: "green", borderStyle: "round", marginBottom: 1, padding: 1 },
            React.createElement(TuiText, { bold: true, color: "cyan" }, "Dashboard"),
        ),
        React.createElement(
            TuiBox,
            { flexDirection: "row", gap: 2 },
            React.createElement(
                TuiBox,
                { borderStyle: "single", width: 20 },
                React.createElement(TuiText, { color: "yellow" }, "Panel A"),
                React.createElement(TuiText, {}, "val: 42"),
            ),
            React.createElement(
                TuiBox,
                { borderStyle: "single", width: 20 },
                React.createElement(TuiText, { color: "magenta" }, "Panel B"),
                React.createElement(TuiText, {}, "val: 77"),
            ),
            React.createElement(
                TuiBox,
                { borderStyle: "single", width: 20 },
                React.createElement(TuiText, { color: "blue" }, "Panel C"),
                React.createElement(TuiText, {}, "val: 13"),
            ),
        ),
    );

// --- ink components ---

const InkSimpleApp = () =>
    React.createElement(
        InkBox,
        { flexDirection: "column", padding: 1 },
        React.createElement(InkText, { bold: true, color: "green" }, "Hello World"),
        React.createElement(InkText, {}, "A simple line of text."),
    );

const InkDashboardApp = () =>
    React.createElement(
        InkBox,
        { flexDirection: "column", height: 24, width: 80 },
        React.createElement(
            InkBox,
            { borderColor: "green", borderStyle: "round", marginBottom: 1, padding: 1 },
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

// --- @jrichman/ink components ---

const JrInkSimpleApp = () =>
    React.createElement(
        JrInkBox,
        { flexDirection: "column", padding: 1 },
        React.createElement(JrInkText, { bold: true, color: "green" }, "Hello World"),
        React.createElement(JrInkText, {}, "A simple line of text."),
    );

const JrInkDashboardApp = () =>
    React.createElement(
        JrInkBox,
        { flexDirection: "column", height: 24, width: 80 },
        React.createElement(
            JrInkBox,
            { borderColor: "green", borderStyle: "round", marginBottom: 1, padding: 1 },
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

const renderOptions = { exitOnCtrlC: false, patchConsole: false };

describe("render (mount + first paint)", () => {
    describe("Simple component", () => {
        bench("@visulima/tui", () => {
            const stdout = createMockStdout();
            const inst = tuiRender(React.createElement(TuiSimpleApp), { ...renderOptions, stdout });

            inst.unmount();
        });

        bench.skipIf(process.env.CODSPEED_ENV)("ink", () => {
            const stdout = createMockStdout();
            const inst = inkRender(React.createElement(InkSimpleApp), { ...renderOptions, stdout });

            inst.unmount();
        });

        bench.skipIf(process.env.CODSPEED_ENV)("@jrichman/ink", () => {
            const stdout = createMockStdout();
            const inst = jrInkRender(React.createElement(JrInkSimpleApp), { ...renderOptions, stdout });

            inst.unmount();
        });
    });

    describe("Dashboard (borders + multi-panel)", () => {
        bench("@visulima/tui", () => {
            const stdout = createMockStdout();
            const inst = tuiRender(React.createElement(TuiDashboardApp), { ...renderOptions, stdout });

            inst.unmount();
        });

        bench.skipIf(process.env.CODSPEED_ENV)("ink", () => {
            const stdout = createMockStdout();
            const inst = inkRender(React.createElement(InkDashboardApp), { ...renderOptions, stdout });

            inst.unmount();
        });

        bench.skipIf(process.env.CODSPEED_ENV)("@jrichman/ink", () => {
            const stdout = createMockStdout();
            const inst = jrInkRender(React.createElement(JrInkDashboardApp), { ...renderOptions, stdout });

            inst.unmount();
        });
    });
});

describe("render (rerender)", () => {
    describe("Simple component", () => {
        const tuiStdout = createMockStdout();
        const tuiInst = tuiRender(React.createElement(TuiSimpleApp), { ...renderOptions, stdout: tuiStdout });
        let tuiFrame = 0;

        bench(
            "@visulima/tui",
            () => {
                tuiInst.rerender(
                    React.createElement(
                        TuiBox,
                        { flexDirection: "column", padding: 1 },
                        React.createElement(TuiText, { bold: true, color: "green" }, "Hello World"),
                        React.createElement(TuiText, {}, `Counter: ${++tuiFrame}`),
                    ),
                );
            },
            { teardown: () => tuiInst.unmount() },
        );

        const inkStdout = createMockStdout();
        const inkInst = inkRender(React.createElement(InkSimpleApp), { ...renderOptions, stdout: inkStdout });
        let inkFrame = 0;

        bench.skipIf(process.env.CODSPEED_ENV)(
            "ink",
            () => {
                inkInst.rerender(
                    React.createElement(
                        InkBox,
                        { flexDirection: "column", padding: 1 },
                        React.createElement(InkText, { bold: true, color: "green" }, "Hello World"),
                        React.createElement(InkText, {}, `Counter: ${++inkFrame}`),
                    ),
                );
            },
            {
                teardown: () => {
                    inkInst.unmount();
                },
            },
        );

        const jrStdout = createMockStdout();
        const jrInst = jrInkRender(React.createElement(JrInkSimpleApp), { ...renderOptions, stdout: jrStdout });
        let jrFrame = 0;

        bench.skipIf(process.env.CODSPEED_ENV)(
            "@jrichman/ink",
            () => {
                jrInst.rerender(
                    React.createElement(
                        JrInkBox,
                        { flexDirection: "column", padding: 1 },
                        React.createElement(JrInkText, { bold: true, color: "green" }, "Hello World"),
                        React.createElement(JrInkText, {}, `Counter: ${++jrFrame}`),
                    ),
                );
            },
            {
                teardown: () => {
                    jrInst.unmount();
                },
            },
        );
    });
});
