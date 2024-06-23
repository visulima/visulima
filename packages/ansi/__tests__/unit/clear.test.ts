import { describe, expect, it } from "vitest";

import { clearTerminal, clearScrollbar, clearScreen, clearLine, fullReset } from "../../src/clear";

describe(`clear`, () => {
    it("should return the correct ansi for clear screen", () => {
        expect.assertions(1);

        expect(clearScreen).toBe("\u001BH\u001B2J");
    });

    it("should return the correct ansi for clear line", () => {
        expect.assertions(1);

        expect(clearLine).toBe("\u001B[2K\u001B0D");
    });

    it("should return the correct ansi for clear terminal", () => {
        expect.assertions(1);

        expect(clearTerminal).toBe("\u001B[2J\u001BH");
    });

    it("should return the correct ansi for clear scrollbar", () => {
        expect.assertions(1);

        expect(clearScrollbar).toBe("\u001B2J");
    });

    it("should return the correct ansi for full reset", () => {
        expect.assertions(1);

        expect(fullReset).toBe("\u001B1;1H\u001BJ");
    });
});
