import { describe, expect, it } from "vitest";

import { createTable } from "../src";

describe("table truncation", () => {
    const baseOptions = { style: { paddingLeft: 0, paddingRight: 0 } };
    const testString = "This is a long string";
    const longTestString = "Hello world this is a test";

    describe("basic truncation positions", () => {
        it("should truncate at the end", () => {
            expect.assertions(1);

            const table = createTable({ ...baseOptions, maxWidth: 5 });

            table.addRow(["", "   ", { content: testString, truncate: { position: "end" } }]);

            expect(table.toString()).toContain("This…");
        });

        it("should truncate at the start", () => {
            expect.assertions(1);

            const table = createTable({ ...baseOptions, maxWidth: 5 });

            table.addRow(["", "   ", { content: testString, truncate: { position: "start" } }]);

            expect(table.toString()).toContain("…ring");
        });

        it("should truncate in the middle", () => {
            expect.assertions(1);

            const table = createTable({ ...baseOptions, maxWidth: 5 });

            table.addRow(["", "   ", { content: testString, truncate: { position: "middle" } }]);

            expect(table.toString()).toContain("Th…ng");
        });
    });

    describe("truncation options", () => {
        it("should use custom truncation character", () => {
            expect.assertions(1);

            const table = createTable({ ...baseOptions, maxWidth: 5 });

            table.addRow(["", "   ", { content: testString, truncate: { ellipsis: "+", ellipsisWidth: 1, position: "end" } }]);

            expect(table.toString()).toContain("This+");
        });

        it("should combine space and custom truncation character", () => {
            expect.assertions(1);

            const table = createTable({ ...baseOptions, maxWidth: 5 });

            table.addRow(["", "   ", { content: testString, truncate: { position: "end", space: true, truncationCharacter: ">" } }]);

            expect(table.toString()).toContain("Thi >");
        });
    });

    describe("prefer truncation on space", () => {
        it("should truncate at word boundary when preferTruncationOnSpace is true", () => {
            expect.assertions(1);

            const table = createTable({ ...baseOptions, maxWidth: 15 });

            table.addRow(["", "   ", { content: longTestString, truncate: { position: "end", preferTruncationOnSpace: true } }]);

            expect(table.toString()).toContain("Hello world…");
        });

        it("should truncate at exact length when preferTruncationOnSpace is false", () => {
            expect.assertions(1);

            const table = createTable({ ...baseOptions, maxWidth: 15 });

            table.addRow(["", "   ", { content: longTestString, truncate: { position: "end", preferTruncationOnSpace: false } }]);

            expect(table.toString()).toContain("Hello world th…");
        });

        it("should combine all options", () => {
            expect.assertions(1);

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
