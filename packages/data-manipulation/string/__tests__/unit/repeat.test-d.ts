/* eslint-disable vitest/prefer-expect-assertions -- `.test-d.ts` files are
   compiled, never executed: `expectTypeOf` is the assertion, and a runtime
   assertion counter here would be dead code. */
import { describe, expectTypeOf, it } from "vitest";

import type { Repeat } from "../../src/types";

describe("repeat", () => {
    it("should repeat literal strings within the safe range", () => {
        expectTypeOf<Repeat<"a", 10>>().toEqualTypeOf<"aaaaaaaaaa">();
        expectTypeOf<Repeat<"a", 45>>().toEqualTypeOf<"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa">();
    });

    it("should fall back to string for counts above 45", () => {
        expectTypeOf<Repeat<"═", 80>>().toEqualTypeOf<string>();
        expectTypeOf<Repeat<"a", 46>>().toEqualTypeOf<string>();
    });

    it("should distribute over union members", () => {
        expectTypeOf<Repeat<"a" | "b", 2>>().toEqualTypeOf<"aa" | "bb">();
    });
});
