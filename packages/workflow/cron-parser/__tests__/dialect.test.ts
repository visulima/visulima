import { describe, expect, it } from "vitest";

import { CronExpressionParser, CronParseError } from "../src";

const atStart = { currentDate: "2026-01-01T00:00:00Z", tz: "UTC" } as const;

const daysOfWeek = (expression: string, options?: Parameters<typeof CronExpressionParser.parse>[1]): unknown =>
    CronExpressionParser.parse(expression, options).fields.dayOfWeek.values;

const runs = (expression: string, options?: Parameters<typeof CronExpressionParser.parse>[1]): string[] =>
    CronExpressionParser.parse(expression, { ...atStart, ...options })
        .take(3)
        .map((run) => run.toISOString());

describe("the dialect option", () => {
    it("accepts the day of month extensions by default", () => {
        expect.hasAssertions();

        expect(() => CronExpressionParser.parse("0 0 1W * *")).not.toThrow();
        expect(() => CronExpressionParser.parse("0 0 LW * *")).not.toThrow();
        expect(() => CronExpressionParser.parse("0 0 L-3 * *")).not.toThrow();
    });

    it("reads a day of month `5L` as the last day by default, the way cron-parser does", () => {
        expect.hasAssertions();

        expect(runs("0 0 5L * *")).toStrictEqual(runs("0 0 L * *"));
        expect(runs("0 0 5L * *")[0]).toBe("2026-01-31T00:00:00.000Z");
    });

    it("keeps `H`, `#` and a day of month `5L`, but drops `W`, `LW` and `L-n`, under `cron-parser`", () => {
        expect.hasAssertions();

        expect(() => CronExpressionParser.parse("H * * * *", { dialect: "cron-parser" })).not.toThrow();
        expect(() => CronExpressionParser.parse("0 0 * * MON#2", { dialect: "cron-parser" })).not.toThrow();
        expect(() => CronExpressionParser.parse("0 0 5L * *", { dialect: "cron-parser" })).not.toThrow();
        expect(() => CronExpressionParser.parse("0 0 L-3 * *", { dialect: "cron-parser" })).toThrow(CronParseError);
        expect(() => CronExpressionParser.parse("0 0 1W * *", { dialect: "cron-parser" })).toThrow(CronParseError);
        expect(() => CronExpressionParser.parse("0 0 LW * *", { dialect: "cron-parser" })).toThrow(CronParseError);
    });

    it("matches the live Cloudflare validator on the atoms it rejects", () => {
        expect.hasAssertions();

        expect(() => CronExpressionParser.parse("H * * * *", { dialect: "cloudflare" })).toThrow(CronParseError);
        expect(() => CronExpressionParser.parse("0 0 ? * *", { dialect: "cloudflare" })).toThrow(CronParseError);
        expect(() => CronExpressionParser.parse("0 0 0 * * *", { dialect: "cloudflare" })).toThrow(CronParseError);
        expect(() => CronExpressionParser.parse("@daily", { dialect: "cloudflare" })).toThrow(CronParseError);
        expect(() => CronExpressionParser.parse("0 0 5L * *", { dialect: "cloudflare" })).toThrow(CronParseError);
    });

    it("matches the live Cloudflare validator on the atoms it takes", () => {
        expect.hasAssertions();

        expect(() => CronExpressionParser.parse("0 0 L * *", { dialect: "cloudflare" })).not.toThrow();
        expect(() => CronExpressionParser.parse("0 0 1W * *", { dialect: "cloudflare" })).not.toThrow();
        expect(() => CronExpressionParser.parse("59 23 LW * *", { dialect: "cloudflare" })).not.toThrow();
        expect(() => CronExpressionParser.parse("0 0 L-3 * *", { dialect: "cloudflare" })).not.toThrow();
        expect(() => CronExpressionParser.parse("0 0 * * 2#2", { dialect: "cloudflare" })).not.toThrow();
        expect(() => CronExpressionParser.parse("0 0 * * MON#2", { dialect: "cloudflare" })).not.toThrow();
        expect(() => CronExpressionParser.parse("0 18 * * 6L", { dialect: "cloudflare" })).not.toThrow();
    });

    it("rejects a weekday of 0 under `cloudflare`, where 1 is Sunday", () => {
        expect.hasAssertions();

        expect(() => CronExpressionParser.parse("0 0 * * 0", { dialect: "cloudflare" })).toThrow(CronParseError);
        expect(daysOfWeek("0 0 * * 1", { dialect: "cloudflare" })).toStrictEqual([0]);
        expect(daysOfWeek("0 0 * * 2", { dialect: "cloudflare" })).toStrictEqual([1]);
        expect(daysOfWeek("0 0 * * 7", { dialect: "cloudflare" })).toStrictEqual([6]);
    });

    it("keeps the three letter names on the day they mean under `cloudflare`", () => {
        expect.hasAssertions();

        expect(daysOfWeek("0 0 * * MON", { dialect: "cloudflare" })).toStrictEqual(daysOfWeek("0 0 * * MON"));
        expect(daysOfWeek("0 0 * * SUN", { dialect: "cloudflare" })).toStrictEqual([0]);
    });

    it("reads a bare `L` in the weekday field as Saturday under `cloudflare`", () => {
        expect.hasAssertions();

        expect(() => CronExpressionParser.parse("0 0 * * L", { dialect: "cloudflare" })).not.toThrow();
        expect(daysOfWeek("0 0 * * L", { dialect: "cloudflare" })).toStrictEqual([6]);
        expect(runs("0 0 * * L", { dialect: "cloudflare" })).toStrictEqual(runs("0 0 * * 6"));
    });

    it("makes a day of month text stand alone under `cloudflare`", () => {
        expect.hasAssertions();

        expect(() => CronExpressionParser.parse("0 0 1W,LW * *", { dialect: "cloudflare" })).toThrow(CronParseError);
        expect(() => CronExpressionParser.parse("0 0 L-1,L-2 * *", { dialect: "cloudflare" })).toThrow(CronParseError);
        expect(() => CronExpressionParser.parse("0 0 L,15 * *", { dialect: "cloudflare" })).toThrow(CronParseError);
        expect(() => CronExpressionParser.parse("0 0 1,15 * *", { dialect: "cloudflare" })).not.toThrow();
        expect(() => CronExpressionParser.parse("0 0 1W,LW * *")).not.toThrow();
    });

    it("does not rewrite the digits of a step", () => {
        expect.hasAssertions();

        // `10` has to stay a step, not be read as the weekday `0`. `sundayIsOne` on its own, without the
        // `cloudflare` step cap, so the step digits are the only thing under test.
        expect(daysOfWeek("0 0 * * 1-7/10", { features: { sundayIsOne: true } })).toStrictEqual([0]);
        expect(daysOfWeek("0 0 * * */12", { features: { sundayIsOne: true } })).toStrictEqual([0]);
        expect(daysOfWeek("0 0 * * 1-7/2", { dialect: "cloudflare" })).toStrictEqual([0, 2, 4, 6]);
    });

    it("rejects a step as large as the field under `cloudflare`", () => {
        expect.hasAssertions();

        expect(() => CronExpressionParser.parse("0 0 * * */7", { dialect: "cloudflare" })).toThrow(CronParseError);
        expect(() => CronExpressionParser.parse("0 0 * * 1-7/7", { dialect: "cloudflare" })).toThrow(CronParseError);
        expect(() => CronExpressionParser.parse("*/60 * * * *", { dialect: "cloudflare" })).toThrow(CronParseError);
        expect(() => CronExpressionParser.parse("0 0 * * */6", { dialect: "cloudflare" })).not.toThrow();
        expect(() => CronExpressionParser.parse("*/59 * * * *", { dialect: "cloudflare" })).not.toThrow();
    });

    it("computes the same runs as the equivalent numbering outside `cloudflare`", () => {
        expect.hasAssertions();

        expect(runs("0 0 * * 1", { dialect: "cloudflare" })).toStrictEqual(runs("0 0 * * 0"));
        expect(runs("0 18 * * 6L", { dialect: "cloudflare" })).toStrictEqual(runs("0 18 * * 5L"));
        expect(runs("0 0 * * 2#2", { dialect: "cloudflare" })).toStrictEqual(runs("0 0 * * 1#2"));
    });

    it("lets a feature override a single entry of the dialect", () => {
        expect.hasAssertions();

        expect(() => CronExpressionParser.parse("H * * * *", { features: { hashed: false } })).toThrow(CronParseError);
        expect(() => CronExpressionParser.parse("0 0 * * MON#2", { features: { nthDayOfWeek: false } })).toThrow(CronParseError);
        expect(() => CronExpressionParser.parse("0 0 1W * *", { dialect: "cron-parser", features: { nearestWeekday: true } })).not.toThrow();
    });

    it("rejects a dialect it does not know", () => {
        expect.hasAssertions();

        expect(() => CronExpressionParser.parse("* * * * *", { dialect: "vixie" as "extended" })).toThrow(CronParseError);
    });

    it("treats the seconds field as forbidden, optional or required", () => {
        expect.hasAssertions();

        expect(() => CronExpressionParser.parse("0 0 0 * * *", { features: { seconds: "forbid" } })).toThrow(CronParseError);
        expect(() => CronExpressionParser.parse("0 0 0 * * *", { features: { seconds: "require" } })).not.toThrow();
        expect(() => CronExpressionParser.parse("0 0 * * *", { features: { seconds: "require" } })).toThrow(CronParseError);
        expect(() => CronExpressionParser.parse("0 0 * * *", { features: { seconds: "optional" } })).not.toThrow();
    });

    it("reports the extensions an expression is made of", () => {
        expect.hasAssertions();

        expect(CronExpressionParser.parse("* * * * *").usedFeatures).toStrictEqual([]);
        expect(CronExpressionParser.parse("H * * * *").usedFeatures).toStrictEqual(["hashed"]);
        expect(CronExpressionParser.parse("@daily").usedFeatures).toStrictEqual(["nicknames"]);
        expect(CronExpressionParser.parse("0 0 0 * * *").usedFeatures).toStrictEqual(["seconds"]);
        expect(CronExpressionParser.parse("0 0 * * *").usedFeatures).toStrictEqual([]);
        expect(CronExpressionParser.parse("0 0 LW * *").usedFeatures).toStrictEqual(["lastWeekday"]);
        expect(CronExpressionParser.parse("0 0 L-3 * *").usedFeatures).toStrictEqual(["lastOffset"]);
        expect(CronExpressionParser.parse("0 0 15W * *").usedFeatures).toStrictEqual(["nearestWeekday"]);
        expect(CronExpressionParser.parse("0 0 L * *").usedFeatures).toStrictEqual(["lastDayOfMonth"]);
        expect(CronExpressionParser.parse("0 0 5L * *").usedFeatures).toStrictEqual(["numberedLastDayOfMonth"]);
        expect(CronExpressionParser.parse("0 9 * * 5L").usedFeatures).toStrictEqual(["lastDayOfWeek"]);
        expect(CronExpressionParser.parse("0 9 * * 2#2").usedFeatures).toStrictEqual(["nthDayOfWeek"]);
        expect(CronExpressionParser.parse("0 0 ? * *").usedFeatures).toStrictEqual(["noSpecificTime"]);
        expect(CronExpressionParser.parse("H 0 LW * *").usedFeatures).toStrictEqual(["hashed", "lastWeekday"]);
    });
});
