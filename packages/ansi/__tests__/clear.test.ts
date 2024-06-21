import { describe, expect, it } from "vitest";

import clear from "../src/clear";

describe(`clear`, () => {
    it("should return the correct ansi for screen", () => {
        expect.assertions(1);

        expect(clear.screen).toBe("\u001BH\u001B2J");
    });
});
