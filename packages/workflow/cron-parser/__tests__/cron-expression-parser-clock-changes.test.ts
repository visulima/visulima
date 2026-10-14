/* eslint-disable vitest/prefer-expect-assertions, vitest/prefer-strict-equal -- ported from the reference implementation's suite; kept close to the original for easy comparison */
import { describe, expect, it } from "vitest";

import CronDate from "../src/cron-date";
import type { CronExpression, CronExpressionOptions } from "../src/cron-expression";
import { TIME_SPAN_OUT_OF_BOUNDS_ERROR_MESSAGE } from "../src/cron-expression";
import { CronExpressionParser } from "../src/cron-expression-parser";

describe(CronExpressionParser, () => {
    describe("timezones and DST tests", () => {
        it("it works on DST start", () => {
            const options: CronExpressionOptions = {
                currentDate: "2016-03-27 02:00:01",
                endDate: undefined,
                tz: "Europe/Athens",
            };

            let interval: CronExpression;
            let next: CronDate;

            interval = CronExpressionParser.parse("0 * * * *", options);

            expect(interval).toBeDefined();

            next = interval.next();

            expect(next.getMinutes()).toBe(0); // 0 Minutes
            expect(next.getHours()).toBe(4); // Due to DST start in Athens, 3 is skipped
            expect(next.getDate()).toBe(27); // on the 27th

            next = interval.next();

            expect(next.getMinutes()).toBe(0); // 0 Minutes
            expect(next.getHours()).toBe(5); // 5 AM
            expect(next.getDate()).toBe(27); // on the 27th

            interval = CronExpressionParser.parse("30 2 * * *", options);

            expect(interval).toBeDefined();

            next = interval.next();

            expect(next.getMinutes()).toBe(30); // 30 Minutes
            expect(next.getHours()).toBe(2); // 2 AM
            expect(next.getDate()).toBe(27); // on the 27th

            next = interval.next();

            expect(next.getMinutes()).toBe(30); // 30 Minutes
            expect(next.getHours()).toBe(2); // 2 AM
            expect(next.getDate()).toBe(28); // on the 28th

            interval = CronExpressionParser.parse("0 3 * * *", options);

            expect(interval).toBeDefined();

            next = interval.next();

            expect(next.getMinutes()).toBe(0); // 0 Minutes
            expect(next.getHours()).toBe(4); // Due to DST start in Athens, 3 is skipped
            expect(next.getDate()).toBe(27); // on the 27th

            next = interval.next();

            expect(next.getMinutes()).toBe(0); // 0 Minutes
            expect(next.getHours()).toBe(3); // 3 on the 28th
            expect(next.getDate()).toBe(28); // on the 28th

            interval = CronExpressionParser.parse("*/20 3 * * *", options);

            expect(interval).toBeDefined();

            next = interval.next();

            expect(next.getMinutes()).toBe(0); // 0 Minutes
            expect(next.getHours()).toBe(4); // Due to DST start in Athens, 3 is skipped
            expect(next.getDate()).toBe(27); // on the 27th

            next = interval.next();

            expect(next.getMinutes()).toBe(20); // 20 Minutes
            expect(next.getHours()).toBe(4); // Due to DST start in Athens, 3 is skipped
            expect(next.getDate()).toBe(27); // on the 27th

            next = interval.next();

            expect(next.getMinutes()).toBe(40); // 20 Minutes
            expect(next.getHours()).toBe(4); // Due to DST start in Athens, 3 is skipped
            expect(next.getDate()).toBe(27); // on the 27th

            next = interval.next();

            expect(next.getMinutes()).toBe(0); // 0 Minutes
            expect(next.getHours()).toBe(3); // 3 AM
            expect(next.getDate()).toBe(28); // on the 28th

            options.currentDate = "2016-03-27 00:00:01";

            interval = CronExpressionParser.parse("0 * 27 * *", options);

            expect(interval).toBeDefined();

            next = interval.next();

            expect(next.getMinutes()).toBe(0); // 0 Minutes
            expect(next.getHours()).toBe(1); // 1 AM
            expect(next.getDate()).toBe(27); // on the 27th

            next = interval.next();

            expect(next.getMinutes()).toBe(0); // 0 Minutes
            expect(next.getHours()).toBe(2); // 2 AM
            expect(next.getDate()).toBe(27); // on the 27th

            next = interval.next();

            expect(next.getMinutes()).toBe(0); // 0 Minutes
            expect(next.getHours()).toBe(4); // 4 AM
            expect(next.getDate()).toBe(27); // on the 27th

            next = interval.next();

            expect(next.getMinutes()).toBe(0); // 0 Minutes
            expect(next.getHours()).toBe(5); // 5 AM
            expect(next.getDate()).toBe(27); // on the 27th

            options.currentDate = "2016-03-27 00:00:01";
            options.endDate = "2016-03-27 03:00:01";

            interval = CronExpressionParser.parse("0 * * * *", options);

            expect(interval).toBeDefined();

            next = interval.next();

            expect(next.getMinutes()).toBe(0); // 0 Minutes
            expect(next.getHours()).toBe(1); // 1 AM
            expect(next.getDate()).toBe(27); // on the 27th

            next = interval.next();

            expect(next.getMinutes()).toBe(0); // 0 Minutes
            expect(next.getHours()).toBe(2); // 2 AM
            expect(next.getDate()).toBe(27); // on the 27th

            next = interval.next();

            expect(next.getMinutes()).toBe(0); // 0 Minutes
            expect(next.getHours()).toBe(4); // 4 AM
            expect(next.getDate()).toBe(27); // on the 27th

            expect(() => interval.next()).toThrow(TIME_SPAN_OUT_OF_BOUNDS_ERROR_MESSAGE);
        });

        it("it works on DST end 2016-10-30 02:00:01 - 0 * * * *", () => {
            const options: CronExpressionOptions = {
                currentDate: "2016-10-30 02:00:01",
                endDate: undefined,
                tz: "Europe/Athens",
            };

            const interval: CronExpression = CronExpressionParser.parse("0 * * * *", options);
            let next: CronDate;

            expect(interval).toBeDefined();

            next = interval.next();

            expect(next.getHours()).toBe(3);
            expect(next.getDate()).toBe(30);

            next = interval.next();

            expect(next.getHours()).toBe(3); // Due to DST end in Athens (4-->3)
            expect(next.getDate()).toBe(30);

            next = interval.next();

            expect(next.getHours()).toBe(4);
            expect(next.getDate()).toBe(30);
        });

        it("works on DST end 2016-10-30 02:00:01 - 0 3 * * *", () => {
            const options: CronExpressionOptions = {
                currentDate: "2016-10-30 02:00:01",
                endDate: undefined,
                tz: "Europe/Athens",
            };

            const interval: CronExpression = CronExpressionParser.parse("0 3 * * *", options);
            let next: CronDate;

            expect(interval).toBeDefined();

            next = interval.next();

            expect(next.getHours()).toBe(3);
            expect(next.getDate()).toBe(30);

            next = interval.next();

            expect(next.getHours()).toBe(3);
            expect(next.getDate()).toBe(31);
        });

        it("works on DST end 2016-10-30 02:00:01 - */20 3 * * *", () => {
            const options: CronExpressionOptions = {
                currentDate: "2016-10-30 02:00:01",
                endDate: undefined,
                tz: "Europe/Athens",
            };

            const interval: CronExpression = CronExpressionParser.parse("*/20 3 * * *", options);
            let next: CronDate;

            expect(interval).toBeDefined();

            next = interval.next();

            expect(next.getMinutes()).toBe(0);
            expect(next.getHours()).toBe(3);
            expect(next.getDate()).toBe(30);

            next = interval.next();

            expect(next.getMinutes()).toBe(20);
            expect(next.getHours()).toBe(3);
            expect(next.getDate()).toBe(30);

            next = interval.next();

            expect(next.getMinutes()).toBe(40);
            expect(next.getHours()).toBe(3);
            expect(next.getDate()).toBe(30);

            next = interval.next();

            expect(next.getMinutes()).toBe(0);
            expect(next.getHours()).toBe(3);
            expect(next.getDate()).toBe(31);
        });

        it("works on DST end 2016-10-30 00:00:01 - 0 * 30 * *", () => {
            const options: CronExpressionOptions = {
                currentDate: "2016-10-30 00:00:01",
                endDate: undefined,
                tz: "Europe/Athens",
            };

            const interval: CronExpression = CronExpressionParser.parse("0 * 30 * *", options);
            let next: CronDate;

            expect(interval).toBeDefined();

            next = interval.next();

            expect(next.getHours()).toBe(1); // 1 AM
            expect(next.getDate()).toBe(30); // on the 30th

            next = interval.next();

            expect(next.getHours()).toBe(2); // 2 AM
            expect(next.getDate()).toBe(30); // on the 30th

            next = interval.next();

            expect(next.getHours()).toBe(3); // 3 AM
            expect(next.getDate()).toBe(30); // on the 30th

            next = interval.next();

            expect(next.getHours()).toBe(3); // 3 AM (DST end)
            expect(next.getDate()).toBe(30); // on the 30th

            next = interval.next();

            expect(next.getHours()).toBe(4); // 4 AM
            expect(next.getDate()).toBe(30); // on the 30th
        });

        it("works on DST end 2016-10-30 00:00:01 - 0 * * * *  DST offset via ISO 8601 format", () => {
            // specify the DST offset via ISO 8601 format, as 3am is repeated
            const options: CronExpressionOptions = {
                currentDate: "2016-10-30 00:00:01",
                endDate: "2016-10-30T03:00:01+03",
                tz: "Europe/Athens",
            };

            let interval: CronExpression = CronExpressionParser.parse("0 * * * *", options);
            let next: CronDate;

            expect(interval).toBeDefined();

            next = interval.next();

            expect(next.getHours()).toBe(1); // 1 AM
            expect(next.getDate()).toBe(30); // on the 30th

            next = interval.next();

            expect(next.getHours()).toBe(2); // 2 AM
            expect(next.getDate()).toBe(30); // on the 30th

            next = interval.next();

            expect(next.getHours()).toBe(3); // 3 AM
            expect(next.getDate()).toBe(30); // on the 30th

            expect(() => interval.next()).toThrow(TIME_SPAN_OUT_OF_BOUNDS_ERROR_MESSAGE);

            options.endDate = "2016-10-30 04:00:01";

            interval = CronExpressionParser.parse("0 * * * *", options);

            expect(interval).toBeDefined();

            next = interval.next();

            expect(next.getHours()).toBe(1); // 1 AM
            expect(next.getDate()).toBe(30); // on the 30th

            next = interval.next();

            expect(next.getHours()).toBe(2); // 2 AM
            expect(next.getDate()).toBe(30); // on the 30th

            next = interval.next();

            expect(next.getHours()).toBe(3); // 3 AM
            expect(next.getDate()).toBe(30); // on the 30th

            next = interval.next();

            expect(next.getHours()).toBe(3); // 3 AM (DST end)
            expect(next.getDate()).toBe(30); // on the 30th

            next = interval.next();

            expect(next.getHours()).toBe(4); // 4 AM
            expect(next.getDate()).toBe(30); // on the 30th

            expect(() => interval.next()).toThrow(TIME_SPAN_OUT_OF_BOUNDS_ERROR_MESSAGE);

            options.currentDate = new Date("Sun Oct 29 2016 01:00:00 GMT+0200");
            options.endDate = undefined;

            interval = CronExpressionParser.parse("0 12 * * *", options);

            expect(interval).toBeDefined();

            next = interval.next();

            expect(next.getHours()).toBe(12); // 12 PM
            expect(next.getDate()).toBe(29); // on the 29th

            next = interval.next();

            expect(next.getHours()).toBe(12); // 12 PM
            expect(next.getDate()).toBe(30); // on the 30th

            next = interval.next();

            expect(next.getHours()).toBe(12); // 12 PM
            expect(next.getDate()).toBe(31); // on the 31st

            options.currentDate = new Date("Sun Oct 29 2016 02:59:00 GMT+0200");

            interval = CronExpressionParser.parse("0 12 * * *", options);

            expect(interval).toBeDefined();

            next = interval.next();

            expect(next.getHours()).toBe(12); // 12 PM
            expect(next.getDate()).toBe(29); // on the 29th

            next = interval.next();

            expect(next.getHours()).toBe(12); // 12 PM
            expect(next.getDate()).toBe(30); // on the 30th

            next = interval.next();

            expect(next.getHours()).toBe(12); // 12 PM
            expect(next.getDate()).toBe(31); // on the 31st

            options.currentDate = new Date("Sun Oct 29 2016 02:59:59 GMT+0200");

            interval = CronExpressionParser.parse("0 12 * * *", options);

            expect(interval).toBeDefined();

            next = interval.next();

            expect(next.getHours()).toBe(12); // 12 PM
            expect(next.getDate()).toBe(29); // on the 29th

            next = interval.next();

            expect(next.getHours()).toBe(12); // 12 PM
            expect(next.getDate()).toBe(30); // on the 30th

            next = interval.next();

            expect(next.getHours()).toBe(12); // 12 PM
            expect(next.getDate()).toBe(31); // on the 31st

            options.currentDate = new Date("Sun Oct 30 2016 01:00:00 GMT+0200");

            interval = CronExpressionParser.parse("0 12 * * *", options);

            expect(interval).toBeDefined();

            next = interval.next();

            expect(next.getHours()).toBe(12); // 12 PM
            expect(next.getDate()).toBe(30); // on the 30th

            next = interval.next();

            expect(next.getHours()).toBe(12); // 12 PM
            expect(next.getDate()).toBe(31); // on the 31st

            options.currentDate = new Date("Sun Oct 30 2016 01:59:00 GMT+0200");

            interval = CronExpressionParser.parse("0 12 * * *", options);

            expect(interval).toBeDefined();

            next = interval.next();

            expect(next.getHours()).toBe(12); // 12 PM
            expect(next.getDate()).toBe(30); // on the 30th

            next = interval.next();

            expect(next.getHours()).toBe(12); // 12 PM
            expect(next.getDate()).toBe(31); // on the 31st

            options.currentDate = new Date("Sun Oct 30 2016 01:59:59 GMT+0200");

            interval = CronExpressionParser.parse("0 12 * * *", options);

            expect(interval).toBeDefined();

            next = interval.next();

            expect(next.getHours()).toBe(12); // 12 PM
            expect(next.getDate()).toBe(30); // on the 30th

            next = interval.next();

            expect(next.getHours()).toBe(12); // 12 PM
            expect(next.getDate()).toBe(31); // on the 31st

            options.currentDate = new Date("Sun Oct 30 2016 02:59:00 GMT+0200");

            interval = CronExpressionParser.parse("0 12 * * *", options);

            expect(interval).toBeDefined();

            next = interval.next();

            expect(next.getHours()).toBe(12); // 12 PM
            expect(next.getDate()).toBe(30); // on the 30th

            next = interval.next();

            expect(next.getHours()).toBe(12); // 12 PM
            expect(next.getDate()).toBe(31); // on the 31st
        });

        it("it will work with #131 issue case", () => {
            const options: CronExpressionOptions = {
                currentDate: new Date("Sun Oct 30 2018 02:59:00 GMT+0200"),
                endDate: undefined,
                tz: "America/Sao_Paulo",
            };

            const interval = CronExpressionParser.parse("0 9 1 1 *", options);
            let next = interval.next();

            expect(next.getFullYear()).toBe(2019);
            expect(next.getDate()).toBe(1);
            expect(next.getMonth()).toBe(0);

            next = interval.prev();

            expect(next.getFullYear()).toBe(2018);
            expect(next.getDate()).toBe(1);
            expect(next.getMonth()).toBe(0);

            next = interval.prev();

            expect(next.getFullYear()).toBe(2017);
            expect(next.getDate()).toBe(1);
            expect(next.getMonth()).toBe(0);
        });

        it("works with #137 issue case", () => {
            const options: CronExpressionOptions = {
                currentDate: new Date("10/28/2018"),
                endDate: undefined,
                tz: "America/New_York",
            };

            const interval = CronExpressionParser.parse("0 12 * * 3", options);
            const date = interval.next();

            expect(date.getFullYear()).toBe(2018);
            expect(date.getDate()).toBe(31);
            expect(date.getMonth()).toBe(9);
        });

        it("handles DST transition day with hour jump using step-by-step method", () => {
            const options: CronExpressionOptions = {
                currentDate: "2016-03-27 01:30:00",
                endDate: undefined,
                tz: "Europe/Athens",
            };

            const interval = CronExpressionParser.parse("0 4,5 * * *", options);

            const next = interval.next();

            expect(next).toBeInstanceOf(CronDate);
            expect([4, 5]).toContain(next.getHours());
            expect(next.getMinutes()).toBe(0);
        });

        it("handles DST transition day with reverse hour jump using step-by-step method", () => {
            const options: CronExpressionOptions = {
                currentDate: "2016-10-30 05:00:00",
                endDate: undefined,
                tz: "Europe/Athens",
            };

            const interval = CronExpressionParser.parse("0 2,3 * * *", options);

            const previous = interval.prev();

            expect(previous).toBeInstanceOf(CronDate);
            expect([2, 3]).toContain(previous.getHours());
            expect(previous.getMinutes()).toBe(0);
        });

        it("does not overshoot target hour on spring-forward DST day (forward)", () => {
            const options: CronExpressionOptions = {
                currentDate: new Date("2026-03-08T05:45:00.000Z"), // 11:45 PM CST Sat Mar 7
                tz: "America/Chicago",
            };

            const interval = CronExpressionParser.parse("0 8 * * 0", options);
            const next = interval.next();

            expect(next).toBeInstanceOf(CronDate);
            expect(next.toISOString()).toBe("2026-03-08T13:00:00.000Z"); // 8am CDT Sun Mar 8
        });

        it("does not overshoot target hour on spring-forward DST day (reverse)", () => {
            const options: CronExpressionOptions = {
                currentDate: new Date("2026-03-08T23:00:00.000Z"), // 6pm CDT Sun Mar 8
                tz: "America/Chicago",
            };

            const interval = CronExpressionParser.parse("0 8 * * 0", options);
            const previous = interval.prev();

            expect(previous).toBeInstanceOf(CronDate);
            expect(previous.toISOString()).toBe("2026-03-08T13:00:00.000Z"); // 8am CDT Sun Mar 8
        });

        // Antarctica/Troll advances two hours on 2026-03-29, 00:00 -> 03:00, so
        // both 01:00 and 02:00 are skipped. A schedule inside that window used to
        // be dropped for the day rather than moved to the far side of the gap.
        describe("transitions wider than one hour", () => {
            it("compensates a schedule inside a two-hour gap instead of skipping the day", () => {
                const options: CronExpressionOptions = {
                    currentDate: new Date("2026-03-27T12:00:00.000Z"),
                    tz: "Antarctica/Troll",
                };

                const interval = CronExpressionParser.parse("30 1 * * *", options);

                expect(interval.next().toISOString()).toBe("2026-03-28T01:30:00.000Z"); // 01:30 at UTC+00

                // Troll goes 01:00 -> 03:00 on the 29th, so 01:30 does not exist.
                expect(interval.next().toISOString()).toBe("2026-03-29T01:30:00.000Z"); // 03:30 local

                expect(interval.next().toISOString()).toBe("2026-03-29T23:30:00.000Z"); // 01:30 at UTC+02
            });

            it("compensates the second skipped hour of a two-hour gap", () => {
                const options: CronExpressionOptions = {
                    currentDate: new Date("2026-03-28T12:00:00.000Z"),
                    tz: "Antarctica/Troll",
                };

                // 02:00 is the second of the two hours the transition removes.
                const interval = CronExpressionParser.parse("30 2 * * *", options);

                expect(interval.next().toISOString()).toBe("2026-03-29T01:30:00.000Z"); // 03:30 local
                expect(interval.next().toISOString()).toBe("2026-03-30T00:30:00.000Z"); // 02:30 local
            });

            it("does not repeat the compensated occurrence on later hours", () => {
                const options: CronExpressionOptions = {
                    currentDate: new Date("2026-03-28T12:00:00.000Z"),
                    tz: "Antarctica/Troll",
                };

                const interval = CronExpressionParser.parse("30 1 * * *", options);

                // Matching has to stop once the search leaves the window.
                expect(interval.take(3).map((date) => date.toISOString())).toEqual([
                    "2026-03-29T01:30:00.000Z", // 03:30 local, compensated
                    "2026-03-29T23:30:00.000Z", // 01:30 local on the 30th
                    "2026-03-30T23:30:00.000Z", // 01:30 local on the 31st
                ]);
            });

            it("does not repeat the compensated occurrence when the minute rolls the hour", () => {
                // The window is left by a minute step rather than an hour step.
                const options: CronExpressionOptions = {
                    currentDate: new Date("2026-03-07T12:00:00.000Z"),
                    tz: "America/New_York",
                };

                const interval = CronExpressionParser.parse("30 59 2 * * *", options);

                expect(interval.take(3).map((date) => date.toISOString())).toEqual([
                    "2026-03-08T07:59:30.000Z", // 03:59:30 EDT, compensated
                    "2026-03-09T06:59:30.000Z", // 02:59:30 EDT
                    "2026-03-10T06:59:30.000Z",
                ]);
            });

            it("leaves a sub-hour transition alone", () => {
                // Lord Howe moves by 30 minutes, removing no whole wall-clock hour.
                const options: CronExpressionOptions = {
                    currentDate: new Date("2026-10-03T05:00:00.000Z"),
                    tz: "Australia/Lord_Howe",
                };

                const interval = CronExpressionParser.parse("30 2 * * *", options);

                expect(interval.next().toISOString()).toBe("2026-10-03T15:30:00.000Z");
                expect(interval.next().toISOString()).toBe("2026-10-04T15:30:00.000Z");
            });

            it("keeps every occurrence when a sub-hour transition is crossed by an hour step", () => {
                // Same 30-minute shift, reached hour by hour rather than by a day jump.
                const options: CronExpressionOptions = {
                    currentDate: new Date("2026-10-03T12:00:00.000Z"),
                    tz: "Australia/Lord_Howe",
                };

                const interval = CronExpressionParser.parse("30 1,2 * * *", options);

                // 02:30 exists on the transition day (the clock jumps 02:00 -> 02:30) and is what was asked
                // for. The reference implementation returned 03:30 here, a known defect of its hour stepping;
                // 02:30 at UTC+11 is the correct run.
                expect(interval.take(3).map((date) => date.toISOString())).toEqual([
                    "2026-10-03T15:00:00.000Z", // 01:30 at UTC+10:30
                    "2026-10-03T15:30:00.000Z", // 02:30 at UTC+11, after the shift
                    "2026-10-04T14:30:00.000Z", // 01:30 on the 5th
                ]);
            });

            it("does not compensate when stepping backward over a fall-back", () => {
                // Santiago falls back on 5 April, and stepping back over it raises the
                // UTC offset just as a spring-forward does.
                const options: CronExpressionOptions = {
                    currentDate: new Date("2026-04-05T12:00:00.000Z"),
                    tz: "America/Santiago",
                };

                const interval = CronExpressionParser.parse("30 22 * * *", options);

                expect(interval.prev().toISOString()).toBe("2026-04-05T01:30:00.000Z"); // 22:30 on the 4th
            });

            it("compensates a gap that ends after midnight", () => {
                // Nuuk transitions at 01:00 UTC, which on UTC-2 skips 23:00 local and
                // lands on 00:00 the next day.
                const options: CronExpressionOptions = {
                    currentDate: new Date("2024-03-30T00:00:00.000Z"),
                    tz: "America/Nuuk",
                };

                const interval = CronExpressionParser.parse("0 22,23 * * *", options);

                expect(interval.take(4).map((date) => date.toISOString())).toEqual([
                    "2024-03-30T01:00:00.000Z", // 23:00 on the 29th
                    "2024-03-31T00:00:00.000Z", // 22:00 on the 30th
                    "2024-03-31T01:00:00.000Z", // 00:00 on the 31st, for the skipped 23:00
                    "2024-03-31T23:00:00.000Z", // 22:00 on the 31st
                ]);
            });

            it("compensates a skipped midnight hour", () => {
                // Chile transitions at 24:00, so 00:00 is the hour that disappears.
                const options: CronExpressionOptions = {
                    currentDate: new Date("2026-09-05T02:00:00.000Z"),
                    tz: "America/Santiago",
                };

                const interval = CronExpressionParser.parse("0 23,0 * * *", options);

                expect(interval.take(4).map((date) => date.toISOString())).toEqual([
                    "2026-09-05T03:00:00.000Z", // 23:00 on the 4th
                    "2026-09-05T04:00:00.000Z", // 00:00 on the 5th
                    "2026-09-06T03:00:00.000Z", // 23:00 on the 5th
                    "2026-09-06T04:00:00.000Z", // 01:00 on the 6th, for the skipped 00:00
                ]);
            });

            it("leaves a skipped calendar day alone", () => {
                // Apia crossed the date line and lost 30 December entirely, moving the
                // offset by a full day while removing no wall-clock hour.
                const options: CronExpressionOptions = {
                    currentDate: new Date("2011-12-28T00:00:00.000Z"),
                    tz: "Pacific/Apia",
                };

                const interval = CronExpressionParser.parse("0 12 * * *", options);

                expect(interval.take(4).map((date) => date.toISOString())).toEqual([
                    "2011-12-28T22:00:00.000Z", // 12:00 on the 28th
                    "2011-12-29T22:00:00.000Z", // 12:00 on the 29th
                    "2011-12-30T22:00:00.000Z", // 12:00 on the 31st, the 30th never happened
                    "2011-12-31T22:00:00.000Z", // 12:00 on 1 January
                ]);
            });
        });
    });
});
