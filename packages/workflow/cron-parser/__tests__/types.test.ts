/* eslint-disable vitest/prefer-expect-assertions -- the assertions are type level, checked by the compiler rather than at run time */
import { describe, expectTypeOf, it } from "vitest";

import type { DayOfMonthRange, DayOfWeekRange, HourRange, MonthRange, SixtyRange } from "../src";
import type { Months } from "../src/cron-expression-parser";

/**
 * The range types are checked by the compiler (`lint:types`), not at run time: each line below fails to
 * compile if a type accepts a value it should reject, or rejects one it should accept.
 */
describe("range types", () => {
    it("accepts the limits of each field and nothing beyond them", () => {
        expectTypeOf<0>().toExtend<SixtyRange>();
        expectTypeOf<59>().toExtend<SixtyRange>();
        expectTypeOf<-1>().not.toExtend<SixtyRange>();
        expectTypeOf<60>().not.toExtend<SixtyRange>();
        expectTypeOf<0.5>().not.toExtend<SixtyRange>();
        expectTypeOf<58.5>().not.toExtend<SixtyRange>();

        expectTypeOf<0>().toExtend<HourRange>();
        expectTypeOf<23>().toExtend<HourRange>();
        expectTypeOf<-1>().not.toExtend<HourRange>();
        expectTypeOf<24>().not.toExtend<HourRange>();
        expectTypeOf<0.5>().not.toExtend<HourRange>();
        expectTypeOf<22.5>().not.toExtend<HourRange>();

        expectTypeOf<1>().toExtend<DayOfMonthRange>();
        expectTypeOf<31>().toExtend<DayOfMonthRange>();
        expectTypeOf<"L">().toExtend<DayOfMonthRange>();
        expectTypeOf<0>().not.toExtend<DayOfMonthRange>();
        expectTypeOf<32>().not.toExtend<DayOfMonthRange>();
        expectTypeOf<0.5>().not.toExtend<DayOfMonthRange>();
        expectTypeOf<30.5>().not.toExtend<DayOfMonthRange>();
        expectTypeOf<"l">().not.toExtend<DayOfMonthRange>();
        expectTypeOf<"LW">().toExtend<DayOfMonthRange>();
        expectTypeOf<"L-3">().toExtend<DayOfMonthRange>();
        expectTypeOf<"15W">().toExtend<DayOfMonthRange>();
        expectTypeOf<"W">().not.toExtend<DayOfMonthRange>();
        expectTypeOf<"LL">().not.toExtend<DayOfMonthRange>();
        expectTypeOf<"x5W">().not.toExtend<DayOfMonthRange>();

        expectTypeOf<1>().toExtend<MonthRange>();
        expectTypeOf<12>().toExtend<MonthRange>();
        expectTypeOf<0>().not.toExtend<MonthRange>();
        expectTypeOf<13>().not.toExtend<MonthRange>();
        expectTypeOf<0.5>().not.toExtend<MonthRange>();
        expectTypeOf<11.5>().not.toExtend<MonthRange>();

        expectTypeOf<0>().toExtend<DayOfWeekRange>();
        expectTypeOf<7>().toExtend<DayOfWeekRange>();
        expectTypeOf<-1>().not.toExtend<DayOfWeekRange>();
        expectTypeOf<8>().not.toExtend<DayOfWeekRange>();
        expectTypeOf<0.5>().not.toExtend<DayOfWeekRange>();
        expectTypeOf<6.5>().not.toExtend<DayOfWeekRange>();
    });

    it("names the months by their three letter abbreviation", () => {
        expectTypeOf<"jan">().toExtend<keyof typeof Months>();
        expectTypeOf<"dec">().toExtend<keyof typeof Months>();
        expectTypeOf<"january">().not.toExtend<keyof typeof Months>();
    });
});
