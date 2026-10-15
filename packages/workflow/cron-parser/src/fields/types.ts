type RangeFrom<LENGTH extends number, ACC extends unknown[] = []> = ACC["length"] extends LENGTH ? ACC : RangeFrom<LENGTH, [...ACC, 1]>;
type IntRange<FROM extends number[], TO extends number, ACC extends number = never> = FROM["length"] extends TO
    ? ACC | TO
    : IntRange<[...FROM, 1], TO, ACC | FROM["length"]>;

type SixtyRange = IntRange<RangeFrom<0>, 59>; // 0-59 - inclusive
type HourRange = IntRange<RangeFrom<0>, 23>; // 0-23 - inclusive
type DayOfMonthRange = IntRange<RangeFrom<1>, 31> | "L" | "LW" | `L-${number}` | `${number}W`; // 1-31 - inclusive, or L, LW, L-n and nW
type MonthRange = IntRange<RangeFrom<1>, 12>; // 1-12 - inclusive
type DayOfWeekRange = IntRange<RangeFrom<0>, 7> | "L"; // 0-7 - inclusive
type CronFieldType = SixtyRange[] | HourRange[] | DayOfMonthRange[] | MonthRange[] | DayOfWeekRange[];
type CronChars = "L" | "W";
type CronMin = 0 | 1;
type CronMax = 6 | 7 | 12 | 23 | 31 | 59;
type ParseRangeResponse = number[] | string[] | number | string;

type CronConstraints = {
    chars: ReadonlyArray<CronChars>;
    max: CronMax;
    min: CronMin;
    validChars: RegExp;
};
export type {
    CronChars,
    CronConstraints,
    CronFieldType,
    CronMax,
    CronMin,
    DayOfMonthRange,
    DayOfWeekRange,
    HourRange,
    MonthRange,
    ParseRangeResponse,
    SixtyRange,
};
