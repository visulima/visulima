import EventEmitter from "node:events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MouseEvent } from "../../src/core/input";
import { InputParser } from "../../src/core/input";

/**
 * Minimal stdin stub compatible with what {@link InputParser} touches:
 * `setRawMode`, `resume`, `pause`, `setEncoding`, and the `data` event.
 */
type StdinStub = NodeJS.ReadStream & {
    pause: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
    setEncoding: ReturnType<typeof vi.fn>;
    setRawMode: ReturnType<typeof vi.fn>;
};

const ESC = "\u001B";
const CTRL_C = "\u0003";
const CTRL_A = "\u0001";
const BACKSPACE = "\u007F";

const createStdin = (withRawMode = true): StdinStub => {
    // `vi.spyOn` requires the spied property to already exist, but a bare
    // EventEmitter has none of stdin's stream methods — so seed them as mocks
    // up front. `setRawMode` is omitted when `withRawMode` is false so the
    // parser's `typeof setRawMode === "function"` guard sees a stream without it.
    const stdin = Object.assign(
        new EventEmitter(),
        { pause: vi.fn(), resume: vi.fn(), setEncoding: vi.fn() },
        withRawMode ? { setRawMode: vi.fn() } : {},
    ) as unknown as StdinStub;

    return stdin;
};

describe("core/input InputParser", () => {
    let stdin: StdinStub;
    let parser: InputParser;

    beforeEach(() => {
        stdin = createStdin();
        parser = new InputParser(stdin);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("lifecycle", () => {
        it("enables raw mode, resumes, sets encoding, and listens on start", () => {
            expect.assertions(4);

            parser.start();

            expect(stdin.setRawMode).toHaveBeenCalledWith(true);
            expect(stdin.resume).toHaveBeenCalledTimes(1);
            expect(stdin.setEncoding).toHaveBeenCalledWith("utf8");
            expect(stdin.listenerCount("data")).toBe(1);
        });

        it("disables raw mode, pauses, and removes the listener on stop", () => {
            expect.assertions(3);

            parser.start();
            parser.stop();

            expect(stdin.setRawMode).toHaveBeenLastCalledWith(false);
            expect(stdin.pause).toHaveBeenCalledTimes(1);
            expect(stdin.listenerCount("data")).toBe(0);
        });

        it("is a no-op to stop without a bound listener", () => {
            expect.assertions(1);

            parser.stop();

            expect(stdin.pause).toHaveBeenCalledTimes(1);
        });

        it("does not call setRawMode when the stream lacks it", () => {
            expect.assertions(2);

            const noRawStdin = createStdin(false);
            const noRawParser = new InputParser(noRawStdin);

            noRawParser.start();
            noRawParser.stop();

            expect(noRawStdin.resume).toHaveBeenCalledTimes(1);
            expect(noRawStdin.pause).toHaveBeenCalledTimes(1);
        });
    });

    describe("control and named keys", () => {
        beforeEach(() => {
            parser.start();
        });

        it("emits exit on Ctrl+C", () => {
            expect.assertions(1);

            const onExit = vi.fn();

            parser.on("exit", onExit);
            stdin.emit("data", CTRL_C);

            expect(onExit).toHaveBeenCalledTimes(1);
        });

        it("emits ctrl and data for other control combos", () => {
            expect.assertions(3);

            const onCtrl = vi.fn();
            const onData = vi.fn();

            parser.on("ctrl", onCtrl);
            parser.on("data", onData);
            // Ctrl+A -> char code 1 -> letter 'a'
            stdin.emit("data", CTRL_A);

            // tseep pads listener args with trailing nulls, so assert on the first arg.
            expect(onCtrl.mock.calls[0]?.[0]).toBe("a");
            expect(onData.mock.calls[0]?.[0]).toBe(CTRL_A);
            expect(onData.mock.calls[0]?.[1]).toStrictEqual({ ctrl: true });
        });

        it.each([
            [`${ESC}[A`, "up"],
            [`${ESC}[B`, "down"],
            [`${ESC}[C`, "right"],
            [`${ESC}[D`, "left"],
            ["\t", "tab"],
            [`${ESC}[Z`, "shift-tab"],
            [ESC, "escape"],
            ["\r", "enter"],
            ["\n", "enter"],
            [BACKSPACE, "backspace"],
            [`${ESC}[3~`, "delete"],
            [`${ESC}[5~`, "pageUp"],
            [`${ESC}[6~`, "pageDown"],
            [`${ESC}[H`, "home"],
            [`${ESC}[1~`, "home"],
            [`${ESC}[F`, "end"],
            [`${ESC}[4~`, "end"],
        ])("maps sequence %j to keydown %s", (sequence, key) => {
            expect.assertions(1);

            const onKeydown = vi.fn();

            parser.on("keydown", onKeydown);
            stdin.emit("data", sequence);

            expect(onKeydown.mock.calls[0]?.[0]).toBe(key);
        });

        it("emits meta and data for Alt+key combos", () => {
            expect.assertions(3);

            const onMeta = vi.fn();
            const onData = vi.fn();

            parser.on("meta", onMeta);
            parser.on("data", onData);
            stdin.emit("data", `${ESC}x`);

            expect(onMeta.mock.calls[0]?.[0]).toBe("x");
            expect(onData.mock.calls[0]?.[0]).toBe(`${ESC}x`);
            expect(onData.mock.calls[0]?.[1]).toStrictEqual({ meta: true });
        });

        it("emits printable characters on the data channel", () => {
            expect.assertions(2);

            const onData = vi.fn();

            parser.on("data", onData);
            stdin.emit("data", "h");

            expect(onData.mock.calls[0]?.[0]).toBe("h");
            // No modifier metadata for plain printable input.
            expect(onData.mock.calls[0]?.[1]).toBeUndefined();
        });

        it("treats tab as a named key rather than a ctrl combo", () => {
            expect.assertions(2);

            const onCtrl = vi.fn();
            const onKeydown = vi.fn();

            parser.on("ctrl", onCtrl);
            parser.on("keydown", onKeydown);
            stdin.emit("data", "\t");

            expect(onCtrl).not.toHaveBeenCalled();
            expect(onKeydown.mock.calls[0]?.[0]).toBe("tab");
        });
    });

    describe("bracketed paste", () => {
        beforeEach(() => {
            parser.start();
        });

        it("buffers a single-chunk paste and emits the inner text", () => {
            expect.assertions(2);

            const onPaste = vi.fn();

            parser.on("paste", onPaste);
            stdin.emit("data", `${ESC}[200~hello world${ESC}[201~`);

            expect(onPaste).toHaveBeenCalledTimes(1);
            expect(onPaste.mock.calls[0]?.[0]).toBe("hello world");
        });

        it("reassembles a paste split across multiple chunks", () => {
            expect.assertions(1);

            const onPaste = vi.fn();

            parser.on("paste", onPaste);
            stdin.emit("data", `${ESC}[200~part one `);
            stdin.emit("data", "part two");
            stdin.emit("data", ` end${ESC}[201~`);

            expect(onPaste.mock.calls[0]?.[0]).toBe("part one part two end");
        });

        it("falls back to the data channel when no paste listener is registered", () => {
            expect.assertions(1);

            const onData = vi.fn();

            parser.on("data", onData);
            stdin.emit("data", `${ESC}[200~pasted${ESC}[201~`);

            expect(onData.mock.calls[0]?.[0]).toBe("pasted");
        });

        it("does not fall back to the data channel when a paste listener exists", () => {
            expect.assertions(2);

            const onPaste = vi.fn();
            const onData = vi.fn();

            parser.on("paste", onPaste);
            parser.on("data", onData);
            stdin.emit("data", `${ESC}[200~x${ESC}[201~`);

            expect(onPaste).toHaveBeenCalledTimes(1);
            expect(onData).not.toHaveBeenCalled();
        });

        it("processes a keystroke that precedes the paste-start marker in the same chunk", () => {
            expect.assertions(3);

            const onPaste = vi.fn();
            const onData = vi.fn();

            parser.on("paste", onPaste);
            parser.on("data", onData);
            stdin.emit("data", `x${ESC}[200~hello${ESC}[201~`);

            // The leading keystroke must reach the data channel, not the paste payload.
            expect(onData.mock.calls[0]?.[0]).toBe("x");
            expect(onPaste).toHaveBeenCalledTimes(1);
            expect(onPaste.mock.calls[0]?.[0]).toBe("hello");
        });

        it("processes a keystroke that follows the paste-end marker in the same chunk", () => {
            expect.assertions(3);

            const onPaste = vi.fn();
            const onKeydown = vi.fn();

            parser.on("paste", onPaste);
            parser.on("keydown", onKeydown);
            stdin.emit("data", `${ESC}[200~hello${ESC}[201~\r`);

            expect(onPaste.mock.calls[0]?.[0]).toBe("hello");
            expect(onKeydown).toHaveBeenCalledTimes(1);
            expect(onKeydown.mock.calls[0]?.[0]).toBe("enter");
        });

        it("splits keystrokes surrounding a paste delivered in one chunk", () => {
            expect.assertions(4);

            const onPaste = vi.fn();
            const onData = vi.fn();
            const onKeydown = vi.fn();

            parser.on("paste", onPaste);
            parser.on("data", onData);
            parser.on("keydown", onKeydown);
            stdin.emit("data", `x${ESC}[200~hello${ESC}[201~\r`);

            expect(onData.mock.calls[0]?.[0]).toBe("x");
            expect(onPaste).toHaveBeenCalledTimes(1);
            expect(onPaste.mock.calls[0]?.[0]).toBe("hello");
            expect(onKeydown.mock.calls[0]?.[0]).toBe("enter");
        });

        it("keeps surrounding keystrokes separate from the pasted text on the data channel", () => {
            expect.assertions(3);

            const onData = vi.fn();
            const onKeydown = vi.fn();

            parser.on("data", onData);
            parser.on("keydown", onKeydown);
            stdin.emit("data", `x${ESC}[200~hi${ESC}[201~\r`);

            // No paste listener: "x" is printable input, the paste falls back to
            // the data channel as its own event, and Enter is a named key.
            expect(onData.mock.calls[0]?.[0]).toBe("x");
            expect(onData.mock.calls[1]?.[0]).toBe("hi");
            expect(onKeydown.mock.calls[0]?.[0]).toBe("enter");
        });
    });

    describe("sGR 1006 mouse tracking", () => {
        beforeEach(() => {
            parser.start();
        });

        it("emits a left press with zero-based coordinates and a legacy click", () => {
            expect.assertions(3);

            const onMouse = vi.fn();
            const onClick = vi.fn();

            parser.on("mouse", onMouse);
            parser.on("click", onClick);
            stdin.emit("data", `${ESC}[<0;10;5M`);

            const event = onMouse.mock.calls[0]?.[0] as MouseEvent;

            expect(event).toStrictEqual({ button: "left", ctrl: false, meta: false, shift: false, x: 9, y: 4 });
            expect(onClick).toHaveBeenCalledTimes(1);
            expect(onClick.mock.calls[0]?.[0]).toStrictEqual({ x: 9, y: 4 });
        });

        it("decodes modifier bits for shift, meta, and ctrl", () => {
            expect.assertions(1);

            const onMouse = vi.fn();

            parser.on("mouse", onMouse);
            // base 2 (right) + shift(4) + meta(8) + ctrl(16) = 30
            stdin.emit("data", `${ESC}[<30;3;3M`);

            const event = onMouse.mock.calls[0]?.[0] as MouseEvent;

            expect(event).toStrictEqual({ button: "right", ctrl: true, meta: true, shift: true, x: 2, y: 2 });
        });

        it.each([
            ["1", "middle"],
            ["2", "right"],
            ["64", "scrollUp"],
            ["65", "scrollDown"],
        ])("maps button code %s to button %s", (code, button) => {
            expect.assertions(1);

            const onMouse = vi.fn();

            parser.on("mouse", onMouse);
            stdin.emit("data", `${ESC}[<${code};1;1M`);

            expect((onMouse.mock.calls[0]?.[0] as MouseEvent).button).toBe(button);
        });

        it("does not emit a click for non-left buttons", () => {
            expect.assertions(2);

            const onMouse = vi.fn();
            const onClick = vi.fn();

            parser.on("mouse", onMouse);
            parser.on("click", onClick);
            stdin.emit("data", `${ESC}[<2;1;1M`);

            expect(onMouse).toHaveBeenCalledTimes(1);
            expect(onClick).not.toHaveBeenCalled();
        });

        it("ignores a release event for buttons that only fire on press", () => {
            expect.assertions(1);

            const onMouse = vi.fn();

            parser.on("mouse", onMouse);
            // 'm' final char => release; left press is gated on !isRelease
            stdin.emit("data", `${ESC}[<0;1;1m`);

            expect(onMouse).not.toHaveBeenCalled();
        });

        it("still reports scroll buttons on a release final character", () => {
            expect.assertions(1);

            const onMouse = vi.fn();

            parser.on("mouse", onMouse);
            stdin.emit("data", `${ESC}[<64;1;1m`);

            expect((onMouse.mock.calls[0]?.[0] as MouseEvent).button).toBe("scrollUp");
        });

        it("silently swallows a malformed SGR sequence", () => {
            expect.assertions(2);

            const onMouse = vi.fn();
            const onData = vi.fn();

            parser.on("mouse", onMouse);
            parser.on("data", onData);
            stdin.emit("data", `${ESC}[<not-a-mouse`);

            expect(onMouse).not.toHaveBeenCalled();
            expect(onData).not.toHaveBeenCalled();
        });
    });
});
