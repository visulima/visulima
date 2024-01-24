import type { WriteStream as TtyWriteStream } from "node:tty";

import ansiEscapes from "ansi-escapes";
import terminalSize from "terminal-size";
import { beforeEach, describe, expect, it } from "vitest";

import { InteractiveManager } from "../../src/interactive/interactive-manager";
import { InteractiveStreamHook } from "../../src/interactive/interactive-stream-hook";
import { WriteStream } from "./__mocks__/write-stream.mock.js";

const stdout = new WriteStream() as unknown as TtyWriteStream & WriteStream;
const stderr = new WriteStream() as unknown as TtyWriteStream & WriteStream;

const manager = new InteractiveManager(new InteractiveStreamHook(stdout), new InteractiveStreamHook(stderr));

describe("updateManager", (): void => {
    beforeEach((): void => {
        stdout._stack = [];
        stderr._stack = [];
    });

    it("hook stream", (): void => {
        expect(manager.isHooked).toBeFalsy();
        expect(manager.hook()).toBeTruthy();
        expect(manager.isHooked).toBeTruthy();
        expect(stdout._stack).toStrictEqual([ansiEscapes.cursorHide]);
    });

    it("update lines", (): void => {
        manager.update(["line 1"]);
        manager.update(["line 2"], 1);

        expect(stdout._stack).toStrictEqual(["line 1", "", "line 2", ""]);
    });

    it("update lines with empty array", (): void => {
        manager.update([]);
        manager.update([], 1);

        expect(stdout._stack).toStrictEqual([]);
    });

    it("update terminal active area", (): void => {
        const { rows } = terminalSize();

        const list: string[] = [];
        const position = 10;
        let index = 0;

        // eslint-disable-next-line no-loops/no-loops,no-plusplus
        while (index <= rows) list.push(`line ${index++}`);

        manager.update([...list, ...list]);
        stdout.clear();

        expect(manager.lastLength).toBe(list.length * 2);
        expect(manager.outside).toBe(list.length + 1);
        expect(stdout._stack).toStrictEqual([]);

        manager.update(list, position);

        expect(stdout._stack).toHaveLength(list.length - (manager.outside - position) + 1);

        const code = ansiEscapes.eraseLines(rows + 1);

        expect(stdout._stack).toStrictEqual(
            // eslint-disable-next-line vitest/no-conditional-in-test,vitest/no-conditional-tests
            process.platform === "win32"
                ? [code, "line 4", "line 5", "line 6", "line 7", "line 8", "line 9", "line 10", "line 11", ""]
                : [code, "line 9", "line 10", "line 11", "line 12", "line 13", "line 14", "line 15", "line 16", ""],
        );
    });

    it("unhook stream", (): void => {
        expect(manager.isHooked).toBeTruthy();
        expect(manager.unhook()).toBeTruthy();
        expect(stdout._stack).toStrictEqual([ansiEscapes.cursorShow]);
    });
});
