import { describe, expect, it } from "vitest";

import { isoDateRegex, zodDateIn } from "../../src/zod/date-in-schema";
import { zodDateOut } from "../../src/zod/date-out-schema";

describe("zod/date-in-schema", () => {
    it("should expose a reusable iso date regex", () => {
        expect.assertions(4);

        expect(isoDateRegex.test("2021-01-01")).toBe(true);
        expect(isoDateRegex.test("2021-01-01T00:00:00.000Z")).toBe(true);
        expect(isoDateRegex.test("2021-01-01T00:00:00Z")).toBe(true);
        expect(isoDateRegex.test("not-a-date")).toBe(false);
    });

    it("should parse a valid iso date into a Date", () => {
        expect.assertions(2);

        const result = zodDateIn().parse("2021-01-01T00:00:00.000Z");

        expect(result).toBeInstanceOf(Date);
        expect(result.toISOString()).toBe("2021-01-01T00:00:00.000Z");
    });

    it("should trim whitespace before validating", () => {
        expect.assertions(1);

        const result = zodDateIn().parse("  2021-01-01  ");

        expect(result.toISOString()).toBe("2021-01-01T00:00:00.000Z");
    });

    it("should reject a string that does not match the iso regex", () => {
        expect.assertions(1);

        const result = zodDateIn().safeParse("01/01/2021");

        expect(result.success).toBe(false);
    });

    it("should reject a regex-valid string that is not a real calendar date via refine", () => {
        expect.assertions(2);

        const result = zodDateIn().safeParse("2021-13-45");

        expect(result.success).toBe(false);

        const messages = result.success ? [] : result.error.issues.map((issue) => issue.message);

        expect(messages).toContain("Invalid date");
    });
});

describe("zod/date-out-schema", () => {
    it("should transform a valid Date into an iso string", () => {
        expect.assertions(1);

        const result = zodDateOut().parse(new Date("2021-01-01T00:00:00.000Z"));

        expect(result).toBe("2021-01-01T00:00:00.000Z");
    });

    it("should reject a non-date value", () => {
        expect.assertions(1);

        const result = zodDateOut().safeParse("2021-01-01");

        expect(result.success).toBe(false);
    });

    it("should reject an invalid Date object", () => {
        expect.assertions(1);

        const result = zodDateOut().safeParse(new Date(Number.NaN));

        expect(result.success).toBe(false);
    });
});
