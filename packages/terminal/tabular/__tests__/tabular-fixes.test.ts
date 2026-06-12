import { describe, expect, it, vi } from "vitest";

import { clearTerminalWidthCache, createGrid, createTable, Grid, Table } from "../src";
import sanitizeHref from "../src/utils/sanitize-href";

// Linear-time ANSI stripping (CSI sequences only) to keep alignment assertions
// readable. Module-scoped to avoid recompilation per call.
// eslint-disable-next-line no-control-regex
const CSI_REGEX = /\[[0-9;]*m/gu;
const stripAnsi = (value: string): string => value.replaceAll(CSI_REGEX, "");

describe("__EMPTY__ sentinel collision", () => {
    it("renders a user cell that literally contains the old sentinel text", () => {
        expect.assertions(1);

        const table = createTable({ style: { paddingLeft: 0, paddingRight: 0 } });

        table.addRow(["__EMPTY__", "b"]);

        const output = table.toString();

        expect(output).toContain("__EMPTY__");
    });

    it("treats null/undefined cells as empty without emitting the sentinel text", () => {
        expect.assertions(1);

        const table = createTable({ style: { paddingLeft: 0, paddingRight: 0 } });

        table.addRow([null, undefined]);

        const output = table.toString();

        expect(output).not.toContain("__EMPTY__");
    });
});

describe("href sanitization (ANSI escape injection)", () => {
    it("strips control characters from href", () => {
        expect.assertions(2);

        const malicious = `https://example.com[2Jinjected`;
        const cleaned = sanitizeHref(malicious);

        expect(cleaned).not.toContain("");
        expect(cleaned).toBe("https://example.com[2Jinjected");
    });

    it("does not let a malicious href inject a clear-screen escape into the output", () => {
        expect.assertions(1);

        const table = createTable({ style: { paddingLeft: 0, paddingRight: 0 } });

        table.addRow([{ content: "link", href: `https://x.com[2J` }]);

        const output = table.toString();

        // The injected bare ESC + CSI clear-screen must not survive.
        expect(output).not.toContain("[2J");
    });
});

describe("onWarn handler", () => {
    it("routes grid placement diagnostics to onWarn instead of console.warn", () => {
        expect.assertions(2);

        const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const onWarn = vi.fn<(message: string) => void>();

        const grid = new Grid({ columns: 1, onWarn });

        // A 3-column-spanning item in a 1-column grid cannot be placed.
        grid.addItem({ colSpan: 3, content: "too wide" });
        grid.toString();

        expect(onWarn).toHaveBeenCalledWith(expect.stringContaining("Could not find position for item"));
        expect(consoleSpy).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
    });

    it("warns when GridItem.width is set on a Grid (ignored by Grid)", () => {
        expect.assertions(1);

        const onWarn = vi.fn<(message: string) => void>();
        const grid = new Grid({ columns: 1, onWarn });

        grid.addItem({ content: "x", width: 10 });

        expect(onWarn).toHaveBeenCalledWith(expect.stringContaining("GridItem.width is ignored by Grid"));
    });
});

describe("table accessors", () => {
    it("getRows returns a copy of the body rows", () => {
        expect.assertions(3);

        const table = createTable();

        table.addRow(["a", "b"]).addRow(["c", "d"]);

        const rows = table.getRows();

        expect(rows).toStrictEqual([
            ["a", "b"],
            ["c", "d"],
        ]);

        // Mutating the returned outer array must not affect the table.
        rows.pop();

        expect(table.rowCount).toBe(2);
        expect(table.getRows()).toHaveLength(2);
    });

    it("removeRow removes a single body row and throws on out-of-bounds", () => {
        expect.assertions(2);

        const table = createTable();

        table.addRow(["a"]).addRow(["b"]).addRow(["c"]);
        table.removeRow(1);

        expect(table.getRows()).toStrictEqual([["a"], ["c"]]);
        expect(() => table.removeRow(5)).toThrow(RangeError);
    });

    it("clear removes all body rows but keeps headers/footers", () => {
        expect.assertions(2);

        const table = createTable();

        table.setHeaders(["H"]).addRow(["a"]).clear();

        expect(table.rowCount).toBe(0);
        expect(table.toString()).toContain("H");
    });
});

describe("per-column defaults", () => {
    it("applies colAligns right-alignment to a column", () => {
        expect.assertions(1);

        const table = createTable({
            colAligns: [undefined, "right"],
            columnWidths: [6, 6],
            style: { paddingLeft: 0, paddingRight: 0 },
        });

        table.addRow(["a", "b"]);

        const lines = table.toString().split("\n");
        const dataLine = lines.find((line) => line.includes("a") && line.includes("b")) ?? "";
        const cleaned = stripAnsi(dataLine).replaceAll(/[│|]/gu, "");

        // "b" should be flushed to the right of its 6-wide cell.
        expect(cleaned.trimEnd().endsWith("b")).toBe(true);
    });

    it("columnDefaults hAlign is overridden by a cell-level hAlign", () => {
        expect.assertions(1);

        const table = createTable({
            columnDefaults: [{ hAlign: "right" }],
            columnWidths: [6],
            style: { paddingLeft: 0, paddingRight: 0 },
        });

        table.addRow([{ content: "a", hAlign: "left" }]);

        const lines = table.toString().split("\n");
        const dataLine = lines.find((line) => line.includes("a")) ?? "";
        const cleaned = stripAnsi(dataLine).replaceAll(/[│|]/gu, "");

        // Cell-level left wins -> "a" sits at the start of the content area.
        expect(cleaned.startsWith("a")).toBe(true);
    });
});

describe(clearTerminalWidthCache, () => {
    it("is exported and callable", () => {
        expect.assertions(1);

        expect(() => {
            clearTerminalWidthCache();
        }).not.toThrow();
    });
});

describe("factory return types", () => {
    it("createTable returns a Table instance", () => {
        expect.assertions(1);

        expect(createTable()).toBeInstanceOf(Table);
    });

    it("createGrid returns a Grid instance", () => {
        expect.assertions(1);

        expect(createGrid({ columns: 1 })).toBeInstanceOf(Grid);
    });
});
