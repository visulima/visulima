import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("inspect with WeakSets", () => {
    it("should inspect a WeakSet", () => {
        expect.assertions(1);

        expect(inspect(new WeakSet())).toBe("WeakSet{…}");
    });

    describe("maxStringLength option", () => {
        it("should return the full representation regardless of maxStringLength", () => {
            expect.assertions(3);

            expect(inspect(new WeakSet(), { maxStringLength: 20 })).toBe("WeakSet{…}");
            expect(inspect(new WeakSet(), { maxStringLength: 10 })).toBe("WeakSet{…}");
            expect(inspect(new WeakSet(), { maxStringLength: 1 })).toBe("WeakSet{…}");
        });
    });
});
