import { describe, expect, it } from "vitest";

import { inspect } from "../../src";

describe("inspect with WeakMaps", () => {
    it("should inspect a WeakMap", () => {
        expect.assertions(1);

        expect(inspect(new WeakMap())).toBe("WeakMap{…}");
    });

    describe("maxStringLength option", () => {
        it("should return the full representation regardless of maxStringLength", () => {
            expect.assertions(3);

            expect(inspect(new WeakMap(), { maxStringLength: 20 })).toBe("WeakMap{…}");
            expect(inspect(new WeakMap(), { maxStringLength: 10 })).toBe("WeakMap{…}");
            expect(inspect(new WeakMap(), { maxStringLength: 1 })).toBe("WeakMap{…}");
        });
    });
});
