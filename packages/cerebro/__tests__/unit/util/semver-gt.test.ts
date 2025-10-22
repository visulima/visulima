import { describe, expect, it } from "vitest";

import semverGt from "../../../src/util/semver-gt";

describe("util/semver-gt", () => {
    it("should return true if the first version is greater than the second", () => {
        expect.assertions(1);

        expect(semverGt("1.2.3", "1.2.2")).toBe(true);
    });

    it("should return false if the first version is less than the second", () => {
        expect.assertions(1);

        expect(semverGt("1.2.2", "1.2.3")).toBe(false);
    });
});
