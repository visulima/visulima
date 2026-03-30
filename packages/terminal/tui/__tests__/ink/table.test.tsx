import { strip } from "@visulima/ansi";
import React from "react";
import { describe, expect, it } from "vitest";

import { Table } from "../../src/ink/index";
import { renderToString } from "../helpers/ink-render";

describe("Table", () => {
    it("should render a basic table with headers", () => {
        const data = [
            { name: "Alice", age: 30 },
            { name: "Bob", age: 25 },
        ];

        const output = strip(renderToString(<Table data={data} />));

        expect(output).toContain("name");
        expect(output).toContain("age");
        expect(output).toContain("Alice");
        expect(output).toContain("Bob");
        expect(output).toContain("30");
        expect(output).toContain("25");
    });

    it("should return empty string for empty data", () => {
        const output = renderToString(<Table data={[]} />);

        expect(output).toBe("");
    });

    it("should render only specified columns in order", () => {
        const data = [
            { name: "Alice", age: 30, city: "NYC" },
        ];

        const output = strip(renderToString(<Table data={data} columns={["city", "name"]} />));

        expect(output).toContain("city");
        expect(output).toContain("name");
        // "age" column should not appear
        expect(output).not.toContain("age");
        // city should appear before name in the output
        const cityIndex = output.indexOf("city");
        const nameIndex = output.indexOf("name");

        expect(cityIndex).toBeLessThan(nameIndex);
    });

    it("should support ColumnConfig objects with custom headers", () => {
        const data = [
            { name: "Alice", age: 30 },
        ];

        const output = strip(renderToString(
            <Table
                data={data}
                columns={[
                    { key: "name", header: "Full Name" },
                    { key: "age", header: "Years" },
                ]}
            />,
        ));

        expect(output).toContain("Full Name");
        expect(output).toContain("Years");
        expect(output).toContain("Alice");
        expect(output).toContain("30");
    });

    it("should support mixed string and ColumnConfig columns", () => {
        const data = [
            { name: "Alice", age: 30 },
        ];

        const output = strip(renderToString(
            <Table
                data={data}
                columns={[
                    "name",
                    { key: "age", header: "Years" },
                ]}
            />,
        ));

        expect(output).toContain("name");
        expect(output).toContain("Years");
    });

    it("should apply custom padding", () => {
        const data = [{ a: "x" }];

        const outputPad1 = strip(renderToString(<Table data={data} padding={1} />));
        const outputPad3 = strip(renderToString(<Table data={data} padding={3} />));

        // More padding means wider output
        expect(outputPad3.length).toBeGreaterThan(outputPad1.length);
    });

    it("should render with rounded border style", () => {
        const data = [{ name: "Alice" }];

        const output = strip(renderToString(<Table data={data} borderStyle="rounded" />));

        // Rounded borders use ╭ and ╮ corners
        expect(output).toContain("╭");
        expect(output).toContain("╮");
    });

    it("should render with ascii border style", () => {
        const data = [{ name: "Alice" }];

        const output = strip(renderToString(<Table data={data} borderStyle="ascii" />));

        // ASCII borders use + for corners
        expect(output).toContain("+");
    });

    it("should render with no border style", () => {
        const data = [{ name: "Alice" }];

        const output = strip(renderToString(<Table data={data} borderStyle="none" />));

        // No borders should not contain box-drawing characters
        expect(output).not.toContain("┌");
        expect(output).not.toContain("│");
        expect(output).not.toContain("─");
    });

    it("should render with double border style", () => {
        const data = [{ name: "Alice" }];

        const output = strip(renderToString(<Table data={data} borderStyle="double" />));

        // Double borders use ╔ and ║
        expect(output).toContain("╔");
        expect(output).toContain("║");
    });

    it("should render with a custom BorderStyle object", () => {
        const data = [{ name: "Alice" }];

        const customBorder = {
            bodyJoin: { char: "|", width: 1 },
            bodyLeft: { char: "|", width: 1 },
            bodyRight: { char: "|", width: 1 },
            bottomBody: { char: "=", width: 1 },
            bottomJoin: { char: "=", width: 1 },
            bottomLeft: { char: "=", width: 1 },
            bottomRight: { char: "=", width: 1 },
            joinBody: { char: "=", width: 1 },
            joinJoin: { char: "=", width: 1 },
            joinLeft: { char: "=", width: 1 },
            joinRight: { char: "=", width: 1 },
            topBody: { char: "=", width: 1 },
            topJoin: { char: "=", width: 1 },
            topLeft: { char: "=", width: 1 },
            topRight: { char: "=", width: 1 },
        };

        const output = strip(renderToString(<Table data={data} borderStyle={customBorder} />));

        expect(output).toContain("=");
        expect(output).toContain("|");
    });

    it("should hide headers when showHeader is false", () => {
        const data = [
            { name: "Alice", age: 30 },
        ];

        const withHeader = strip(renderToString(<Table data={data} showHeader />));
        const withoutHeader = strip(renderToString(<Table data={data} showHeader={false} />));

        // Without header should be shorter
        expect(withoutHeader.length).toBeLessThan(withHeader.length);
        // Data should still appear
        expect(withoutHeader).toContain("Alice");
    });

    it("should apply formatCell", () => {
        const data = [
            { name: "alice", age: 30 },
        ];

        const output = strip(renderToString(
            <Table
                data={data}
                formatCell={(value, column) => {
                    if (column === "name" && typeof value === "string") {
                        return value.toUpperCase();
                    }

                    return String(value ?? "");
                }}
            />,
        ));

        expect(output).toContain("ALICE");
    });

    it("should apply formatHeader", () => {
        const data = [
            { name: "Alice" },
        ];

        const output = strip(renderToString(
            <Table
                data={data}
                formatHeader={(column) => column.toUpperCase()}
            />,
        ));

        expect(output).toContain("NAME");
    });

    it("should replace null and undefined values with skeleton", () => {
        const data = [
            { name: "Alice", city: null },
            { name: "Bob", city: undefined },
        ];

        const output = strip(renderToString(
            <Table data={data} skeleton="N/A" />,
        ));

        expect(output).toContain("N/A");
    });

    it("should default skeleton to empty string", () => {
        const data = [
            { name: null },
        ];

        const output = strip(renderToString(<Table data={data} />));

        // Should render without errors; null cell should be empty
        expect(output).toContain("name");
    });

    it("should render a single column table", () => {
        const data = [
            { id: 1 },
            { id: 2 },
        ];

        const output = strip(renderToString(<Table data={data} />));

        expect(output).toContain("id");
        expect(output).toContain("1");
        expect(output).toContain("2");
    });

    it("should render a single row table", () => {
        const data = [
            { name: "Alice", age: 30 },
        ];

        const output = strip(renderToString(<Table data={data} />));

        expect(output).toContain("name");
        expect(output).toContain("Alice");
    });

    it("should handle boolean values", () => {
        const data = [
            { active: true },
            { active: false },
        ];

        const output = strip(renderToString(<Table data={data} />));

        expect(output).toContain("true");
        expect(output).toContain("false");
    });

    it("should render different border styles with distinct outputs", () => {
        const data = [{ x: 1 }];

        const defaultOutput = strip(renderToString(<Table data={data} borderStyle="default" />));
        const roundedOutput = strip(renderToString(<Table data={data} borderStyle="rounded" />));
        const asciiOutput = strip(renderToString(<Table data={data} borderStyle="ascii" />));
        const noneOutput = strip(renderToString(<Table data={data} borderStyle="none" />));

        // All should be distinct
        const outputs = new Set([defaultOutput, roundedOutput, asciiOutput, noneOutput]);

        expect(outputs.size).toBe(4);
    });

    it("should support ColumnConfig with fixed width", () => {
        const data = [
            { name: "Alice" },
        ];

        const narrowOutput = strip(renderToString(
            <Table data={data} columns={[{ key: "name", width: 10 }]} />,
        ));
        const wideOutput = strip(renderToString(
            <Table data={data} columns={[{ key: "name", width: 20 }]} />,
        ));

        // Wider column should produce longer output lines
        expect(wideOutput.length).toBeGreaterThan(narrowOutput.length);
    });

    it("should render with maxWidth constraint", () => {
        const data = [
            { name: "A very long name value", description: "Another long description value" },
        ];

        const output = strip(renderToString(<Table data={data} maxWidth={40} />));

        // Each line should not exceed maxWidth (check first content line)
        const lines = output.split("\n");

        for (const line of lines) {
            if (line.trim().length > 0) {
                expect(line.length).toBeLessThanOrEqual(40);
            }
        }
    });

    it("should render with markdown border style", () => {
        const data = [{ name: "Alice" }];

        const output = strip(renderToString(<Table data={data} borderStyle="markdown" />));

        // Markdown borders use | for vertical separators
        expect(output).toContain("|");
    });
});
