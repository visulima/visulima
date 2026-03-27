import { describe, expect, it } from "vitest";
import ansiEscapes from "ansi-escapes";
import logUpdate from "../../src/ink/log-update.js";
import createStdout from "../helpers/ink-create-stdout.js";

it("standard rendering - renders and updates output", () => {
    const stdout = createStdout();
    const render = logUpdate.create(stdout, { showCursor: true });

    render("Hello\n");
    expect((stdout.write as any).mock.calls.length).toBe(1);
    expect((stdout.write as any).mock.calls[0][0]).toBe("Hello\n");

    render("World\n");
    expect((stdout.write as any).mock.calls.length).toBe(2);
    expect(((stdout.write as any).mock.calls[1][0] as string).includes("World")).toBe(true);
});

it("standard rendering - skips identical output", () => {
    const stdout = createStdout();
    const render = logUpdate.create(stdout, { showCursor: true });

    render("Hello\n");
    render("Hello\n");

    expect((stdout.write as any).mock.calls.length).toBe(1);
});

it("incremental rendering - renders and updates output", () => {
    const stdout = createStdout();
    const render = logUpdate.create(stdout, {
        showCursor: true,
        incremental: true,
    });

    render("Hello\n");
    expect((stdout.write as any).mock.calls.length).toBe(1);
    expect((stdout.write as any).mock.calls[0][0]).toBe("Hello\n");

    render("World\n");
    expect((stdout.write as any).mock.calls.length).toBe(2);
    expect(((stdout.write as any).mock.calls[1][0] as string).includes("World")).toBe(true);
});

it("incremental rendering - skips identical output", () => {
    const stdout = createStdout();
    const render = logUpdate.create(stdout, {
        showCursor: true,
        incremental: true,
    });

    render("Hello\n");
    render("Hello\n");

    expect((stdout.write as any).mock.calls.length).toBe(1);
});

it("incremental rendering - surgical updates", () => {
    const stdout = createStdout();
    const render = logUpdate.create(stdout, {
        showCursor: true,
        incremental: true,
    });

    render("Line 1\nLine 2\nLine 3\n");
    render("Line 1\nUpdated\nLine 3\n");

    const secondCall = (stdout.write as any).mock.calls[1][0] as string;
    expect(secondCall.includes(ansiEscapes.cursorNextLine)).toBe(true);
    expect(secondCall.includes("Updated")).toBe(true);
    expect(secondCall.includes("Line 1")).toBe(false);
    expect(secondCall.includes("Line 3")).toBe(false);
});

it("incremental rendering - clears extra lines when output shrinks", () => {
    const stdout = createStdout();
    const render = logUpdate.create(stdout, {
        showCursor: true,
        incremental: true,
    });

    render("Line 1\nLine 2\nLine 3\n");
    render("Line 1\n");

    const secondCall = (stdout.write as any).mock.calls[1][0] as string;
    expect(secondCall.includes(ansiEscapes.eraseLines(2))).toBe(true);
});

it("incremental rendering - when output grows", () => {
    const stdout = createStdout();
    const render = logUpdate.create(stdout, {
        showCursor: true,
        incremental: true,
    });

    render("Line 1\n");
    render("Line 1\nLine 2\nLine 3\n");

    const secondCall = (stdout.write as any).mock.calls[1][0] as string;
    expect(secondCall.includes(ansiEscapes.cursorNextLine)).toBe(true);
    expect(secondCall.includes("Line 2")).toBe(true);
    expect(secondCall.includes("Line 3")).toBe(true);
    expect(secondCall.includes("Line 1")).toBe(false);
});

it("incremental rendering - single write call with multiple surgical updates", () => {
    const stdout = createStdout();
    const render = logUpdate.create(stdout, {
        showCursor: true,
        incremental: true,
    });

    render("Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10\n");
    render("Line 1\nUpdated 2\nLine 3\nUpdated 4\nLine 5\nUpdated 6\nLine 7\nUpdated 8\nLine 9\nUpdated 10\n");

    expect((stdout.write as any).mock.calls.length).toBe(2);
});

it("incremental rendering - shrinking output keeps screen tight", () => {
    const stdout = createStdout();
    const render = logUpdate.create(stdout, {
        showCursor: true,
        incremental: true,
    });

    render("Line 1\nLine 2\nLine 3\n");
    render("Line 1\nLine 2\n");
    render("Line 1\n");

    const thirdCall = stdout.get();

    expect(thirdCall).toBe(ansiEscapes.eraseLines(2) + ansiEscapes.cursorUp(1) + ansiEscapes.cursorNextLine);
});

it("incremental rendering - clear() fully resets incremental state", () => {
    const stdout = createStdout();
    const render = logUpdate.create(stdout, {
        showCursor: true,
        incremental: true,
    });

    render("Line 1\nLine 2\nLine 3\n");
    render.clear();
    render("Line 1\n");

    const afterClear = stdout.get();

    expect(afterClear).toBe(ansiEscapes.eraseLines(0) + "Line 1\n");
});

it("incremental rendering - done() resets before next render", () => {
    const stdout = createStdout();
    const render = logUpdate.create(stdout, {
        showCursor: true,
        incremental: true,
    });

    render("Line 1\nLine 2\nLine 3\n");
    render.done();
    render("Line 1\n");

    const afterDone = stdout.get();

    expect(afterDone).toBe(ansiEscapes.eraseLines(0) + "Line 1\n");
});

it("incremental rendering - multiple consecutive clear() calls (should be harmless no-ops)", () => {
    const stdout = createStdout();
    const render = logUpdate.create(stdout, {
        showCursor: true,
        incremental: true,
    });

    render("Line 1\nLine 2\nLine 3\n");
    render.clear();
    render.clear();
    render.clear();

    expect((stdout.write as any).mock.calls.length).toBe(4);

    render("New content\n");
    const afterClears = stdout.get();
    expect(afterClears).toBe(ansiEscapes.eraseLines(0) + "New content\n");
});

it("incremental rendering - sync() followed by update (assert incremental path is used)", () => {
    const stdout = createStdout();
    const render = logUpdate.create(stdout, {
        showCursor: true,
        incremental: true,
    });

    render.sync("Line 1\nLine 2\nLine 3\n");
    expect((stdout.write as any).mock.calls.length).toBe(0);

    render("Line 1\nUpdated\nLine 3\n");
    expect((stdout.write as any).mock.calls.length).toBe(1);

    const firstCall = (stdout.write as any).mock.calls[0][0] as string;
    expect(firstCall.includes(ansiEscapes.cursorNextLine)).toBe(true);
    expect(firstCall.includes("Updated")).toBe(true);
    expect(firstCall.includes("Line 1")).toBe(false);
    expect(firstCall.includes("Line 3")).toBe(false);
});

const showCursorEscape = "\u001B[?25h";
const hideCursorEscape = "\u001B[?25l";

const renderingModes = [
    { name: "standard rendering", incremental: false },
    { name: "incremental rendering", incremental: true },
] as const;

const createRenderForMode = (incremental: boolean) => {
    const stdout = createStdout();
    const render = incremental ? logUpdate.create(stdout, { showCursor: true, incremental: true }) : logUpdate.create(stdout, { showCursor: true });
    return { stdout, render };
};

it("standard rendering - positions cursor after output when cursorPosition is set", () => {
    const stdout = createStdout();
    const render = logUpdate.create(stdout, { showCursor: true });

    render.setCursorPosition({ x: 5, y: 1 });
    render("Line 1\nLine 2\nLine 3\n");

    const written = (stdout.write as any).mock.calls[0][0] as string;
    expect(written.includes("Line 3")).toBe(true);
    expect(written.endsWith(ansiEscapes.cursorUp(2) + ansiEscapes.cursorTo(5) + showCursorEscape)).toBe(true);
});

it("standard rendering - hides cursor before erase when cursor was previously shown", () => {
    const stdout = createStdout();
    const render = logUpdate.create(stdout, { showCursor: true });

    render.setCursorPosition({ x: 0, y: 0 });
    render("Hello\n");
    render.setCursorPosition({ x: 0, y: 0 });
    render("World\n");

    const secondCall = (stdout.write as any).mock.calls[1][0] as string;
    expect(secondCall.startsWith(hideCursorEscape)).toBe(true);
    expect(secondCall.endsWith(ansiEscapes.cursorUp(1) + ansiEscapes.cursorTo(0) + showCursorEscape)).toBe(true);
});

it("standard rendering - no cursor positioning when cursorPosition is undefined", () => {
    const stdout = createStdout();
    const render = logUpdate.create(stdout, { showCursor: true });

    render("Hello\n");

    const written = (stdout.write as any).mock.calls[0][0] as string;
    expect(written.includes(showCursorEscape)).toBe(false);
});

it("standard rendering - cursor position at second-to-last line emits cursorUp(1)", () => {
    const stdout = createStdout();
    const render = logUpdate.create(stdout, { showCursor: true });

    render.setCursorPosition({ x: 3, y: 2 });
    render("Line 1\nLine 2\nLine 3\n");

    const written = (stdout.write as any).mock.calls[0][0] as string;
    expect(written.endsWith(ansiEscapes.cursorUp(1) + ansiEscapes.cursorTo(3) + showCursorEscape)).toBe(true);
});

for (const { name, incremental } of renderingModes) {
    it(`${name} - clear() returns cursor to bottom before erasing`, () => {
        const { stdout, render } = createRenderForMode(incremental);

        render.setCursorPosition({ x: 5, y: 0 });
        render("Line 1\nLine 2\nLine 3\n");

        render.clear();

        const clearCall = (stdout.write as any).mock.calls[1][0] as string;
        expect(clearCall.includes(hideCursorEscape)).toBe(true);
        expect(clearCall.includes(ansiEscapes.cursorDown(3))).toBe(true);
        expect(clearCall.includes(ansiEscapes.eraseLines(4))).toBe(true);
    });
}

it("standard rendering - clearing cursor position stops cursor positioning", () => {
    const stdout = createStdout();
    const render = logUpdate.create(stdout, { showCursor: true });

    render.setCursorPosition({ x: 0, y: 0 });
    render("Hello\n");

    render.setCursorPosition(undefined);
    render("World\n");

    const secondCall = (stdout.write as any).mock.calls[1][0] as string;
    expect(secondCall.includes(showCursorEscape)).toBe(false);
});

it("incremental rendering - positions cursor after surgical updates", () => {
    const stdout = createStdout();
    const render = logUpdate.create(stdout, {
        showCursor: true,
        incremental: true,
    });

    render.setCursorPosition({ x: 5, y: 1 });
    render("Line 1\nLine 2\nLine 3\n");

    const written = (stdout.write as any).mock.calls[0][0] as string;
    expect(written.endsWith(ansiEscapes.cursorUp(2) + ansiEscapes.cursorTo(5) + showCursorEscape)).toBe(true);
});

it("incremental rendering - positions cursor after update", () => {
    const stdout = createStdout();
    const render = logUpdate.create(stdout, {
        showCursor: true,
        incremental: true,
    });

    render.setCursorPosition({ x: 2, y: 0 });
    render("Line 1\nLine 2\nLine 3\n");
    render.setCursorPosition({ x: 2, y: 0 });
    render("Line 1\nUpdated\nLine 3\n");

    const secondCall = (stdout.write as any).mock.calls[1][0] as string;
    expect(secondCall.endsWith(ansiEscapes.cursorUp(3) + ansiEscapes.cursorTo(2) + showCursorEscape)).toBe(true);
});

for (const { name, incremental } of renderingModes) {
    it(`${name} - repositions cursor when only cursor position changes (same output)`, () => {
        const { stdout, render } = createRenderForMode(incremental);

        render.setCursorPosition({ x: 2, y: 0 });
        render("Hello\n");
        expect((stdout.write as any).mock.calls.length).toBe(1);

        render.setCursorPosition({ x: 3, y: 0 });
        render("Hello\n");

        expect((stdout.write as any).mock.calls.length).toBe(2);
        const secondCall = (stdout.write as any).mock.calls[1][0] as string;
        expect(secondCall.includes(showCursorEscape)).toBe(true);
        expect(secondCall.endsWith(ansiEscapes.cursorTo(3) + showCursorEscape)).toBe(true);
    });
}

it("standard rendering - returns to bottom before erase when cursor was positioned", () => {
    const stdout = createStdout();
    const render = logUpdate.create(stdout, { showCursor: true });

    render.setCursorPosition({ x: 0, y: 0 });
    render("Line 1\nLine 2\nLine 3\n");

    render.setCursorPosition({ x: 5, y: 0 });
    render("Line A\nLine B\nLine C\n");

    const secondCall = (stdout.write as any).mock.calls[1][0] as string;
    expect(secondCall.startsWith(hideCursorEscape)).toBe(true);
    expect(secondCall.includes(ansiEscapes.cursorDown(3))).toBe(true);
    expect(secondCall.includes("Line A")).toBe(true);
});

for (const { name, incremental } of renderingModes) {
    it(`${name} - sync() resets cursor state`, () => {
        const { stdout, render } = createRenderForMode(incremental);

        render.setCursorPosition({ x: 5, y: 0 });
        render("Line 1\nLine 2\nLine 3\n");

        render.sync("Fresh output\n");

        render("Updated output\n");

        const afterSync = stdout.get();
        expect(afterSync.includes(hideCursorEscape)).toBe(false);
        expect(afterSync.includes(ansiEscapes.cursorDown(3))).toBe(false);
    });
}

it("standard rendering - sync() without cursor does not write to stream", () => {
    const stdout = createStdout();
    const render = logUpdate.create(stdout, { showCursor: true });

    render.sync("Line 1\nLine 2\nLine 3\n");

    expect((stdout.write as any).mock.calls.length).toBe(0);
});
