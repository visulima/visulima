import { strip as stripAnsi } from "@visulima/ansi";
import { describe, expect, it } from "vitest";

import { BigText } from "../../src/components/big-text";
import { Box } from "../../src/components/index";
import { renderToString } from "../../src/ink/index";

describe("big-text", () => {
    // ── Basic rendering ────────────────────────────────────

    it("renders text with default block font", () => {
        expect.assertions(2);

        const output = renderToString(<BigText text="Hi" />);
        const stripped = stripAnsi(output);

        // Block font renders multi-line ASCII art with box-drawing characters
        expect(stripped).toContain("██");
        expect(stripped.split("\n").length).toBeGreaterThan(1);
    });

    it("renders single character", () => {
        expect.assertions(2);

        const output = renderToString(<BigText text="A" />);
        const stripped = stripAnsi(output);

        expect(stripped).toContain("██");
        expect(stripped.split("\n").length).toBeGreaterThan(1);
    });

    it("renders multiple words", () => {
        expect.assertions(2);

        const output = renderToString(<BigText text="Hi there" />);
        const stripped = stripAnsi(output);

        // "Hi" and "there" should produce wider output than just "Hi"
        const hiOnly = stripAnsi(renderToString(<BigText text="Hi" />));
        const hiMaxWidth = Math.max(...hiOnly.split("\n").map((l) => l.length));
        const fullMaxWidth = Math.max(...stripped.split("\n").map((l) => l.length));

        expect(fullMaxWidth).toBeGreaterThan(hiMaxWidth);
        expect(stripped.split("\n").length).toBeGreaterThan(1);
    });

    // ── Font variants ──────────────────────────────────────

    it("renders with `tiny` font", () => {
        expect.assertions(2);

        const output = renderToString(<BigText font="tiny" text="Hello" />);
        const stripped = stripAnsi(output);

        expect(stripped.length).toBeGreaterThan(0);
        expect(stripped.split("\n").length).toBeGreaterThan(1);
    });

    it("renders with `simple` font", () => {
        expect.assertions(2);

        const output = renderToString(<BigText font="simple" text="Test" />);
        const stripped = stripAnsi(output);

        expect(stripped.length).toBeGreaterThan(0);
        expect(stripped.split("\n").length).toBeGreaterThan(1);
    });

    it("renders with `simpleBlock` font", () => {
        expect.assertions(2);

        const output = renderToString(<BigText font="simpleBlock" text="Hi" />);
        const stripped = stripAnsi(output);

        expect(stripped.length).toBeGreaterThan(0);
        expect(stripped.split("\n").length).toBeGreaterThan(1);
    });

    it("renders with `chrome` font", () => {
        expect.assertions(2);

        const output = renderToString(<BigText font="chrome" text="Hi" />);
        const stripped = stripAnsi(output);

        expect(stripped.length).toBeGreaterThan(0);
        expect(stripped.split("\n").length).toBeGreaterThan(1);
    });

    it("renders with `huge` font", () => {
        expect.assertions(2);

        const output = renderToString(<BigText font="huge" text="Hi" />);
        const stripped = stripAnsi(output);

        expect(stripped.length).toBeGreaterThan(0);
        expect(stripped.split("\n").length).toBeGreaterThan(1);
    });

    it("renders with `grid` font", () => {
        expect.assertions(2);

        const output = renderToString(<BigText font="grid" text="Hi" />);
        const stripped = stripAnsi(output);

        expect(stripped.length).toBeGreaterThan(0);
        expect(stripped.split("\n").length).toBeGreaterThan(1);
    });

    it("renders with `shade` font", () => {
        expect.assertions(2);

        const output = renderToString(<BigText font="shade" text="Hi" />);
        const stripped = stripAnsi(output);

        expect(stripped.length).toBeGreaterThan(0);
        expect(stripped.split("\n").length).toBeGreaterThan(1);
    });

    it("renders with `slick` font", () => {
        expect.assertions(2);

        const output = renderToString(<BigText font="slick" text="Hi" />);
        const stripped = stripAnsi(output);

        expect(stripped.length).toBeGreaterThan(0);
        expect(stripped.split("\n").length).toBeGreaterThan(1);
    });

    it("renders with `3d` font", () => {
        expect.assertions(2);

        const output = renderToString(<BigText font="3d" text="Hi" />);
        const stripped = stripAnsi(output);

        expect(stripped.length).toBeGreaterThan(0);
        expect(stripped.split("\n").length).toBeGreaterThan(1);
    });

    it("renders with `simple3d` font", () => {
        expect.assertions(2);

        const output = renderToString(<BigText font="simple3d" text="Hi" />);
        const stripped = stripAnsi(output);

        expect(stripped.length).toBeGreaterThan(0);
        expect(stripped.split("\n").length).toBeGreaterThan(1);
    });

    it("renders with `pallet` font", () => {
        expect.assertions(2);

        const output = renderToString(<BigText font="pallet" text="Hi" />);
        const stripped = stripAnsi(output);

        expect(stripped.length).toBeGreaterThan(0);
        expect(stripped.split("\n").length).toBeGreaterThan(1);
    });

    // ── Different fonts produce different output ───────────

    it("different fonts produce different output for same text", () => {
        expect.assertions(1);

        const blockOutput = renderToString(<BigText font="block" text="Hi" />);
        const tinyOutput = renderToString(<BigText font="tiny" text="Hi" />);

        expect(stripAnsi(blockOutput)).not.toBe(stripAnsi(tinyOutput));
    });

    // ── Colors ─────────────────────────────────────────────

    it("renders with custom colors", () => {
        expect.assertions(2);

        const output = renderToString(<BigText colors={["red"]} text="Hi" />);
        const stripped = stripAnsi(output);

        // Should contain ANSI color codes
        expect(output).not.toBe(stripped);
        expect(stripped.length).toBeGreaterThan(0);
    });

    it("renders with multiple colors", () => {
        expect.assertions(2);

        const output = renderToString(<BigText colors={["red", "blue"]} text="Hi" />);
        const stripped = stripAnsi(output);

        expect(output).not.toBe(stripped);
        expect(stripped.length).toBeGreaterThan(0);
    });

    it("renders with hex colors", () => {
        expect.assertions(2);

        const output = renderToString(<BigText colors={["#ff0000"]} text="Hi" />);
        const stripped = stripAnsi(output);

        expect(output).not.toBe(stripped);
        expect(stripped.length).toBeGreaterThan(0);
    });

    // ── Background color ───────────────────────────────────

    it("renders with background color", () => {
        expect.assertions(1);

        const output = renderToString(<BigText backgroundColor="blue" text="Hi" />);
        const stripped = stripAnsi(output);

        expect(stripped.length).toBeGreaterThan(0);
    });

    // ── Alignment ──────────────────────────────────────────

    it("renders with center alignment", () => {
        expect.assertions(1);

        const output = renderToString(<BigText align="center" text="Hi" />);
        const stripped = stripAnsi(output);

        expect(stripped.length).toBeGreaterThan(0);
    });

    it("renders with right alignment", () => {
        expect.assertions(1);

        const output = renderToString(<BigText align="right" text="Hi" />);
        const stripped = stripAnsi(output);

        expect(stripped.length).toBeGreaterThan(0);
    });

    // ── Spacing options ────────────────────────────────────

    it("renders with space disabled produces fewer lines", () => {
        expect.assertions(2);

        const withSpace = renderToString(<BigText space text="X" />);
        const withoutSpace = renderToString(<BigText space={false} text="X" />);

        const withSpaceLines = stripAnsi(withSpace).split("\n").length;
        const withoutSpaceLines = stripAnsi(withoutSpace).split("\n").length;

        // space=true adds empty lines on top and bottom
        expect(withoutSpaceLines).toBeLessThanOrEqual(withSpaceLines);
        expect(stripAnsi(withoutSpace).length).toBeGreaterThan(0);
    });

    it("renders with custom letter spacing", () => {
        expect.assertions(1);

        const tight = renderToString(<BigText letterSpacing={0} text="Hi" />);
        const wide = renderToString(<BigText letterSpacing={3} text="Hi" />);

        // Wider letter spacing means more characters per line
        const tightMaxLineLength = Math.max(
            ...stripAnsi(tight)
                .split("\n")
                .map((l) => l.length),
        );
        const wideMaxLineLength = Math.max(
            ...stripAnsi(wide)
                .split("\n")
                .map((l) => l.length),
        );

        expect(wideMaxLineLength).toBeGreaterThan(tightMaxLineLength);
    });

    // ── Max length ─────────────────────────────────────────

    it("renders with maxLength", () => {
        expect.assertions(1);

        const output = renderToString(<BigText maxLength={5} text="Hello World" />);
        const stripped = stripAnsi(output);

        expect(stripped.length).toBeGreaterThan(0);
    });

    // ── Empty and edge cases ───────────────────────────────

    it("renders empty string without throwing", () => {
        expect.assertions(1);

        // cfonts prints a warning for empty text, but should not throw
        const output = renderToString(<BigText text="" />);

        expect(output).toBeDefined();
    });

    // ── Composition ────────────────────────────────────────

    it("can be composed inside a Box", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box>
                <BigText text="Hi" />
            </Box>,
        );

        expect(stripAnsi(output).length).toBeGreaterThan(0);
    });
});
