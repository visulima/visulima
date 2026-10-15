import { describe, expect, it } from "vitest";

import { CronParseError, parse } from "../src";

const atStart = { currentDate: "2026-01-01T00:00:00Z", tz: "UTC" } as const;

const errorFrom = (expression: string, options?: Parameters<typeof parse>[1]): CronParseError => {
    try {
        parse(expression, options);
    } catch (error) {
        expect(error).toBeInstanceOf(CronParseError);

        return error as CronParseError;
    }

    throw new Error(`Expected ${expression} to throw`);
};

describe("nicknames under a forbidden seconds field", () => {
    it("judges the field count on the written expression, not on the six field expansion", () => {
        expect.hasAssertions();

        expect(() => parse("@daily", { ...atStart, seconds: "forbid" })).not.toThrow();
        expect(() => parse("@daily", { ...atStart, dialect: "cloudflare", features: { nicknames: true } })).not.toThrow();
    });

    it("still rejects a six field expression when seconds are forbidden", () => {
        expect.hasAssertions();

        expect(errorFrom("0 0 0 * * *", { seconds: "forbid" }).code).toBe("FIELD_COUNT");
    });

    it("falls back to every minute for an empty expression under a five field dialect", () => {
        expect.hasAssertions();

        const { fields } = parse("", { ...atStart, dialect: "cloudflare" });

        expect(fields.second.values).toStrictEqual([0]);
        expect(fields.minute.values).toHaveLength(60);
    });
});

describe("resolving a dialect", () => {
    it("keeps the dialect's rules when a caller overrides a feature with the same object", () => {
        expect.hasAssertions();

        // `sundayIsOne` is a rule, not a feature: overriding it must not turn Cloudflare's reading off.
        const options = { ...atStart, dialect: "cloudflare", features: { sundayIsOne: false } } as unknown as Parameters<
            typeof parse
        >[1];

        expect(parse("0 0 * * 1", options).fields.dayOfWeek.values).toStrictEqual([0]);
    });

    it.each(["constructor", "toString", "__proto__"])("rejects %s as an unknown dialect", (dialect) => {
        expect.hasAssertions();

        const error = errorFrom("0 0 * * *", { dialect: dialect as never });

        expect(error.code).toBe("UNKNOWN_DIALECT");
    });
});

describe("repeated day of month text", () => {
    it.each(["0 0 L,L * *", "0 0 LW,LW * *", "0 0 15W,15W * *"])("reports %s as a duplicate, as every other field does", (expression) => {
        expect.hasAssertions();

        const error = errorFrom(expression);

        expect(error.code).toBe("DUPLICATE_VALUE");
        expect(error.field).toBe("dayOfMonth");
    });
});

describe("the field a duplicate error names", () => {
    it("names the field the value sits in, not the name of the class that reported it", () => {
        expect.hasAssertions();

        expect(errorFrom("0,0 * * * *").field).toBe("minute");
        expect(errorFrom("0 0 * * 1,1").field).toBe("dayOfWeek");
    });
});
