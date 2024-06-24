import { describe, expect, it } from "vitest";

import { alternativeScreenEnter, alternativeScreenExit } from "../../src/alternative-screen";

describe("alternativeScreen", () => {
    it("should return correct escape sequence for entering alternative screen", () => {
        expect.assertions(1);

        expect(alternativeScreenEnter).toBe("\u001B?1049h");
    });

    it("should return correct escape sequence for exiting alternative screen", () => {
        expect.assertions(1);

        expect(alternativeScreenExit).toBe("\u001B?1049l");
    });
});
