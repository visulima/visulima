import type { WriteStream as TtyWriteStream } from "node:tty";

import ansiEscapes from "ansi-escapes";
import { describe, expect, it, vi } from "vitest";

import { InteractiveStreamHook } from "../../src/interactive/interactive-stream-hook";
import { WriteStream } from "./__mocks__/write-stream.mock.js";

const stream = new WriteStream() as unknown as TtyWriteStream & WriteStream;
const hook = new InteractiveStreamHook(stream);
const callback = vi.fn();

describe("hook", (): void => {
    it("activate", (): void => {
        hook.active();

        expect(stream._stack.pop()).toBe(ansiEscapes.cursorHide);
    });

    it("write (String)", (): void => {
        hook.write("line 1");
        hook.erase(1);
        stream.write("line 2", callback);
        hook.write("line 3");

        expect(stream._stack).toStrictEqual(["line 1", ansiEscapes.eraseLines(2), "line 3"]);
        expect(callback.mock.calls).toHaveLength(1);
    });

    it("write (Buffers)", (): void => {
        stream.write("line 4", "utf8", callback);
        stream.write(Buffer.from("line 5", "utf8"), callback);
        stream.write(new Uint8Array(Buffer.from("line 6", "utf8")), callback);

        expect(callback.mock.calls).toHaveLength(4);
    });

    it("deactivate", (): void => {
        hook.inactive(true);

        expect(stream._stack).toStrictEqual([
            "line 1",
            ansiEscapes.eraseLines(2),
            "line 3",
            "",
            "",
            "line 2",
            "line 4",
            "line 5",
            "line 6",
            ansiEscapes.cursorShow,
        ]);
    });
});
