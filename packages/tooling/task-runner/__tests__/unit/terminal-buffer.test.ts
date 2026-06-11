import { describe, expect, it } from "vitest";

import { TerminalBuffer } from "../../src/terminal-buffer";

describe(TerminalBuffer, () => {
    it("should handle plain text", () => {
        expect.assertions(1);

        const buf = new TerminalBuffer();

        buf.write("hello world");

        expect(buf.toString()).toBe("hello world");
    });

    it("should handle newlines", () => {
        expect.assertions(1);

        const buf = new TerminalBuffer();

        buf.write("line1\nline2\nline3");

        expect(buf.toString()).toBe("line1\nline2\nline3");
    });

    it("should handle carriage return (overwrite from start of line)", () => {
        expect.assertions(1);

        const buf = new TerminalBuffer();

        buf.write("old text\rnew");

        expect(buf.toString()).toBe("new text");
    });

    it(String.raw`should handle \r\n as CRLF (newline, not overwrite)`, () => {
        expect.assertions(1);

        const buf = new TerminalBuffer();

        buf.write("line1\r\nline2\r\n");

        expect(buf.toString()).toBe("line1\nline2\n");
    });

    it("should handle cursor up (CSI A)", () => {
        expect.assertions(1);

        const buf = new TerminalBuffer();

        buf.write("line1\nline2\nline3");
        buf.write("\u001B[2A"); // cursor up 2
        buf.write("X");

        // Cursor was at line3 col 5, moved up 2 to line1 col 5, wrote X
        expect(buf.toString()).toBe("line1X\nline2\nline3");
    });

    it("should handle cursor down (CSI B)", () => {
        expect.assertions(1);

        const buf = new TerminalBuffer();

        buf.write("line1\nline2\nline3");
        buf.write("\u001B[3A"); // up to line1
        buf.write("\u001B[1B"); // down to line2
        buf.write("\r"); // col 0
        buf.write("REPLACED");

        expect(buf.toString()).toBe("line1\nREPLACED\nline3");
    });

    it("should handle erase line (CSI 2K)", () => {
        expect.assertions(1);

        const buf = new TerminalBuffer();

        buf.write("hello world");
        buf.write("\u001B[2K"); // erase entire line

        expect(buf.toString()).toBe("");
    });

    it("should handle erase to end of line (CSI 0K)", () => {
        expect.assertions(1);

        const buf = new TerminalBuffer();

        buf.write("hello world");
        buf.write("\r"); // back to col 0
        buf.write("\u001B[5C"); // forward 5
        buf.write("\u001B[0K"); // erase from cursor to end

        expect(buf.toString()).toBe("hello");
    });

    it("should handle erase display (CSI 2J)", () => {
        expect.assertions(1);

        const buf = new TerminalBuffer();

        buf.write("line1\nline2\nline3");
        buf.write("\u001B[2J"); // erase entire screen

        expect(buf.toString()).toBe("");
    });

    it("should handle cursor position (CSI H)", () => {
        expect.assertions(1);

        const buf = new TerminalBuffer();

        buf.write("aaaa\nbbbb\ncccc");
        buf.write("\u001B[2;3H"); // row 2, col 3
        buf.write("X");

        expect(buf.toString()).toBe("aaaa\nbbXb\ncccc");
    });

    it("should handle cursor to column (CSI G)", () => {
        expect.assertions(1);

        const buf = new TerminalBuffer();

        buf.write("hello world");
        buf.write("\u001B[7G"); // column 7 (1-based)
        buf.write("X");

        expect(buf.toString()).toBe("hello Xorld");
    });

    it("should preserve SGR color sequences", () => {
        expect.assertions(3);

        const buf = new TerminalBuffer();

        buf.write("\u001B[31mred text\u001B[0m");

        const result = buf.toString();

        expect(result).toContain("\u001B[31m");
        expect(result).toContain("red text");
        expect(result).toContain("\u001B[0m");
    });

    it("should preserve SGR sequences when overwriting lines", () => {
        expect.assertions(3);

        const buf = new TerminalBuffer();

        buf.write("\u001B[32mgreen\u001B[0m\n");
        buf.write("\u001B[1A"); // cursor up
        buf.write("\r"); // beginning of line
        buf.write("\u001B[2K"); // erase line
        buf.write("\u001B[31mred\u001B[0m");

        const result = buf.toString();

        expect(result).toContain("\u001B[31m");
        expect(result).toContain("red");
        expect(result).not.toContain("green");
    });

    it("should skip non-CSI escape sequences", () => {
        expect.assertions(1);

        const buf = new TerminalBuffer();

        buf.write("\u001B(Bhello"); // ESC(B is "select character set"

        expect(buf.toString()).toBe("hello");
    });

    it("should handle inquirer-like redraw pattern", () => {
        expect.assertions(4);

        const buf = new TerminalBuffer();

        // Simulate inquirer: print prompt, then redraw with selection
        buf.write("? Pick one:\n");
        buf.write("  Option A\n");
        buf.write("> Option B\n");
        buf.write("  Option C");

        // After writing "  Option C", cursor is on row 3 (0-indexed).
        // inquirer redraws: cursor up 2 to row 1 ("  Option A")
        buf.write("\u001B[2A");
        buf.write("\r\u001B[2K"); // erase line
        buf.write("  Option A");
        buf.write("\n\u001B[2K"); // next line, erase
        buf.write("  Option B");
        buf.write("\n\u001B[2K"); // next line, erase
        buf.write("> Option C");

        const result = buf.toString();
        const lines = result.split("\n");

        expect(lines[0]).toContain("? Pick one:");
        expect(lines[1]).toContain("  Option A");
        expect(lines[2]).toContain("  Option B");
        expect(lines[3]).toContain("> Option C");
    });

    it("should respect maxBytes limit", () => {
        expect.assertions(1);

        const buf = new TerminalBuffer(50);

        // Write more than 50 bytes
        buf.write("line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10");

        const result = buf.toString();

        expect(result.length).toBeLessThanOrEqual(60); // some tolerance for trimming
    });

    it("should handle multiple writes incrementally", () => {
        expect.assertions(1);

        const buf = new TerminalBuffer();

        buf.write("hel");
        buf.write("lo ");
        buf.write("wor");
        buf.write("ld");

        expect(buf.toString()).toBe("hello world");
    });

    it("should handle cursor forward (CSI C) and back (CSI D)", () => {
        expect.assertions(1);

        const buf = new TerminalBuffer();

        buf.write("abcdef");
        buf.write("\u001B[3D"); // back 3
        buf.write("XY");

        expect(buf.toString()).toBe("abcXYf");
    });

    it("should overwrite a mid-line run in a single write (batched run)", () => {
        expect.assertions(1);

        const buf = new TerminalBuffer();

        buf.write("abcdefgh");
        buf.write("\r"); // back to col 0
        buf.write("\u001B[2C"); // forward 2
        buf.write("XYZ"); // overwrite cde -> XYZ

        expect(buf.toString()).toBe("abXYZfgh");
    });

    it("should pad with spaces when a run starts past the visible end", () => {
        expect.assertions(1);

        const buf = new TerminalBuffer();

        buf.write("ab");
        buf.write("\u001B[6G"); // jump to column 6 (1-based) -> visual col 5
        buf.write("XY");

        expect(buf.toString()).toBe("ab   XY");
    });

    it("should overwrite glyphs while preserving embedded SGR sequences mid-line", () => {
        expect.assertions(2);

        const buf = new TerminalBuffer();

        // Write colored text, then overwrite the visible glyphs after it.
        buf.write("\u001B[31mabc\u001B[0mdef");
        buf.write("\r");
        buf.write("\u001B[3C"); // move to visual col 3 (just after "abc")
        buf.write("XYZ"); // overwrite "def"

        const result = buf.toString();

        expect(result).toContain("\u001B[31m");
        expect(result).toContain("XYZ");
    });

    it("should produce identical output to per-character writes for a long run", () => {
        expect.assertions(1);

        const batched = new TerminalBuffer();
        const perChar = new TerminalBuffer();
        const run = "x".repeat(5000);

        batched.write(run);

        for (const ch of run) {
            perChar.write(ch);
        }

        expect(batched.toString()).toBe(perChar.toString());
    });

    it("should handle a long printable line without quadratic blowup", () => {
        expect.assertions(2);

        const buf = new TerminalBuffer(1024 * 1024);
        const line = "y".repeat(100_000);

        const start = Date.now();

        buf.write(line);

        const elapsed = Date.now() - start;

        expect(buf.toString()).toBe(line);
        // A quadratic implementation re-walks 100k chars 100k times and would
        // take many seconds; the linear path finishes well under a second.
        expect(elapsed).toBeLessThan(2000);
    });

    it("should handle erase from cursor to end of display (CSI 0J)", () => {
        expect.assertions(1);

        const buf = new TerminalBuffer();

        buf.write("line1\nline2\nline3");
        // After writing, cursor is at row 2, col 5.
        // Move up 2 → row 0, col stays 5 (but \n resets col, so cursor is at row 2 col 5)
        buf.write("\u001B[2A"); // up to row 0
        buf.write("\u001B[0J"); // erase from cursor to end

        // line1 truncated at col 5, line2 and line3 removed
        expect(buf.toString()).toBe("line1");
    });
});
