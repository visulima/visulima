import { describe, expect, it } from "vitest";

import { isHtml } from "../../src/index";

describe("index re-exports", () => {
    describe(isHtml, () => {
        it("should detect HTML strings", () => {
            expect.assertions(2);

            expect(isHtml("<p>hello</p>")).toBe(true);
            expect(isHtml("<br/>")).toBe(true);
        });

        it("should return false for plain text", () => {
            expect.assertions(2);

            expect(isHtml("just text")).toBe(false);
            expect(isHtml("1 < 2 and 3 > 2")).toBe(false);
        });
    });
});
