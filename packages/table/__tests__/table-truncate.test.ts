import { describe, expect, it } from "vitest";

import { createTable } from "../src";

describe("table truncation", () => {
    const baseOptions = { style: { paddingLeft: 0, paddingRight: 0 } };
    const testString = "This is a long string";
    const longTestString = "Hello world this is a test";

    describe("basic truncation positions", () => {
        it("should truncate at the end", () => {
            const table = createTable({ ...baseOptions, maxWidth: 5 });
            table.addRow(["", "   ", { content: testString, truncate: { position: "end" } }]);
            expect(table.toString()).toContain("This…");
        });

        it("should truncate at the start", () => {
            const table = createTable({ ...baseOptions, maxWidth: 5 });
            table.addRow(["", "   ", { content: testString, truncate: { position: "start" } }]);
            expect(table.toString()).toContain("…ring");
        });

        it("should truncate in the middle", () => {
            const table = createTable({ ...baseOptions, maxWidth: 5 });
            table.addRow(["", "   ", { content: testString, truncate: { position: "middle" } }]);
            expect(table.toString()).toContain("Th…ng");
        });
    });

    describe("truncation options", () => {
        it("should add space before truncation character", () => {
            const table = createTable({ ...baseOptions, maxWidth: 5 });
            table.addRow(["", "   ", { content: testString, truncate: { position: "end", space: true } }]);
            expect(table.toString()).toContain("Thi …");
        });

        it("should use custom truncation character", () => {
            const table = createTable({ ...baseOptions, maxWidth: 5 });
            table.addRow(["", "   ", { content: testString, truncate: { position: "end", truncationCharacter: "+" } }]);
            expect(table.toString()).toContain("This+");
        });

        it("should combine space and custom truncation character", () => {
            const table = createTable({ ...baseOptions, maxWidth: 5 });
            table.addRow(["", "   ", { content: testString, truncate: { position: "end", space: true, truncationCharacter: ">" } }]);
            expect(table.toString()).toContain("Thi >");
        });
    });

    describe("prefer truncation on space", () => {
        it("should truncate at word boundary when preferTruncationOnSpace is true", () => {
            const table = createTable({ ...baseOptions, maxWidth: 15 });
            table.addRow(["", "   ", { content: longTestString, truncate: { position: "end", preferTruncationOnSpace: true } }]);
            expect(table.toString()).toContain("Hello world…");
        });

        it("should truncate at exact length when preferTruncationOnSpace is false", () => {
            const table = createTable({ ...baseOptions, maxWidth: 15 });
            table.addRow(["", "   ", { content: longTestString, truncate: { position: "end", preferTruncationOnSpace: false } }]);
            expect(table.toString()).toContain("Hello world th…");
        });

        it("should combine all options", () => {
            const table = createTable({ ...baseOptions, maxWidth: 15 });
            table.addRow([
                "",
                "   ",
                {
                    content: longTestString,
                    truncate: {
                        position: "end",
                        preferTruncationOnSpace: true,
                        space: true,
                        truncationCharacter: ">",
                    },
                },
            ]);
            expect(table.toString()).toContain("Hello world>");
        });
    });
});
