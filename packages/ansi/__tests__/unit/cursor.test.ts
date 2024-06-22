import { describe, expect, it } from "vitest";

import cursor from "../../src/cursor";
import { isTerminalApp } from "../../src/helpers";

describe(`cursor`, () => {
    it.each([
        ["to", 0, "\u001B[1G"],
        ["to", [2, 2], "\u001B[3;3H"],
        ["move", [1, 4], "\u001B[1C\u001B[4B"],
        ["up", undefined, "\u001B[1A"],
        ["up", 1, "\u001B[1A"],
        ["up", 2, "\u001B[2A"],
        ["up", 0, "\u001B[0A"],
        ["down", undefined, "\u001B[1B"],
        ["down", 1, "\u001B[1B"],
        ["down", 2, "\u001B[2B"],
        ["down", 0, "\u001B[0B"],
        ["forward", undefined, "\u001B[1C"],
        ["forward", 2, "\u001B[2C"],
        ["forward", 0, "\u001B[0C"],
        ["backward", undefined, "\u001B[1D"],
        ["backward", 2, "\u001B[2D"],
        ["backward", 0, "\u001B[0D"],
        ["nextLine", undefined, "\u001B[E"],
        ["nextLine", 2, "\u001B[E\u001B[E"],
        ["prevLine", undefined, "\u001B[F"],
        ["prevLine", 2, "\u001B[F\u001B[F"],
    ])("should return the correct ansi string for %s", (function_, value, expected) => {
        expect.assertions(1);

        const cursorFunction = (cursor[function_ as keyof typeof cursor] as (value: unknown, value2?: unknown) => string);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (Array.isArray(value)) {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(cursorFunction(value[0] as number, value[1] as number)).toBe(expected);
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(cursorFunction(value)).toBe(expected);
        }
    });

    it("should return the correct ansi string for save", () => {
        expect.assertions(1);

        expect(cursor.save).toBe(isTerminalApp ? "\u001B7" : "\u001Bs");
    });

    it("should return the correct ansi string for restore", () => {
        expect.assertions(1);

        expect(cursor.restore).toBe(isTerminalApp ? "\u001B8" : "\u001Bu");
    });
});
