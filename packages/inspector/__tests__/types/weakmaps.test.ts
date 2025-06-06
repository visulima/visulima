import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("weakmaps", () => {
    it("returns `WeakMap{…}` for WeakMap", () => {
        expect.assertions(1);

        expect(inspect(new WeakMap())).toBe("WeakMap{…}");
    });

    describe("maxStringLength", () => {
        it("returns the full representation when maxStringLength is over string length", () => {
            expect.assertions(3);

            expect(inspect(new WeakMap(), { maxStringLength: 20 })).toBe("WeakMap{…}");
            expect(inspect(new WeakMap(), { maxStringLength: 10 })).toBe("WeakMap{…}");
            expect(inspect(new WeakMap(), { maxStringLength: 1 })).toBe("WeakMap{…}");
        });
    });
});
