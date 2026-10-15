/* eslint-disable vitest/prefer-expect-assertions, vitest/prefer-strict-equal, vitest/require-hook, vitest/require-to-throw-message -- ported from the reference implementation's suite; kept close to the original for easy comparison */
import { describe, expect, it } from "vitest";

import { parse } from "../src/cron-expression-parser";

describe(parse, () => {
    describe("invalid expression", () => {
        it("value out of the range", () => {
            expect(() => parse("61 * * * * *")).toThrow("Constraint error, got value 61 expected range 0-59");
        });

        it("second value out of the range", () => {
            expect(() => parse("-1 * * * * *")).toThrow("Constraint error, got range NaN-1 expected range 0-59");
        });

        it("range order is invalid", () => {
            expect(() => parse("30-20 * * * * *")).toThrow("Invalid range: 30-20, min(30) > max(20)");
        });

        it("invalid range", () => {
            expect(() => parse("- * * * * *")).toThrow("Constraint error, got range NaN-NaN expected range 0-59");
        });

        it("minute value out of the range", () => {
            expect(() => parse("* 32,72 * * * *")).toThrow("Constraint error, got value 72 expected range 0-59");
        });

        it("hour value out of the range", () => {
            expect(() => parse("* * 12-36 * * *")).toThrow("Constraint error, got range 12-36 expected range 0-23");
        });

        it("day of the month value out of the range", () => {
            expect(() => parse("* * * 10-15,40 * *")).toThrow("Constraint error, got value 40 expected range 1-31");
        });

        it("month value out of the range", () => {
            expect(() => parse("* * * * */10,12-13 *")).toThrow("Constraint error, got range 12-13 expected range 1-12");
        });

        it("day of the week value out of the range", () => {
            expect(() => parse("* * * * * 9")).toThrow("Constraint error, got value 9 expected range 0-7");
        });

        it("invalid expression that contains too many fields", () => {
            expect(() => parse("* * * * * * * *ASD")).toThrow("Invalid cron expression");
        });

        it("invalid expression that is too long", () => {
            const field = "H".repeat(1024);

            expect(() => parse(`${field} * * * * *`)).toThrow("Invalid cron expression, too long");
        });

        it("invalid explicit day of month definition", () => {
            expect(() => {
                const iter = parse("0 0 31 4 *");

                iter.next();
            }).toThrow("Invalid explicit day of month definition");
        });

        it("explicit day of month rescued by a restricted day of week", () => {
            // Day of month and day of week combine with OR, so an out-of-range day of
            // month is valid when the day of week is restricted: it fires on the
            // matching weekdays.
            const iter = parse("0 0 31 2 1-5");
            const next = iter.next();

            expect(next.getMonth()).toBe(1); // February
            expect(next.getDay()).toBeGreaterThanOrEqual(1);
            expect(next.getDay()).toBeLessThanOrEqual(5);
        });

        it("invalid characters test - symbol", () => {
            expect(() => parse("10 ! 12 8 0")).toThrow("Invalid characters, got value: !");
        });

        it("invalid characters test - letter", () => {
            expect(() => parse("10 x 12 8 0")).toThrow("Invalid characters, got value: x");
        });

        it("invalid characters test - parentheses", () => {
            expect(() => parse("10 ) 12 8 0")).toThrow("Invalid characters, got value: )");
        });

        it("interval with invalid characters test", () => {
            expect(() => parse("10 */A 12 8 0")).toThrow("Invalid characters, got value: */A");
        });

        it("range with invalid characters test", () => {
            expect(() => parse("10 0-z 12 8 0")).toThrow("Invalid characters, got value: 0-z");
        });

        it("group with invalid characters test", () => {
            expect(() => parse("10 0,1,z 12 8 0")).toThrow("Invalid characters, got value: 0,1,z");
        });

        it("invalid expression which has repeat 0 times", () => {
            expect(() => parse("0 */0 * * *")).toThrow("Constraint error, cannot repeat at every 0 time.");
        });

        it("invalid expression which has repeat negative number times", () => {
            expect(() => parse("0 */-5 * * *")).toThrow("Constraint error, cannot repeat at every -5 time.");
        });

        it("invalid expression which has multiple combined repeat cycles", () => {
            expect(() => parse("0 5/5/5 * * *")).toThrow("Invalid repeat: 5/5/5");
        });

        it("invalid days of week strings - wrong alias", () => {
            expect(() => parse("15 10 * * MON-TUR")).toThrow(`Validation error, cannot resolve alias "tur"`);
        });

        it("invalid list value without value", () => {
            expect(() => {
                parse("*/10 * * * * ,");
            }).toThrow("Invalid list value format");
        });

        it("invalid list value with right-side value", () => {
            expect(() => {
                parse("*/10 * * * * ,2");
            }).toThrow("Invalid list value format");
        });
        // The Quartz documentation says that if the # character is used then no other expression can be used in the dayOfWeek term:
        // http://www.quartz-scheduler.org/api/2.3.0/index.html
        it("cannot combine `-` range and # occurrence special characters", () => {
            const expression = "0 0 0 ? * 2-4#2";

            expect(() => parse(expression)).toThrow("Constraint error, invalid dayOfWeek `#` and `-` special characters are incompatible");
        });

        it("cannot combine `/` repeat interval and # occurrence special characters", () => {
            const expression = "0 0 0 ? * 1/2#3";

            expect(() => parse(expression)).toThrow("Constraint error, invalid dayOfWeek `#` and `/` special characters are incompatible");
        });

        it("cannot combine `,` list and # occurrence special characters", () => {
            const expression = "0 0 0 ? * 0,6#4";

            expect(() => parse(expression)).toThrow("Constraint error, invalid dayOfWeek `#` and `,` special characters are incompatible");
        });

        it("invalid characters test - dot", () => {
            const expression = "0 0 0 ? * 1.2#2";

            expect(() => parse(expression)).toThrow("Invalid characters, got value: 1.2");
        });

        it("invalid occurrence value", () => {
            const expressions = ["0 0 0 ? * 1#", "0 0 0 ? * 1#0", "0 0 0 ? * 4#6", "0 0 0 ? * 0##4"];

            for (const expression of expressions) {
                expect(() => parse(expression)).toThrow("Constraint error, invalid dayOfWeek occurrence number (#)");
            }
        });

        it("both dayOfMonth and dayOfWeek used together in strict mode", () => {
            const expression = "0 0 12 1-31 * 1";

            expect(() => parse(expression, { strict: true })).toThrow();
        });

        it("missing fields when in strict mode", () => {
            const expression = "20 15 * *";

            expect(() => parse(expression, { strict: true })).toThrow();
        });

        it("empty expression in strict mode", () => {
            expect(() => parse("", { strict: true })).toThrow();
        });

        it("duplicated zero values are rejected", () => {
            expect(() => parse("0,0 0 0 1 1 0")).toThrow("CronSecond Validation error, duplicate values found: 0");
            expect(() => parse("0,0 * * * *")).toThrow("CronMinute Validation error, duplicate values found: 0");
            expect(() => parse("0 0,0 * * *")).toThrow("CronHour Validation error, duplicate values found: 0");
            expect(() => parse("0 0 * * 0,0")).toThrow("CronDayOfWeek Validation error, duplicate values found: 0");
        });

        it("listing both sunday spellings is rejected as a duplicate", () => {
            expect(() => parse("0 0 * * 0,7")).toThrow("CronDayOfWeek Validation error, duplicate values found: 0");
            expect(() => parse("0 0 * * 7,0")).toThrow("CronDayOfWeek Validation error, duplicate values found: 0");
        });

        it("lists that contain a single zero are accepted", () => {
            expect(() => parse("0,30 * * * *")).not.toThrow();
            expect(() => parse("0-5 * * * *")).not.toThrow();
        });

        it("expressions with duplicated zero values fail at parse instead of crashing stringify", () => {
            expect(() => parse("0,0,0 * * * *")).toThrow("CronMinute Validation error, duplicate values found: 0");
            expect(() => parse("0 0 * * 0,0,0")).toThrow("CronDayOfWeek Validation error, duplicate values found: 0");
        });

        it("a long list of repeated wildcards is rejected in every field", () => {
            const field = `${"*,".repeat(300)}*`;

            expect(() => parse(`${field} * * * * *`)).toThrow("too many values in Second field");
            expect(() => parse(`* ${field} * * * *`)).toThrow("too many values in Minute field");
            expect(() => parse(`* * ${field} * * *`)).toThrow("too many values in Hour field");
            expect(() => parse(`* * * ${field} * *`)).toThrow("too many values in DayOfMonth field");
            expect(() => parse(`* * * * ${field} *`)).toThrow("too many values in Month field");
            expect(() => parse(`* * * * * ${field}`)).toThrow("too many values in DayOfWeek field");
        });

        it("a list of hashed steps is rejected once it expands past the value cap", () => {
            const field = `${"H/1,".repeat(40)}H/1`;

            expect(() => parse(`${field} * * * * *`)).toThrow("too many values in Second field");
            expect(() => parse(`* * * * * ${field}`)).toThrow("too many values in DayOfWeek field");
        });
    });

    describe("leap Year", () => {
        it("handle leap year with starting date 0 0 29 2 *", () => {
            const options = {
                currentDate: new Date(2020, 0, 1),
            };
            const interval = parse("0 0 29 2 *", options);

            for (let i = 0; i < 20; i += 1) {
                expect(interval.next().getDate()).toBe(29);
            }
        });
        it("handle leap year without starting date 0 0 29 2 *", () => {
            const interval = parse("0 0 29 2 *");

            for (let i = 0; i < 20; i += 1) {
                expect(interval.next().getDate()).toBe(29);
            }
        });
        it("handle leap year when day of month is set to 31", () => {
            const interval = parse("* * 31 * *");

            for (let i = 0; i < 20; i += 1) {
                expect(interval.next().getDate()).not.toBeNull();
            }
        });
    });

    describe("prev date", () => {
        it("prev should match correctly (issue #98) when milliseconds are greater than 0", () => {
            const options = {
                currentDate: new Date("2017-06-13T18:21:25.002Z"),
            };

            const interval = parse("*/5 * * * * *", options);
            const previous = interval.prev();

            expect(previous.getSeconds()).toBe(25);
        });

        it("prev should match correctly (issue #98) when milliseconds are equal to 0", () => {
            const interval = parse("59 59 23 * * *", {
                currentDate: new Date("2012-12-26 14:38:53"),
            });

            for (const date of [25, 24, 23, 22]) {
                const previous = interval.prev();

                expect(previous.getFullYear()).toBe(2012);
                expect(previous.getMonth()).toBe(11);
                expect(previous.getDate()).toEqual(date);
                expect(previous.getHours()).toBe(23);
                expect(previous.getMinutes()).toBe(59);
                expect(previous.getSeconds()).toBe(59);
            }
        });
    });

    describe(`test expressions with "L" last of flag`, () => {
        const testCasesLastWeekdayOfMonth = [
            { expectedDate: 27, expression: "0 0 0 * * 1L" },
            { expectedDate: 28, expression: "0 0 0 * * 2L" },
            { expectedDate: 29, expression: "0 0 0 * * 3L" },
            { expectedDate: 30, expression: "0 0 0 * * 4L" },
            { expectedDate: 24, expression: "0 0 0 * * 5L" },
            { expectedDate: 25, expression: "0 0 0 * * 6L" },
            { expectedDate: 26, expression: "0 0 0 * * 0L" },
            { expectedDate: 26, expression: "0 0 0 * * 7L" },
        ];

        testCasesLastWeekdayOfMonth.forEach(({ expectedDate, expression }) => {
            const options = {
                currentDate: new Date(2021, 8, 1),
                endDate: new Date(2021, 11, 1),
            };

            it(`parses cron with last weekday of the month: ${expression}`, () => {
                const interval = parse(expression, options);

                expect(interval.next().getDate()).toBe(expectedDate);
            });
        });

        it("parses cron with last day in a month (wildcard month)", () => {
            const options = {
                currentDate: new Date(2014, 0, 1),
                endDate: new Date(2014, 10, 1),
            };

            const interval = parse("0 0 L * *", options);

            expect(interval.next().getDate()).toBe(31);
            expect(interval.next().getDate()).toBe(28);
            expect(interval.next().getDate()).toBe(31);
            expect(interval.next().getDate()).toBe(30);
            expect(interval.next().getDate()).toBe(31);
            expect(interval.next().getDate()).toBe(30);
            expect(interval.next().getDate()).toBe(31);
            expect(interval.next().getDate()).toBe(31);
            expect(interval.next().getDate()).toBe(30);
            expect(interval.next().getDate()).toBe(31);
        });

        it("parses cron with last day in a month (explicit month)", () => {
            const options = {
                currentDate: new Date(2014, 0, 1),
                endDate: new Date(2016, 10, 1),
            };

            const interval = parse("0 0 L 10 *", options);

            let date = interval.next();

            expect(date.getDate()).toBe(31);
            expect(date.getMonth()).toBe(9);
            expect(date.getFullYear()).toBe(2014);

            date = interval.next();

            expect(date.getDate()).toBe(31);
            expect(date.getMonth()).toBe(9);
            expect(date.getFullYear()).toBe(2015);

            date = interval.next();

            expect(date.getDate()).toBe(31);
            expect(date.getMonth()).toBe(9);
            expect(date.getFullYear()).toBe(2016);
        });

        it("parses cron with last day in feb", () => {
            const options = {
                currentDate: new Date(2014, 0, 1),
                endDate: new Date(2018, 10, 1),
            };

            const interval = parse("0 0 L 2 *", options);

            let date = interval.next();

            expect(date.getDate()).toBe(28);
            expect(date.getMonth()).toBe(1);
            expect(date.getFullYear()).toBe(2014);

            date = interval.next();

            expect(date.getDate()).toBe(28);
            expect(date.getMonth()).toBe(1);
            expect(date.getFullYear()).toBe(2015);

            date = interval.next();

            expect(date.getDate()).toBe(29);
            expect(date.getMonth()).toBe(1);
            expect(date.getFullYear()).toBe(2016);
        });

        it("parses cron with mix of sequence and range and last day in feb", () => {
            const options = {
                currentDate: new Date(2014, 0, 1),
                endDate: new Date(2014, 10, 1),
            };

            const interval = parse("0 0 1,3,6-8,L 2 *", options);

            expect(interval.next().getDate()).toBe(1);
            expect(interval.next().getDate()).toBe(3);
            expect(interval.next().getDate()).toBe(6);
            expect(interval.next().getDate()).toBe(7);
            expect(interval.next().getDate()).toBe(8);
            expect(interval.next().getDate()).toBe(28);
        });

        it("parses expression that runs on both last monday and friday of the month", () => {
            const options = {
                currentDate: new Date(2021, 8, 1),
                endDate: new Date(2021, 11, 1),
            };
            const interval = parse("0 0 0 * * 1L,5L", options);

            expect(interval.next().getDate()).toBe(24);
            expect(interval.next().getDate()).toBe(27);
        });

        it("parses expression that runs on both every monday and last friday of month", () => {
            const options = {
                currentDate: new Date(2021, 8, 1),
                endDate: new Date(2021, 8, 30),
            };
            const interval = parse("0 0 0 * * 1,5L", options);

            expect(interval.next().getDate()).toBe(6);
            expect(interval.next().getDate()).toBe(13);
            expect(interval.next().getDate()).toBe(20);
            expect(interval.next().getDate()).toBe(24);
            expect(interval.next().getDate()).toBe(27);
        });

        it("throws when parsing a standalone last weekday of the month marker", () => {
            expect(() => parse("0 0 0 * * L")).toThrow("CronDayOfWeek Validation error, unexpected standalone L");
        });

        it("throws when parsing a standalone last weekday of the month marker in a list", () => {
            expect(() => parse("0 0 0 * * 1,L")).toThrow("CronDayOfWeek Validation error, unexpected standalone L");
        });
    });
});
