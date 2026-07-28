import { describe, expect, it } from "vitest";

import { DEFAULT_EXCLUDE } from "../src/constants";
import DEFAULT_OPTIONS from "../src/options";

describe("DEFAULT_OPTIONS", () => {
    it("derives its exclude list from DEFAULT_EXCLUDE so the two cannot drift", () => {
        expect.assertions(1);

        expect(DEFAULT_OPTIONS.exclude).toStrictEqual([...DEFAULT_EXCLUDE]);
    });
});
