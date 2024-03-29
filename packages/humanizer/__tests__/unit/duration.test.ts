import ms from "ms";
import { describe, expect, it } from "vitest";

import duration from "../../src/duration";
import { durationLanguage as trDurationLanguage } from "../../src/language/tr";
import type { DurationDigitReplacements, DurationLanguage, DurationUnitName } from "../../src/types";

describe("duration", () => {
    it("should throw a error on invalid input", () => {
        expect.assertions(2);

        // @ts-expect-error - Testing invalid input
        expect(() => duration("foo")).toThrow(TypeError);
        expect(() => duration(Number.NaN)).toThrow(TypeError);
    });

    it("should humanizes English when passed no arguments", () => {
        expect.assertions(1);

        expect(duration(1000)).toBe("1 second");
    });

    it("should humanizes English when passed an empty object", () => {
        expect.assertions(1);

        expect(duration(1000, {})).toBe("1 second");
    });

    it("should change the delimiter", () => {
        expect.assertions(3);

        const options = { delimiter: "+" };

        expect(duration(0, options)).toBe("0 seconds");
        expect(duration(1000, options)).toBe("1 second");
        expect(duration(363_000, options)).toBe("6 minutes+3 seconds");
    });

    it("should change the spacer", () => {
        expect.assertions(3);

        const options = { spacer: " whole " };

        expect(duration(0, options)).toBe("0 whole seconds");
        expect(duration(1000, options)).toBe("1 whole second");
        expect(duration(260_040_000, options)).toBe("3 whole days, 14 whole minutes");
    });

    it("should use a conjunction", () => {
        expect.assertions(4);

        const options = { conjunction: " and " };

        expect(duration(0, options)).toBe("0 seconds");
        expect(duration(1000, options)).toBe("1 second");
        expect(duration(260_040_000, options)).toBe("3 days and 14 minutes");
        expect(duration(10_874_000, options)).toBe("3 hours, 1 minute, and 14 seconds");
    });

    it("should use a conjunction without a serial comma", () => {
        expect.assertions(3);

        const options = {
            conjunction: " & ",
            serialComma: false,
        };

        expect(duration(1000, options)).toBe("1 second");
        expect(duration(260_040_000, options)).toBe("3 days & 14 minutes");
        expect(duration(10_874_000, options)).toBe("3 hours, 1 minute & 14 seconds");
    });

    it("should change the units", () => {
        expect.assertions(3);

        const options = { units: ["d"] as DurationUnitName[] };

        expect(duration(0, options)).toBe("0 days");
        expect(duration(ms("6h"), options)).toBe("0.25 days");
        expect(duration(ms("7d"), options)).toBe("7 days");
    });

    it("should overwrite the unit measures in the initializer", () => {
        expect.assertions(4);

        const options = {
            unitMeasures: {
                d: 28_800_000,
                h: 3_600_000,
                m: 60_000,
                mo: 864_000_000,
                ms: 1,
                s: 1000,
                w: 144_000_000,
                y: 10_512_000_000,
            },
        };

        expect(duration(1000, options)).toBe("1 second");
        expect(duration(3_600_000, options)).toBe("1 hour");
        expect(duration(28_800_000, options)).toBe("1 day");
        expect(duration(144_000_000, options)).toBe("1 week");
    });

    it("should change the decimal", () => {
        expect.assertions(2);

        const options = {
            decimal: "what",
            units: ["s"] as DurationUnitName[],
        };

        expect(duration(1234, options)).toBe("1what234 seconds");
        expect(
            duration(1234, {
                decimal: "!!",
            }),
        ).toBe("1!!234 seconds");
    });

    it("should do simple rounding", () => {
        expect.assertions(9);

        const options = { round: true };

        expect(duration(0, options)).toBe("0 seconds");
        expect(duration(499, options)).toBe("0 seconds");
        expect(duration(500, options)).toBe("1 second");
        expect(duration(1000, options)).toBe("1 second");
        expect(duration(1499, options)).toBe("1 second");
        expect(duration(1500, options)).toBe("2 seconds");
        expect(duration(1500, options)).toBe("2 seconds");
        expect(duration(121_499, options)).toBe("2 minutes, 1 second");
        expect(duration(121_500, options)).toBe("2 minutes, 2 seconds");
    });

    it('should do rounding with the "units" option', () => {
        expect.assertions(4);

        expect(duration(86_364_000, { round: true, units: ["y", "mo", "w", "d", "h"] })).toBe("1 day");
        expect(duration(1_209_564_000, { round: true, units: ["y", "mo", "w", "d", "h"] })).toBe("2 weeks");
        expect(duration(3_692_055_438_000, { round: true, units: ["y", "mo"] })).toBe("117 years");
        expect(duration(3_692_055_438_001, { round: true, units: ["y", "mo", "w", "d", "h", "m"] })).toBe(
            "116 years, 11 months, 4 weeks, 1 day, 4 hours, 30 minutes",
        );
    });

    it('should do rounding with the "largest" option', () => {
        expect.assertions(4);

        const options = { round: true, units: ["y", "mo", "w", "d", "h", "m", "s"] as DurationUnitName[] };

        expect(duration(3_692_055_438_000, { largest: 1, ...options })).toBe("117 years");
        expect(duration(3_692_055_438_000, { largest: 2, ...options })).toBe("117 years");
        expect(duration(3_692_055_438_001, { largest: 100, ...options })).toBe("116 years, 11 months, 4 weeks, 1 day, 4 hours, 30 minutes");
        expect(duration(2_838_550, { largest: 3, round: true })).toBe("47 minutes, 19 seconds");
    });

    it('should do rounding with the "maxDecimalPoints" option', () => {
        expect.assertions(8);

        expect(duration(8123.456_789, { maxDecimalPoints: 2 })).toBe("8.12 seconds");
        expect(duration(8123.456_789, { maxDecimalPoints: 3 })).toBe("8.123 seconds");
        expect(duration(8000, { maxDecimalPoints: 3 })).toBe("8 seconds");
        expect(duration(8123.45, { maxDecimalPoints: 6 })).toBe("8.12345 seconds");
        expect(duration(8000, { maxDecimalPoints: 6 })).toBe("8 seconds");
        expect(duration(7123.456, { maxDecimalPoints: 0 })).toBe("7 seconds");
        expect(duration(7999, { maxDecimalPoints: 2 })).toBe("7.99 seconds");
        expect(duration(7999, { maxDecimalPoints: 3 })).toBe("7.999 seconds");
    });

    it("should ask for the largest units", () => {
        expect.assertions(6);

        const options = { largest: 2 };

        expect(duration(0, options)).toBe("0 seconds");
        expect(duration(1000, options)).toBe("1 second");
        expect(duration(2000, options)).toBe("2 seconds");
        expect(duration(540_360_012, options)).toBe("6 days, 6.100003333333333 hours");
        expect(duration(540_360_012, { largest: 3 })).toBe("6 days, 6 hours, 6.0002 minutes");
        expect(duration(540_360_012, { largest: 100 })).toBe("6 days, 6 hours, 6 minutes, 0.012 seconds");
    });

    it("should overwrite an existing language", () => {
        expect.assertions(3);

        const language: DurationLanguage = {
            d: () => "d",
            delimiter: "--",
            future: "",
            h: () => "h",
            m: () => "m",
            mo: () => "mo",
            ms: () => "ms",
            past: "",
            s: () => "s",
            w: () => "w",
            y: () => "y",
        };

        expect(duration(1000, { language })).toBe("1 s");
        expect(duration(61_000, { language })).toBe("1 m--1 s");

        expect(duration(61_000, { delimiter: "&&", language })).toBe("1 m&&1 s");
    });

    it('should uses "." as a fallback for a missing decimal', () => {
        expect.assertions(2);

        const options = {
            language: {
                d: () => "d",
                future: "",
                h: () => "h",
                m: () => "m",
                mo: () => "mo",
                ms: () => "ms",
                past: "",
                s: () => "s",
                w: () => "w",
                y: () => "y",
            },
        };

        expect(duration(71_750, options)).toBe("1 m, 11.75 s");
        expect(duration(71_750, { decimal: "!", ...options })).toBe("1 m, 11!75 s");
    });

    it("accepts negative durations using the option timeAdverb", () => {
        expect.assertions(3);

        expect(duration(363_000, { timeAdverb: true })).toBe("in 6 minutes, 3 seconds");
        expect(duration(-363_000, { timeAdverb: true })).toBe("6 minutes, 3 seconds ago");
        expect(duration(-363_000, { language: trDurationLanguage, timeAdverb: true })).toBe("6 dakika, 3 saniye önce");
    });

    it("should replace digits", () => {
        expect.assertions(1);

        const options = {
            digitReplacements: ["Zero", "One", "Two", "Three", "UNUSED", "UNUSED", "UNUSED", "UNUSED", "UNUSED", "UNUSED"] as DurationDigitReplacements,
        };

        expect(duration(123, options)).toBe("Zero.OneTwoThree seconds");
    });

    it.todo.each([
        [
            Number.MAX_VALUE,
            "5700447535712568547083700427941645003808085225292279557374304680873482979681895890593452082909683139015032646149857723394516742095667500822861020052921074432454921864096959420926519725467567456931340929884912090099277441972878147362726992943838905852030073647982034630974035871792165820638724934142y 218d 8h 8m 48s",
        ],
        [
            BigInt(Number.MAX_VALUE),
            "5700447535712568836077099940756733789893155997141203595856084373514626483384973958669126034778249561502424497511237394223564222694364034207523704550467323597984839883832803211448677387442583997465622415920063861691545637902816557209722493636863373550063350653353143175061459195234630260059944318435y 207d 22h 14m 18.3s",
        ],
        [
            0n +
                // 1ms
                1n +
                // 2s
                2n * 1000n +
                // 3m
                3n * 1000n * 60n +
                // 4h
                4n * 1000n * 60n * 60n +
                // Days
                BigInt(Number.MAX_VALUE) * 1000n * 60n * 60n * 24n,
            "492518667085565947437061434881381799446768678152999990681965689871663728164461750029012489404840762113809476584970910860915948840793052555530048073160376758865890165963154197469165726275039257381029776735493517650149543114803350542920023450224995474725473496449711570325310074468272054469179189112833218790y 18d 4h 3m 2s",
        ],
    ])("should handle (%s) Big numbers", (input, expected) => {
        expect.assertions(1);

        expect(duration(input, { units: ["y", "mo", "w", "d", "h", "m", "s"] as DurationUnitName[] })).toStrictEqual(expected);
    });

    it('should handle rounding with the "largest" option without truncating the largest units', () => {
        expect.assertions(6);

        const options = { largest: 2, round: true };

        expect(duration(739_160_000, options)).toBe("1 week, 2 days");
        expect(duration(739_160_000, options)).toBe("1 week, 2 days");
        expect(duration(7_199_000, options)).toBe("2 hours");
        expect(duration(7_199_000, { largest: 3, round: true })).toBe("1 hour, 59 minutes, 59 seconds");
        expect(duration(7_201_000, { largest: 1, round: true })).toBe("2 hours");
        expect(duration(7_201_000, { largest: 3, round: true })).toBe("2 hours, 1 second");
    });

    it("does not throw when passing Infinity", () => {
        expect.assertions(3);

        const options = { units: ["y", "mo", "w", "d", "h", "m", "s"] as DurationUnitName[] };

        expect(duration(Number.POSITIVE_INFINITY, { maxDecimalPoints: 2, ...options })).toBe("Infinity years");
        expect(duration(Number.NEGATIVE_INFINITY, { maxDecimalPoints: 2, ...options })).toBe("Infinity years");

        expect(duration(Number.POSITIVE_INFINITY, { maxDecimalPoints: 2, units: ["h", "m"] })).toBe("Infinity hours");
    });

    it('can return floating point result with the "maxDecimalPoint" and the "largest" options', () => {
        expect.assertions(11);

        expect(duration(8123.456_789, { largest: 1, maxDecimalPoints: 1, round: false })).toBe("8.1 seconds");
        expect(duration(80_000, { largest: 1, maxDecimalPoints: 1, round: false })).toBe("1.3 minutes");
        expect(duration(450_000, { largest: 1, maxDecimalPoints: 1, round: false })).toBe("7.5 minutes");
        expect(duration(540_360_012, { largest: 2, maxDecimalPoints: 1, round: false })).toBe("6 days, 6.1 hours");

        expect(duration(8123.456_789, { largest: 1, maxDecimalPoints: 2, round: false })).toBe("8.12 seconds");
        expect(duration(80_000, { largest: 1, maxDecimalPoints: 2, round: false })).toBe("1.33 minutes");
        expect(duration(450_000, { largest: 1, maxDecimalPoints: 2, round: false })).toBe("7.5 minutes");
        expect(duration(540_360_012, { largest: 2, maxDecimalPoints: 2, round: false })).toBe("6 days, 6.1 hours");

        const options = { units: ["y", "mo", "w", "d", "h", "m", "s"] as DurationUnitName[] };

        expect(duration(3_692_131_038_000, { largest: 6, maxDecimalPoints: 2, round: false, ...options })).toBe(
            "116 years, 11 months, 4 weeks, 2 days, 1 hour, 30 minutes",
        );
        expect(duration(3_692_131_200_001, { largest: 6, maxDecimalPoints: 0, round: false, ...options })).toBe(
            "116 years, 11 months, 4 weeks, 2 days, 1 hour, 32 minutes",
        );
        expect(duration(3_692_131_200_001, { largest: 6, maxDecimalPoints: 7, round: false, ...options })).toBe(
            "116 years, 11 months, 4 weeks, 2 days, 1 hour, 32.7000166 minutes",
        );
    });

    it('can return floating point result with the "maxDecimalPoint", "largest" and "units" options', () => {
        expect.assertions(3);

        const options = { maxDecimalPoints: 1, round: false, units: ["h", "m"] as DurationUnitName[] };

        expect(duration(5_400_000, { largest: 1, ...options })).toBe("1.5 hours");
        expect(duration(5_400_001, { largest: 1, ...options })).toBe("1.5 hours");
        expect(duration(5_400_001, { largest: 2, ...options })).toBe("1 hour, 30 minutes");
    });
});
