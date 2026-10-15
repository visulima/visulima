/* eslint-disable vitest/prefer-expect-assertions -- ported from the reference implementation's suite; kept close to the original for easy comparison */
import { describe, expect, it } from "vitest";

import { CronExpressionParser } from "../src/cron-expression-parser";

describe(CronExpressionParser, () => {
    describe("test expressions using hashed extension syntax", () => {
        describe("pattern validation", () => {
            // Test invalid step value for H/step pattern
            it("throws error for invalid step in H/step pattern", () => {
                expect(() => CronExpressionParser.parse("H/0 * * * *")).toThrow("Invalid step: 0, must be positive");
            });

            // Test invalid range for H(range) pattern
            it("throws error for invalid range in H(range) pattern", () => {
                expect(() => CronExpressionParser.parse("H(10-5) * * * *")).toThrow("Invalid range: 10-5, min > max");
            });

            // Test invalid range for H(range)/step pattern
            it("throws error for invalid range in H(range)/step pattern", () => {
                expect(() => CronExpressionParser.parse("H(10-5)/2 * * * *")).toThrow("Invalid range: 10-5, min > max");
            });

            // Test invalid step for H(range)/step pattern
            it("throws error for invalid step in H(range)/step pattern", () => {
                expect(() => CronExpressionParser.parse("H(1-10)/0 * * * *")).toThrow("Invalid step: 0, must be positive");
            });
        });

        describe("a hashed range or step the field cannot satisfy", () => {
            it("parses without a seed every time", () => {
                for (let i = 0; i < 20; i += 1) {
                    expect(() => CronExpressionParser.parse("H(1-5)/10 * * * *")).not.toThrow();
                    expect(() => CronExpressionParser.parse("0 0 H(0-5) * *")).not.toThrow();
                }
            });

            it("is rejected without a seed in strict mode", () => {
                expect(() => CronExpressionParser.parse("0 H(1-5)/10 * * * *", { strict: true })).toThrow(
                    "Invalid step: 10, wider than the 1-5 range of the minute field",
                );
            });

            it("h(range) always yields a value inside the field constraints", () => {
                for (let seed = 0; seed < 20; seed += 1) {
                    const options = { hashSeed: `seed-${String(seed)}` };
                    const daysOfMonth = CronExpressionParser.parse("0 0 H(0-5) * *", options).fields.dayOfMonth.values as number[];

                    expect(daysOfMonth).toHaveLength(1);
                    expect(daysOfMonth[0]).toBeGreaterThanOrEqual(1);
                    expect(daysOfMonth[0]).toBeLessThanOrEqual(5);
                }
            });

            it("h(range)/step always yields a value inside the range", () => {
                for (let seed = 0; seed < 20; seed += 1) {
                    const options = { hashSeed: `seed-${String(seed)}` };
                    const minutes = CronExpressionParser.parse("H(1-5)/10 * * * *", options).fields.minute.values as number[];

                    expect(minutes).toHaveLength(1);
                    expect(minutes[0]).toBeGreaterThanOrEqual(1);
                    expect(minutes[0]).toBeLessThanOrEqual(5);
                }
            });

            it("h/step always yields a value inside the field constraints", () => {
                for (let seed = 0; seed < 20; seed += 1) {
                    const options = { hashSeed: `seed-${String(seed)}` };
                    const daysOfMonth = CronExpressionParser.parse("0 0 H/40 * *", options).fields.dayOfMonth.values as number[];
                    const months = CronExpressionParser.parse("0 0 * H/60 *", options).fields.month.values as number[];

                    expect(daysOfMonth).toHaveLength(1);
                    expect(daysOfMonth[0]).toBeGreaterThanOrEqual(1);
                    expect(daysOfMonth[0]).toBeLessThanOrEqual(31);

                    expect(months).toHaveLength(1);
                    expect(months[0]).toBeGreaterThanOrEqual(1);
                    expect(months[0]).toBeLessThanOrEqual(12);
                }
            });

            it("a range wider than the field is narrowed before the step is applied", () => {
                for (let seed = 0; seed < 20; seed += 1) {
                    const options = { hashSeed: `seed-${String(seed)}` };
                    const minutes = CronExpressionParser.parse("H(50-100)/60 * * * *", options).fields.minute.values as number[];

                    expect(minutes).toHaveLength(1);
                    expect(minutes[0]).toBeGreaterThanOrEqual(50);
                    expect(minutes[0]).toBeLessThanOrEqual(59);
                }
            });

            it("a range with no value inside the field is rejected", () => {
                expect(() => CronExpressionParser.parse("0 0 H(0-0)/40 * *")).toThrow("Invalid range: 0-0, no usable value in the dayOfMonth field");
            });

            it("keeps the same seed returning the same value", () => {
                const options = { hashSeed: "F00D" };

                expect(CronExpressionParser.parse("H(1-5)/10 * * * *", options).stringify(true)).toBe(
                    CronExpressionParser.parse("H(1-5)/10 * * * *", options).stringify(true),
                );
            });

            it("leaves a step that fits inside the range untouched", () => {
                const options = { hashSeed: "F00D" };

                expect(CronExpressionParser.parse("H(5-10)/3 * * * * *", options).stringify(true)).toBe("6,9 * * * * *");
            });

            describe("in strict mode", () => {
                it("rejects H(range)/step", () => {
                    const options = { hashSeed: "F00D", strict: true };

                    expect(() => CronExpressionParser.parse("H(1-5)/10 * * * * *", options)).toThrow(
                        "Invalid step: 10, wider than the 1-5 range of the second field",
                    );
                });

                it("rejects H/step", () => {
                    const options = { hashSeed: "F00D", strict: true };

                    expect(() => CronExpressionParser.parse("0 0 0 * H/60 *", options)).toThrow(
                        "Invalid step: 60, wider than the 1-12 range of the month field",
                    );
                });

                it("rejects a range reaching outside the field, quoting the range as written", () => {
                    const options = { hashSeed: "F00D", strict: true };

                    expect(() => CronExpressionParser.parse("0 0 0 H(0-5) * *", options)).toThrow(
                        "Invalid range: 0-5, outside the 1-31 range of the dayOfMonth field",
                    );
                    expect(() => CronExpressionParser.parse("0 0 0 H(0-5)/50 * *", options)).toThrow(
                        "Invalid range: 0-5, outside the 1-31 range of the dayOfMonth field",
                    );
                });

                it("accepts a step that fits inside the range", () => {
                    const options = { hashSeed: "F00D" };

                    expect(CronExpressionParser.parse("0 H(0-29)/10 * * * *", { ...options, strict: true }).stringify(true)).toBe(
                        CronExpressionParser.parse("0 H(0-29)/10 * * * *", options).stringify(true),
                    );
                });
            });
        });

        // Not having a seed is making tests less useful
        describe("without a custom seed", () => {
            it("parses expressions using H on all fields", () => {
                const options = {
                    currentDate: new Date(2025, 0, 1),
                };

                const expressions = [
                    "H * * * * *",
                    "* H * * * *",
                    "* * H * * *",
                    "* * * H * *",
                    "* * * * H *",
                    "* * * * * H",
                    "H H * * * *",
                    "* H H * * *",
                    "* * H H * *",
                    "* * * * H H",
                    "H/5 * * * * *",
                    "* * * * * H#1",
                ];

                for (const expression of expressions) {
                    const interval = CronExpressionParser.parse(expression, options);

                    for (let i = 0; i < 3; i += 1) {
                        const date = interval.next();

                        expect(date.getSeconds()).toBeGreaterThanOrEqual(0);
                        expect(date.getSeconds()).toBeLessThanOrEqual(59);
                        expect(date.getMinutes()).toBeGreaterThanOrEqual(0);
                        expect(date.getMinutes()).toBeLessThanOrEqual(59);
                        expect(date.getHours()).toBeGreaterThanOrEqual(0);
                        expect(date.getHours()).toBeLessThanOrEqual(23);
                        expect(date.getDate()).toBeGreaterThanOrEqual(1);
                        expect(date.getDate()).toBeLessThanOrEqual(31);
                        expect(date.getMonth()).toBeGreaterThanOrEqual(0);
                        expect(date.getMonth()).toBeLessThanOrEqual(11);
                        expect(date.getDay()).toBeGreaterThanOrEqual(0);
                        expect(date.getDay()).toBeLessThanOrEqual(7);
                        expect(date.getFullYear()).toBe(2025);
                    }
                }
            });
        });

        describe("with a custom seed", () => {
            it("parses expressions using H on all fields", () => {
                const options = {
                    currentDate: new Date(2025, 0, 1),
                    hashSeed: "F00D",
                };

                const expressions = [
                    { expected: "5 * * * * *", expression: "H * * * * *" },
                    { expected: "* 34 * * * *", expression: "* H * * * *" },
                    { expected: "* * 15 * * *", expression: "* * H * * *" },
                    { expected: "* * * 12 * *", expression: "* * * H * *" },
                    { expected: "* * * * 8 *", expression: "* * * * H *" },
                    { expected: "* * * * * 0", expression: "* * * * * H" },
                    { expected: "5 34 * * * *", expression: "H H * * * *" },
                    { expected: "* 34 15 * * *", expression: "* H H * * *" },
                    { expected: "* * 15 12 * *", expression: "* * H H * *" },
                    { expected: "* * * 12 8 *", expression: "* * * H H *" },
                    { expected: "* * * * 8 0", expression: "* * * * H H" },
                    { expected: "5 34 15 12 8 0", expression: "H H H H H H" },
                    { expected: "*/5 * * * * *", expression: "H/5 * * * * *" },
                    { expected: "0 16 * * * *", expression: "H(10-20) * * * *" },
                    { expected: "0 5,15,25 * * * *", expression: "H(0-29)/10 * * * *" },
                    { expected: "6,9 * * * * *", expression: "H(5-10)/3 * * * * *" },
                    { expected: "0 0 0 2-30/2 * *", expression: "0 0 0 H/2 * *" },
                    { expected: "* 34 10-19/3 * * 1-5", expression: "* H H(9-20)/3 * * 1-5" },
                    { expected: "* * * * * 0#1", expression: "* * * * * H#1" },
                ];

                for (const { expected, expression } of expressions) {
                    expect(CronExpressionParser.parse(expression, options).stringify(true)).toBe(expected);
                }
            });
        });
    });
});
