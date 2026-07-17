import { strip } from "@visulima/ansi";
import React from "react";
import { describe, expect, it } from "vitest";

import { Table } from "../../src/table";
import { renderToString } from "../helpers/ink-render";

describe(Table, () => {
    it("should render a basic table with headers", () => {
        expect.assertions(6);

        const data = [
            { age: 30, name: "Alice" },
            { age: 25, name: "Bob" },
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
        expect.assertions(1);

        const output = renderToString(<Table data={[]} />);

        expect(output).toBe("");
    });

    it("should render only specified columns in order", () => {
        expect.assertions(3);

        const data = [{ age: 30, city: "NYC", name: "Alice" }];

        const output = strip(renderToString(<Table columns={["city", "name"]} data={data} />));

        expect(output).toContain("city");
        expect(output).toContain("name");
        // "age" column should not appear
        expect(output).not.toContain("age");
    });

    it("should support ColumnConfig objects with custom headers", () => {
        expect.assertions(4);

        const data = [{ age: 30, name: "Alice" }];

        const output = strip(
            renderToString(
                <Table
                    columns={[
                        { header: "Full Name", key: "name" },
                        { header: "Years", key: "age" },
                    ]}
                    data={data}
                />,
            ),
        );

        expect(output).toContain("Full Name");
        expect(output).toContain("Years");
        expect(output).toContain("Alice");
        expect(output).toContain("30");
    });

    it("should support mixed string and ColumnConfig columns", () => {
        expect.assertions(2);

        const data = [{ age: 30, name: "Alice" }];

        const output = strip(renderToString(<Table columns={["name", { header: "Years", key: "age" }]} data={data} />));

        expect(output).toContain("name");
        expect(output).toContain("Years");
    });

    it("should apply custom padding", () => {
        expect.assertions(1);

        const data = [{ a: "x" }];

        const outputPad1 = strip(renderToString(<Table data={data} padding={1} />));
        const outputPad3 = strip(renderToString(<Table data={data} padding={3} />));

        // More padding means wider output
        expect(outputPad3.length).toBeGreaterThan(outputPad1.length);
    });

    it("should render with rounded border style", () => {
        expect.assertions(2);

        const data = [{ name: "Alice" }];

        const output = strip(renderToString(<Table borderStyle="rounded" data={data} />));

        // Rounded borders use ╭ and ╮ corners
        expect(output).toContain("╭");
        expect(output).toContain("╮");
    });

    it("should render with ascii border style", () => {
        expect.assertions(1);

        const data = [{ name: "Alice" }];

        const output = strip(renderToString(<Table borderStyle="ascii" data={data} />));

        // ASCII borders use + for corners
        expect(output).toContain("+");
    });

    it("should render with no border style", () => {
        expect.assertions(3);

        const data = [{ name: "Alice" }];

        const output = strip(renderToString(<Table borderStyle="none" data={data} />));

        // No borders should not contain box-drawing characters
        expect(output).not.toContain("┌");
        expect(output).not.toContain("│");
        expect(output).not.toContain("─");
    });

    it("should render with double border style", () => {
        expect.assertions(2);

        const data = [{ name: "Alice" }];

        const output = strip(renderToString(<Table borderStyle="double" data={data} />));

        // Double borders use ╔ and ║
        expect(output).toContain("╔");
        expect(output).toContain("║");
    });

    it("should render with a custom BorderStyle object", () => {
        expect.assertions(2);

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

        const output = strip(renderToString(<Table borderStyle={customBorder} data={data} />));

        expect(output).toContain("=");
        expect(output).toContain("|");
    });

    it("should hide headers when showHeader is false", () => {
        expect.assertions(2);

        const data = [{ age: 30, name: "Alice" }];

        const withHeader = strip(renderToString(<Table data={data} showHeader />));
        const withoutHeader = strip(renderToString(<Table data={data} showHeader={false} />));

        // Without header should be shorter
        expect(withoutHeader.length).toBeLessThan(withHeader.length);
        // Data should still appear
        expect(withoutHeader).toContain("Alice");
    });

    it("should apply formatCell", () => {
        expect.assertions(1);

        const data = [{ age: 30, name: "alice" }];

        const output = strip(
            renderToString(
                <Table
                    data={data}
                    formatCell={(value, column) => {
                        if (column === "name" && typeof value === "string") {
                            return value.toUpperCase();
                        }

                        return String(value ?? "");
                    }}
                />,
            ),
        );

        expect(output).toContain("ALICE");
    });

    it("should apply formatHeader", () => {
        expect.assertions(1);

        const data = [{ name: "Alice" }];

        const output = strip(renderToString(<Table data={data} formatHeader={(column) => column.toUpperCase()} />));

        expect(output).toContain("NAME");
    });

    it("should replace null and undefined values with skeleton", () => {
        expect.assertions(1);

        const data = [
            { city: null, name: "Alice" },
            { city: undefined, name: "Bob" },
        ];

        const output = strip(renderToString(<Table data={data} skeleton="N/A" />));

        expect(output).toContain("N/A");
    });

    it("should default skeleton to empty string", () => {
        expect.assertions(1);

        const data = [{ name: null }];

        const output = strip(renderToString(<Table data={data} />));

        // Should render without errors; null cell should be empty
        expect(output).toContain("name");
    });

    it("should render a single column table", () => {
        expect.assertions(3);

        const data = [{ id: 1 }, { id: 2 }];

        const output = strip(renderToString(<Table data={data} />));

        expect(output).toContain("id");
        expect(output).toContain("1");
        expect(output).toContain("2");
    });

    it("should render a single row table", () => {
        expect.assertions(2);

        const data = [{ age: 30, name: "Alice" }];

        const output = strip(renderToString(<Table data={data} />));

        expect(output).toContain("name");
        expect(output).toContain("Alice");
    });

    it("should handle boolean values", () => {
        expect.assertions(2);

        const data = [{ active: true }, { active: false }];

        const output = strip(renderToString(<Table data={data} />));

        expect(output).toContain("true");
        expect(output).toContain("false");
    });

    it("should render different border styles with distinct outputs", () => {
        expect.assertions(1);

        const data = [{ x: 1 }];

        const defaultOutput = strip(renderToString(<Table borderStyle="default" data={data} />));
        const roundedOutput = strip(renderToString(<Table borderStyle="rounded" data={data} />));
        const asciiOutput = strip(renderToString(<Table borderStyle="ascii" data={data} />));
        const noneOutput = strip(renderToString(<Table borderStyle="none" data={data} />));

        // All should be distinct
        const outputs = new Set([asciiOutput, defaultOutput, noneOutput, roundedOutput]);

        expect(outputs.size).toBe(4);
    });

    it("should support ColumnConfig with fixed width", () => {
        expect.assertions(1);

        const data = [{ name: "Alice" }];

        const narrowOutput = strip(renderToString(<Table columns={[{ key: "name", width: 10 }]} data={data} />));
        const wideOutput = strip(renderToString(<Table columns={[{ key: "name", width: 20 }]} data={data} />));

        // Wider column should produce longer output lines
        expect(wideOutput.length).toBeGreaterThan(narrowOutput.length);
    });

    it("should render with maxWidth constraint", () => {
        expect.assertions(1);

        const data = [{ description: "Another long description value", name: "A very long name value" }];

        const output = strip(renderToString(<Table data={data} maxWidth={40} />));

        // Each line should not exceed maxWidth (check first content line)
        const lines = output.split("\n");
        const nonEmptyLines = lines.filter((line) => line.trim().length > 0);

        expect.assertions(nonEmptyLines.length);

        for (const line of nonEmptyLines) {
            expect(line.length).toBeLessThanOrEqual(40);
        }
    });

    it("should render with markdown border style", () => {
        expect.assertions(1);

        const data = [{ name: "Alice" }];

        const output = strip(renderToString(<Table borderStyle="markdown" data={data} />));

        // Markdown borders use | for vertical separators
        expect(output).toContain("|");
    });
});
