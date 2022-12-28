import { describe, expect, it } from "vitest";

import { hash } from "../../src/utils";

describe("utils", () => {
    describe("hash", () => {
        it("should hash", () => {
            expect(hash("test")).toBe("f9e6e6ef197c2b25");
        });
    });
});
