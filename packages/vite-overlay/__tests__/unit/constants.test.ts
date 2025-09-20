import { describe, expect, expectTypeOf, it } from "vitest";

import { MESSAGE_TYPE, PLUGIN_NAME, RECENT_ERROR_TTL_MS } from "../../src/constants.js";

describe(RECENT_ERROR_TTL_MS, () => {
    it("should be a positive number", () => {
        expect.assertions(1);

        expectTypeOf(RECENT_ERROR_TTL_MS).toBeNumber();

        expect(RECENT_ERROR_TTL_MS).toBeGreaterThan(0);
    });

    it("should have a reasonable value", () => {
        expect.assertions(1);

        expect(RECENT_ERROR_TTL_MS).toBe(500);
    });
});

describe(MESSAGE_TYPE, () => {
    it("should be a string constant", () => {
        expect.assertions(1);

        expectTypeOf(MESSAGE_TYPE).toBeString();

        expect(MESSAGE_TYPE).toBe("visulima:vite-overlay:error");
    });
});

describe(PLUGIN_NAME, () => {
    it("should be a string constant", () => {
        expect.assertions(1);

        expectTypeOf(PLUGIN_NAME).toBeString();

        expect(PLUGIN_NAME).toBe("visulima-vite-overlay");
    });
});
