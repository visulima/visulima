import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("weaksets", () => {
    it("returns `WeakSet{…}` for WeakSet", () => {
        expect.assertions(1);

        expect(inspect(new WeakSet())).toBe("WeakSet{…}");
    });

    describe("maxStringLength", () => {
        it("returns the full representation when maxStringLength is over string length", () => {
            expect.assertions(3);

            expect(inspect(new WeakSet(), { maxStringLength: 20 })).toBe("WeakSet{…}");
            expect(inspect(new WeakSet(), { maxStringLength: 10 })).toBe("WeakSet{…}");
            expect(inspect(new WeakSet(), { maxStringLength: 1 })).toBe("WeakSet{…}");
        });
    });
});
