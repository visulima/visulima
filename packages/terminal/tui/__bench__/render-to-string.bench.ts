/* eslint-disable import/no-extraneous-dependencies */
import { Box as InkBox, renderToString as inkRenderToString, Text as InkText } from "ink";
import React from "react";
import { bench, describe } from "vitest";

import { renderToString } from "../src/react/render-to-string";

const TuiSimpleApp = () =>
    React.createElement(
        "box",
        { flexDirection: "column", padding: 1 },
        React.createElement("text", { bold: true, color: "green" }, "Hello World"),
        React.createElement("text", {}, "A simple line of text."),
    );

const TuiStyledApp = () =>
    React.createElement(
        "box",
        { flexDirection: "column", padding: 1 },
        React.createElement("text", { bold: true, color: "red", underline: true }, "Hello World"),
        React.createElement(
            "box",
            { marginTop: 1, width: 60 },
            React.createElement("text", {}, "Cupcake ipsum dolor sit amet candy candy. Sesame snaps cookie I love tootsie roll apple pie bonbon wafer."),
        ),
        React.createElement(
            "box",
            { flexDirection: "column", marginTop: 1 },
            React.createElement("text", { backgroundColor: "white", color: "black" }, "Colors:"),
            React.createElement(
                "box",
                { flexDirection: "column", paddingLeft: 1 },
                React.createElement("text", {}, "- ", React.createElement("text", { color: "red" }, "Red")),
                React.createElement("text", {}, "- ", React.createElement("text", { color: "blue" }, "Blue")),
                React.createElement("text", {}, "- ", React.createElement("text", { color: "green" }, "Green")),
            ),
        ),
    );

const TuiDashboardApp = () =>
    React.createElement(
        "box",
        { flexDirection: "column", height: 24, width: 80 },
        React.createElement(
            "box",
            { borderColor: "green", borderStyle: "round", marginBottom: 1, padding: 1 },
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

const InkSimpleApp = () =>
    React.createElement(
        InkBox,
        { flexDirection: "column", padding: 1 },
        React.createElement(InkText, { bold: true, color: "green" }, "Hello World"),
        React.createElement(InkText, {}, "A simple line of text."),
    );

const InkStyledApp = () =>
    React.createElement(
        InkBox,
        { flexDirection: "column", padding: 1 },
        React.createElement(InkText, { bold: true, color: "red", underline: true }, "Hello World"),
        React.createElement(
            InkBox,
            { marginTop: 1, width: 60 },
            React.createElement(InkText, {}, "Cupcake ipsum dolor sit amet candy candy. Sesame snaps cookie I love tootsie roll apple pie bonbon wafer."),
        ),
        React.createElement(
            InkBox,
            { flexDirection: "column", marginTop: 1 },
            React.createElement(InkText, { backgroundColor: "white", color: "black" }, "Colors:"),
            React.createElement(
                InkBox,
                { flexDirection: "column", paddingLeft: 1 },
                React.createElement(InkText, {}, "- ", React.createElement(InkText, { color: "red" }, "Red")),
                React.createElement(InkText, {}, "- ", React.createElement(InkText, { color: "blue" }, "Blue")),
                React.createElement(InkText, {}, "- ", React.createElement(InkText, { color: "green" }, "Green")),
            ),
        ),
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

describe("renderToString", () => {
    describe("Simple component", () => {
        bench("@visulima/tui", () => {
            renderToString(React.createElement(TuiSimpleApp));
        });

        bench.skipIf(process.env.CODSPEED_ENV)("ink", () => {
            inkRenderToString(React.createElement(InkSimpleApp));
        });
    });

    describe("Styled component (text + colors)", () => {
        bench("@visulima/tui", () => {
            renderToString(React.createElement(TuiStyledApp));
        });

        bench.skipIf(process.env.CODSPEED_ENV)("ink", () => {
            inkRenderToString(React.createElement(InkStyledApp));
        });
    });

    describe("Dashboard (borders + multi-panel)", () => {
        bench("@visulima/tui", () => {
            renderToString(React.createElement(TuiDashboardApp), { columns: 80, rows: 24 });
        });

        bench.skipIf(process.env.CODSPEED_ENV)("ink", () => {
            inkRenderToString(React.createElement(InkDashboardApp), { columns: 80 });
        });
    });
});
