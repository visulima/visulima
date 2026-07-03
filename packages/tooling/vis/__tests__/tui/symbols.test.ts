import { describe, expect, expectTypeOf, it } from "vitest";

import { CROSS, DASH, ELLIPSIS, TICK } from "../../src/tui/symbols";

describe("tui/symbols", () => {
    it("should export TICK as a non-empty string", () => {
        expect.assertions(1);

        expectTypeOf(TICK).toBeString();

        expect(TICK.length).toBeGreaterThan(0);
    });

    it("should export CROSS as a non-empty string", () => {
        expect.assertions(1);

        expectTypeOf(CROSS).toBeString();

        expect(CROSS.length).toBeGreaterThan(0);
    });

    it("should export DASH as a non-empty string", () => {
        expect.assertions(1);

        expectTypeOf(DASH).toBeString();

        expect(DASH.length).toBeGreaterThan(0);
    });

    it("should export ELLIPSIS as a non-empty string", () => {
        expect.assertions(1);

        expectTypeOf(ELLIPSIS).toBeString();

        expect(ELLIPSIS.length).toBeGreaterThan(0);
    });
});
