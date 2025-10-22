import type { WriteStream as TtyWriteStream } from "node:tty";

import terminalSize from "terminal-size";
import { beforeEach, describe, expect, it } from "vitest";

import InteractiveManager from "../../../src/interactive/interactive-manager";
import InteractiveStreamHook from "../../../src/interactive/interactive-stream-hook";
import { cursorHide, cursorShow, eraseLines } from "../../../src/utils/ansi-escapes";
import WriteStream from "./__mocks__/write-stream.mock.js";

const stdout = new WriteStream() as unknown as TtyWriteStream & WriteStream;
const stderr = new WriteStream() as unknown as TtyWriteStream & WriteStream;

const manager = new InteractiveManager(new InteractiveStreamHook(stdout), new InteractiveStreamHook(stderr));

describe("updateManager", (): void => {
    beforeEach((): void => {
        stdout._stack = [];
        stderr._stack = [];
    });

    it("hook stream", (): void => {
        expect.assertions(4);

        expect(manager.isHooked).toBe(false);
        expect(manager.hook()).toBe(true);
        expect(manager.isHooked).toBe(true);
        expect(stdout._stack).toStrictEqual([cursorHide]);
    });

    it("should update lines", (): void => {
        expect.assertions(1);

        manager.update("stdout", ["line 1"]);
        manager.update("stdout", ["line 2"], 1);

        expect(stdout._stack).toStrictEqual(["line 1", "", "line 2", ""]);
    });

    it("should update lines with empty array", (): void => {
        expect.assertions(1);

        manager.update("stdout", []);
        manager.update("stdout", [], 1);

        expect(stdout._stack).toStrictEqual([]);
    });

    it("should update terminal active area", (): void => {
        expect.assertions(6);

        const { rows } = terminalSize();

        const list: string[] = [];
        const position = 10;
        let index = 0;

        while (index <= rows) {
            // eslint-disable-next-line no-plusplus
            list.push(`line ${index++}`);
        }

        manager.update("stdout", [...list, ...list]);
        stdout.clear();

        expect(manager.lastLength).toBe(list.length * 2);
        expect(manager.outside).toBe(list.length + 1);
        expect(stdout._stack).toStrictEqual([]);

        manager.update("stdout", list, position);

        expect(stdout._stack).toHaveLength(list.length - (manager.outside - position) + 1);

        const code = eraseLines(rows + 1);

        expect(stdout._stack).contain(code);
        expect(stdout._stack).contain("");
    });

    it("unhook stream", (): void => {
        expect.assertions(3);

        expect(manager.isHooked).toBe(true);
        expect(manager.unhook()).toBe(true);
        expect(stdout._stack).toStrictEqual([cursorShow]);
    });
});
