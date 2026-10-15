import { describe, expect, it } from "vitest";

import { CronDate, CronExpressionParser, CronParseError } from "../src/cloudflare";

describe("@visulima/cron-parser/cloudflare", () => {
    it("reads the weekdays the Cloudflare way", () => {
        expect.hasAssertions();

        expect(CronExpressionParser.parse("0 0 * * 1").fields.dayOfWeek.values).toStrictEqual([0]);
        expect(CronExpressionParser.parse("0 18 * * 6L").fields.dayOfWeek.values).toStrictEqual(["5L"]);
    });

    it("rejects what the Cloudflare validator rejects", () => {
        expect.hasAssertions();

        expect(() => CronExpressionParser.parse("H * * * *")).toThrow(CronParseError);
        expect(() => CronExpressionParser.parse("0 0 ? * *")).toThrow(CronParseError);
        expect(() => CronExpressionParser.parse("0 0 5L * *")).toThrow(CronParseError);
        expect(() => CronExpressionParser.parse("0 0 0 * * *")).toThrow(CronParseError);
        expect(() => CronExpressionParser.parse("0 0 * * */7")).toThrow(CronParseError);
    });

    it("still lets the caller name another dialect", () => {
        expect.hasAssertions();

        expect(() => CronExpressionParser.parse("H * * * *", { dialect: "extended" })).not.toThrow();
    });

    it("re-exports the rest of the default entry", () => {
        expect.hasAssertions();

        expect(new CronDate("2026-01-01T00:00:00Z", "Europe/Berlin").getUTCOffset()).toBe(60);
    });
});
