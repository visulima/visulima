import { describe, expect, it } from "vitest";

import { hash } from "../../src/utils";

describe("utils", () => {
    describe(hash, () => {
        it("should generate correct hash for input string", () => {
            expect.assertions(1);

            expect(hash("test")).toBe("f9e6e6ef197c2b25");
        });
    });
});
