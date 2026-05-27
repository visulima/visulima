import { cursorDown, cursorNextLine, cursorTo, cursorUp, eraseLines } from "@visulima/ansi";
import { describe, expect, it } from "vitest";

import logUpdate from "../../src/ink/log-update";
import createStdout from "../helpers/ink-create-stdout";

describe("log-update", () => {
    it("standard rendering - renders and updates output", () => {
        expect.assertions(4);

        const stdout = createStdout();
        const render = logUpdate.create(stdout, { showCursor: true });

        render("Hello\n");

        expect(stdout.write as any).toHaveBeenCalledTimes(1);
        expect((stdout.write as any).mock.calls[0][0]).toBe("Hello\n");

        render("World\n");

        expect(stdout.write as any).toHaveBeenCalledTimes(2);
        expect((stdout.write as any).mock.calls[1][0] as string).toContain("World");
    });

    it("standard rendering - skips identical output", () => {
        expect.assertions(1);

        const stdout = createStdout();
        const render = logUpdate.create(stdout, { showCursor: true });

        render("Hello\n");
        render("Hello\n");

        expect(stdout.write as any).toHaveBeenCalledTimes(1);
    });

    it("incremental rendering - renders and updates output", () => {
        expect.assertions(4);

        const stdout = createStdout();
        const render = logUpdate.create(stdout, {
            incremental: true,
            showCursor: true,
        });

        render("Hello\n");

        expect(stdout.write as any).toHaveBeenCalledTimes(1);
        expect((stdout.write as any).mock.calls[0][0]).toBe("Hello\n");

        render("World\n");

        expect(stdout.write as any).toHaveBeenCalledTimes(2);
        expect((stdout.write as any).mock.calls[1][0] as string).toContain("World");
    });

    it("incremental rendering - skips identical output", () => {
        expect.assertions(1);

        const stdout = createStdout();
        const render = logUpdate.create(stdout, {
            incremental: true,
            showCursor: true,
        });

        render("Hello\n");
        render("Hello\n");

        expect(stdout.write as any).toHaveBeenCalledTimes(1);
    });

    it("incremental rendering - surgical updates", () => {
        expect.assertions(4);

        const stdout = createStdout();
        const render = logUpdate.create(stdout, {
            incremental: true,
            showCursor: true,
        });

        render("Line 1\nLine 2\nLine 3\n");
        render("Line 1\nUpdated\nLine 3\n");

        const secondCall = (stdout.write as any).mock.calls[1][0] as string;

        expect(secondCall).toContain(cursorNextLine());
        expect(secondCall).toContain("Updated");
        expect(secondCall).not.toContain("Line 1");
        expect(secondCall).not.toContain("Line 3");
    });

    it("incremental rendering - clears extra lines when output shrinks", () => {
        expect.assertions(1);

        const stdout = createStdout();
        const render = logUpdate.create(stdout, {
            incremental: true,
            showCursor: true,
        });

        render("Line 1\nLine 2\nLine 3\n");
        render("Line 1\n");

        const secondCall = (stdout.write as any).mock.calls[1][0] as string;

        expect(secondCall).toContain(eraseLines(2));
    });

    it("incremental rendering - when output grows", () => {
        expect.assertions(4);

        const stdout = createStdout();
        const render = logUpdate.create(stdout, {
            incremental: true,
            showCursor: true,
        });

        render("Line 1\n");
        render("Line 1\nLine 2\nLine 3\n");

        const secondCall = (stdout.write as any).mock.calls[1][0] as string;

        expect(secondCall).toContain(cursorNextLine());
        expect(secondCall).toContain("Line 2");
        expect(secondCall).toContain("Line 3");
        expect(secondCall).not.toContain("Line 1");
    });

    it("incremental rendering - single write call with multiple surgical updates", () => {
        expect.assertions(1);

        const stdout = createStdout();
        const render = logUpdate.create(stdout, {
            incremental: true,
            showCursor: true,
        });

        render("Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10\n");
        render("Line 1\nUpdated 2\nLine 3\nUpdated 4\nLine 5\nUpdated 6\nLine 7\nUpdated 8\nLine 9\nUpdated 10\n");

        expect(stdout.write as any).toHaveBeenCalledTimes(2);
    });

    it("incremental rendering - shrinking output keeps screen tight", () => {
        expect.assertions(1);

        const stdout = createStdout();
        const render = logUpdate.create(stdout, {
            incremental: true,
            showCursor: true,
        });

        render("Line 1\nLine 2\nLine 3\n");
        render("Line 1\nLine 2\n");
        render("Line 1\n");

        const thirdCall = stdout.get();

        expect(thirdCall).toBe(eraseLines(2) + cursorUp(1) + cursorNextLine());
    });

    it("incremental rendering - clear() fully resets incremental state", () => {
        expect.assertions(1);

        const stdout = createStdout();
        const render = logUpdate.create(stdout, {
            incremental: true,
            showCursor: true,
        });

        render("Line 1\nLine 2\nLine 3\n");
        render.clear();
        render("Line 1\n");

        const afterClear = stdout.get();

        expect(afterClear).toBe(`${eraseLines(0)}Line 1\n`);
    });

    it("incremental rendering - done() resets before next render", () => {
        expect.assertions(1);

        const stdout = createStdout();
        const render = logUpdate.create(stdout, {
            incremental: true,
            showCursor: true,
        });

        render("Line 1\nLine 2\nLine 3\n");
        render.done();
        render("Line 1\n");

        const afterDone = stdout.get();

        expect(afterDone).toBe(`${eraseLines(0)}Line 1\n`);
    });

    it("incremental rendering - multiple consecutive clear() calls (should be harmless no-ops)", () => {
        expect.assertions(2);

        const stdout = createStdout();
        const render = logUpdate.create(stdout, {
            incremental: true,
            showCursor: true,
        });

        render("Line 1\nLine 2\nLine 3\n");
        render.clear();
        render.clear();
        render.clear();

        expect(stdout.write as any).toHaveBeenCalledTimes(4);

        render("New content\n");
        const afterClears = stdout.get();

        expect(afterClears).toBe(`${eraseLines(0)}New content\n`);
    });

    it("incremental rendering - sync() followed by update (assert incremental path is used)", () => {
        expect.assertions(6);

        const stdout = createStdout();
        const render = logUpdate.create(stdout, {
            incremental: true,
            showCursor: true,
        });

        render.sync("Line 1\nLine 2\nLine 3\n");

        expect(stdout.write as any).toHaveBeenCalledTimes(0);

        render("Line 1\nUpdated\nLine 3\n");

        expect(stdout.write as any).toHaveBeenCalledTimes(1);

        const firstCall = (stdout.write as any).mock.calls[0][0] as string;

        expect(firstCall).toContain(cursorNextLine());
        expect(firstCall).toContain("Updated");
        expect(firstCall).not.toContain("Line 1");
        expect(firstCall).not.toContain("Line 3");
    });

    const showCursorEscape = "\u001B[?25h";
    const hideCursorEscape = "\u001B[?25l";

    const renderingModes = [
        { incremental: false, name: "standard rendering" },
        { incremental: true, name: "incremental rendering" },
    ] as const;

    const createRenderForMode = (incremental: boolean) => {
        const stdout = createStdout();
        const render = incremental ? logUpdate.create(stdout, { incremental: true, showCursor: true }) : logUpdate.create(stdout, { showCursor: true });

        return { render, stdout };
    };

    it("standard rendering - positions cursor after output when cursorPosition is set", () => {
        expect.assertions(2);

        const stdout = createStdout();
        const render = logUpdate.create(stdout, { showCursor: true });

        render.setCursorPosition({ x: 5, y: 1 });
        render("Line 1\nLine 2\nLine 3\n");

        const written = (stdout.write as any).mock.calls[0][0] as string;

        expect(written).toContain("Line 3");
        expect(written.endsWith(cursorUp(2) + cursorTo(5) + showCursorEscape)).toBe(true);
    });

    it("standard rendering - hides cursor before erase when cursor was previously shown", () => {
        expect.assertions(2);

        const stdout = createStdout();
        const render = logUpdate.create(stdout, { showCursor: true });

        render.setCursorPosition({ x: 0, y: 0 });
        render("Hello\n");
        render.setCursorPosition({ x: 0, y: 0 });
        render("World\n");

        const secondCall = (stdout.write as any).mock.calls[1][0] as string;

        expect(secondCall.startsWith(hideCursorEscape)).toBe(true);
        expect(secondCall.endsWith(cursorUp(1) + cursorTo(0) + showCursorEscape)).toBe(true);
    });

    it("standard rendering - no cursor positioning when cursorPosition is undefined", () => {
        expect.assertions(1);

        const stdout = createStdout();
        const render = logUpdate.create(stdout, { showCursor: true });

        render("Hello\n");

        const written = (stdout.write as any).mock.calls[0][0] as string;

        expect(written).not.toContain(showCursorEscape);
    });

    it("standard rendering - cursor position at second-to-last line emits cursorUp(1)", () => {
        expect.assertions(1);

        const stdout = createStdout();
        const render = logUpdate.create(stdout, { showCursor: true });

        render.setCursorPosition({ x: 3, y: 2 });
        render("Line 1\nLine 2\nLine 3\n");

        const written = (stdout.write as any).mock.calls[0][0] as string;

        expect(written.endsWith(cursorUp(1) + cursorTo(3) + showCursorEscape)).toBe(true);
    });

    it.each(renderingModes)("$name - clear() returns cursor to bottom before erasing", ({ incremental }) => {
        expect.assertions(3);

        const { render, stdout } = createRenderForMode(incremental);

        render.setCursorPosition({ x: 5, y: 0 });
        render("Line 1\nLine 2\nLine 3\n");

        render.clear();

        const clearCall = (stdout.write as any).mock.calls[1][0] as string;

        expect(clearCall).toContain(hideCursorEscape);
        expect(clearCall).toContain(cursorDown(3));
        expect(clearCall).toContain(eraseLines(4));
    });

    it("standard rendering - clearing cursor position stops cursor positioning", () => {
        expect.assertions(1);

        const stdout = createStdout();
        const render = logUpdate.create(stdout, { showCursor: true });

        render.setCursorPosition({ x: 0, y: 0 });
        render("Hello\n");

        render.setCursorPosition(undefined);
        render("World\n");

        const secondCall = (stdout.write as any).mock.calls[1][0] as string;

        expect(secondCall).not.toContain(showCursorEscape);
    });

    it("incremental rendering - positions cursor after surgical updates", () => {
        expect.assertions(1);

        const stdout = createStdout();
        const render = logUpdate.create(stdout, {
            incremental: true,
            showCursor: true,
        });

        render.setCursorPosition({ x: 5, y: 1 });
        render("Line 1\nLine 2\nLine 3\n");

        const written = (stdout.write as any).mock.calls[0][0] as string;

        expect(written.endsWith(cursorUp(2) + cursorTo(5) + showCursorEscape)).toBe(true);
    });

    it("incremental rendering - positions cursor after update", () => {
        expect.assertions(1);

        const stdout = createStdout();
        const render = logUpdate.create(stdout, {
            incremental: true,
            showCursor: true,
        });

        render.setCursorPosition({ x: 2, y: 0 });
        render("Line 1\nLine 2\nLine 3\n");
        render.setCursorPosition({ x: 2, y: 0 });
        render("Line 1\nUpdated\nLine 3\n");

        const secondCall = (stdout.write as any).mock.calls[1][0] as string;

        expect(secondCall.endsWith(cursorUp(3) + cursorTo(2) + showCursorEscape)).toBe(true);
    });

    it.each(renderingModes)("$name - repositions cursor when only cursor position changes (same output)", ({ incremental }) => {
        expect.assertions(4);

        const { render, stdout } = createRenderForMode(incremental);

        render.setCursorPosition({ x: 2, y: 0 });
        render("Hello\n");

        expect(stdout.write as any).toHaveBeenCalledTimes(1);

        render.setCursorPosition({ x: 3, y: 0 });
        render("Hello\n");

        expect(stdout.write as any).toHaveBeenCalledTimes(2);

        const secondCall = (stdout.write as any).mock.calls[1][0] as string;

        expect(secondCall).toContain(showCursorEscape);
        expect(secondCall.endsWith(cursorTo(3) + showCursorEscape)).toBe(true);
    });

    it("standard rendering - returns to bottom before erase when cursor was positioned", () => {
        expect.assertions(3);

        const stdout = createStdout();
        const render = logUpdate.create(stdout, { showCursor: true });

        render.setCursorPosition({ x: 0, y: 0 });
        render("Line 1\nLine 2\nLine 3\n");

        render.setCursorPosition({ x: 5, y: 0 });
        render("Line A\nLine B\nLine C\n");

        const secondCall = (stdout.write as any).mock.calls[1][0] as string;

        expect(secondCall.startsWith(hideCursorEscape)).toBe(true);
        expect(secondCall).toContain(cursorDown(3));
        expect(secondCall).toContain("Line A");
    });

    it.each(renderingModes)("$name - sync() resets cursor state", ({ incremental }) => {
        expect.assertions(2);

        const { render, stdout } = createRenderForMode(incremental);

        render.setCursorPosition({ x: 5, y: 0 });
        render("Line 1\nLine 2\nLine 3\n");

        render.sync("Fresh output\n");

        render("Updated output\n");

        const afterSync = stdout.get();

        expect(afterSync).not.toContain(hideCursorEscape);
        expect(afterSync).not.toContain(cursorDown(3));
    });

    it("standard rendering - sync() without cursor does not write to stream", () => {
        expect.assertions(1);

        const stdout = createStdout();
        const render = logUpdate.create(stdout, { showCursor: true });

        render.sync("Line 1\nLine 2\nLine 3\n");

        expect(stdout.write as any).toHaveBeenCalledTimes(0);
    });

    const decscusrSequence = (ps: number): string => `[${ps} q`;

    it.each(renderingModes)("$name - emits DECSCUSR when shape changes", ({ incremental }) => {
        expect.assertions(2);

        const { render, stdout } = createRenderForMode(incremental);

        render.setCursorShape("bar");
        render("Hello\n");

        const written = stdout.getWrites().join("");

        expect(written).toContain(decscusrSequence(6));
        expect(written).toContain("Hello");
    });

    it.each(renderingModes)("$name - re-asserting the same shape does not re-emit DECSCUSR", ({ incremental }) => {
        expect.assertions(2);

        const { render, stdout } = createRenderForMode(incremental);

        render.setCursorShape("blinking-bar");
        render("First\n");

        const firstSeqCount = stdout.getWrites().join("").split(decscusrSequence(5)).length - 1;

        render.setCursorShape("blinking-bar");
        render("Second\n");

        const secondSeqCount = stdout.getWrites().join("").split(decscusrSequence(5)).length - 1;

        expect(firstSeqCount).toBe(1);
        // Output changed but shape didn't — no additional DECSCUSR.
        expect(secondSeqCount).toBe(1);
    });

    it.each(renderingModes)("$name - switching shapes emits each transition", ({ incremental }) => {
        expect.assertions(2);

        const { render, stdout } = createRenderForMode(incremental);

        render.setCursorShape("block");
        render("A\n");
        render.setCursorShape("underline");
        render("B\n");

        const joined = stdout.getWrites().join("");

        expect(joined).toContain(decscusrSequence(2));
        expect(joined).toContain(decscusrSequence(4));
    });

    it.each(renderingModes)("$name - emits shape-only delta when only shape changes", ({ incremental }) => {
        expect.assertions(2);

        const { render, stdout } = createRenderForMode(incremental);

        render.setCursorShape("bar");
        render("Same\n");

        const writesBefore = (stdout.write as any).mock.calls.length;

        render.setCursorShape("block");
        // Same output — should still emit the shape delta on its own.
        render("Same\n");

        const writesAfter = (stdout.write as any).mock.calls.length;
        const lastWrite = stdout.get();

        expect(writesAfter).toBe(writesBefore + 1);
        expect(lastWrite).toBe(decscusrSequence(2));
    });

    it.each(renderingModes)("$name - done() restores default shape when one was emitted", ({ incremental }) => {
        expect.assertions(1);

        const { render, stdout } = createRenderForMode(incremental);

        render.setCursorShape("blinking-block");
        render("Hello\n");
        render.done();

        expect(stdout.getWrites().join("")).toContain(decscusrSequence(0));
    });

    it.each(renderingModes)("$name - done() does not emit DECSCUSR when no shape was ever set", ({ incremental }) => {
        expect.assertions(1);

        const { render, stdout } = createRenderForMode(incremental);

        render("Hello\n");
        render.done();

        expect(stdout.getWrites().join("")).not.toContain(" q");
    });

    it.each(renderingModes)("$name - setCursorShape(undefined) after a shape restores default on next render", ({ incremental }) => {
        expect.assertions(2);

        const { render, stdout } = createRenderForMode(incremental);

        render.setCursorShape("bar");
        render("Hello\n");

        const writesBefore = stdout.getWrites().join("");

        expect(writesBefore).toContain(decscusrSequence(6));

        render.setCursorShape(undefined);
        render("Hello\n");

        const newWrites = stdout.getWrites().slice(-1).join("");

        expect(newWrites).toContain(decscusrSequence(0));
    });

    it.each(renderingModes)("$name - sync() emits DECSCUSR delta when shape pending", ({ incremental }) => {
        expect.assertions(1);

        const { render, stdout } = createRenderForMode(incremental);

        render.setCursorShape("underline");
        render.sync("Fresh\n");

        expect(stdout.getWrites().join("")).toContain(decscusrSequence(4));
    });
});
