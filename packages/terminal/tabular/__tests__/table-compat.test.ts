import { describe, expect, it } from "vitest";

import { createTable } from "../src";

describe("table CLI Compatibility Tests", () => {
    describe("basic table layouts", () => {
        it("should create complete table with headers and rows", () => {
            expect.assertions(1);

            const table = createTable({
                style: {
                    paddingLeft: 1,
                    paddingRight: 1,
                },
            });

            table.setHeaders([
                { content: "Rel", hAlign: "left" },
                { content: "Change", hAlign: "left" },
                { content: "By", hAlign: "left" },
                { content: "When", hAlign: "left" },
            ]);

            table.addRows(
                ["v0.1", "Testing something cool", "rauchg@gmail.com", "7 minutes ago"],
                ["v0.1", "Testing something cool", "rauchg@gmail.com", "8 minutes ago"],
            );

            expect(table.toString()).toMatchSnapshot();
        });

        it("should create vertical table output", () => {
            expect.assertions(1);

            const table = createTable({
                style: {
                    paddingLeft: 0,
                    paddingRight: 0,
                },
            });

            table.addRows(["v0.1", "Testing something cool"], ["v0.1", "Testing something cool"]);

            const expected = [
                "┌────┬──────────────────────┐",
                "│v0.1│Testing something cool│",
                "├────┼──────────────────────┤",
                "│v0.1│Testing something cool│",
                "└────┴──────────────────────┘",
            ].join("\n");

            expect(table.toString()).toBe(expected);
        });

        it("should create cross table output", () => {
            expect.assertions(1);

            const table = createTable({
                style: {
                    paddingLeft: 0,
                    paddingRight: 0,
                },
            });

            table.setHeaders([
                { content: "", hAlign: "left" },
                { content: "Header 1", hAlign: "left" },
                { content: "Header 2", hAlign: "left" },
            ]);

            table.addRows(["Header 3", "v0.1", "Testing something cool"], ["Header 4", "v0.1", "Testing something cool"]);

            const expected = [
                "┌────────┬────────┬──────────────────────┐",
                "│        │Header 1│Header 2              │",
                "├────────┼────────┼──────────────────────┤",
                "│Header 3│v0.1    │Testing something cool│",
                "├────────┼────────┼──────────────────────┤",
                "│Header 4│v0.1    │Testing something cool│",
                "└────────┴────────┴──────────────────────┘",
            ].join("\n");

            expect(table.toString()).toBe(expected);
        });
    });
});
