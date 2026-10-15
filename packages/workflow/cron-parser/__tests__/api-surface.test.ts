import { describe, expect, it } from "vitest";

import { CronExpressionParser, CronParseError } from "../src";

const atStart = { currentDate: "2026-01-01T00:00:00Z", tz: "UTC" } as const;

describe("the expression's public surface", () => {
    it("reports a nickname as the expansion it was parsed from", () => {
        expect.hasAssertions();

        expect(CronExpressionParser.parse("@daily").toString()).toBe("0 0 0 * * *");
    });

    it("reports the written expression for a plain one", () => {
        expect.hasAssertions();

        expect(CronExpressionParser.parse("*/15 * * * *").toString()).toBe("*/15 * * * *");
    });

    it("stops a bounded run at the end of its span without failing", () => {
        expect.hasAssertions();

        const runs = CronExpressionParser.parse("0 0 1 1 *", { ...atStart, endDate: "2026-01-02T00:00:00Z" }).take(3);

        expect(runs).toStrictEqual([]);
    });

    it("takes the seconds field as an option, not as a feature", () => {
        expect.hasAssertions();

        expect(() => CronExpressionParser.parse("0 0 * * *", { seconds: "require" })).toThrow(CronParseError);
        expect(() => CronExpressionParser.parse("0 0 0 * * *", { seconds: "require" })).not.toThrow();
    });
});
