import { describe, expect, it } from "vitest";

import { CronParseError, parse } from "../src";

const atStart = { currentDate: "2026-01-01T00:00:00Z", tz: "UTC" } as const;

describe("the expression's public surface", () => {
    it("reports a nickname as the expansion it was parsed from", () => {
        expect.hasAssertions();

        expect(parse("@daily").toString()).toBe("0 0 0 * * *");
    });

    it("reports the written expression for a plain one", () => {
        expect.hasAssertions();

        expect(parse("*/15 * * * *").toString()).toBe("*/15 * * * *");
    });

    it("stops a bounded run at the end of its span without failing", () => {
        expect.hasAssertions();

        const runs = parse("0 0 1 1 *", { ...atStart, endDate: "2026-01-02T00:00:00Z" }).take(3);

        expect(runs).toStrictEqual([]);
    });

    it("takes the seconds field as an option, not as a feature", () => {
        expect.hasAssertions();

        expect(() => parse("0 0 * * *", { seconds: "require" })).toThrow(CronParseError);
        expect(() => parse("0 0 0 * * *", { seconds: "require" })).not.toThrow();
    });
});

describe("the function API", () => {
    it("no longer exports the parser class or its default alias", async () => {
        expect.hasAssertions();

        const entry = await import("../src");

        expect(entry).not.toHaveProperty("CronExpressionParser");
        expect(entry).not.toHaveProperty("default");
        expect(entry.parse).toBeTypeOf("function");
    });

    it("exposes the crontab reader as functions", async () => {
        expect.hasAssertions();

        const file = await import("../src/file");

        expect(file).not.toHaveProperty("CronFileParser");
        expect(file.parseFile).toBeTypeOf("function");
        expect(file.parseFileSync).toBeTypeOf("function");
    });
});
