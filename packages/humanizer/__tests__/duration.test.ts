import { describe, it, expect } from "vitest";
import ms from "ms";

import duration from "../src/duration";
import { durationLanguage as trDurationLanguage } from "../src/language/tr";
import { DurationDigitReplacements, DurationLanguage, DurationUnitName } from "../src/types";

describe("duration", () => {
    it("should throw a error on invalid input", () => {
        expect.assertions(3);

        // @ts-expect-error - Testing invalid input
        expect(() => duration("foo")).toThrow(TypeError);
        expect(() => duration(Number.NaN)).toThrow(TypeError);
        expect(() => duration(Number.POSITIVE_INFINITY)).toThrow(TypeError);
    });

    it("should humanizes English when passed no arguments", () => {
        expect(duration(1000)).toStrictEqual("1 second");
    });

    it("should humanizes English when passed an empty object", () => {
        expect(duration(1000, {})).toStrictEqual("1 second");
    });

    it("should change the delimiter", () => {
        const options = { delimiter: "+" };

        expect(duration(0, options)).toStrictEqual("0 seconds");
        expect(duration(1000, options)).toStrictEqual("1 second");
        expect(duration(363000, options)).toStrictEqual("6 minutes+3 seconds");
    });

    it("should change the spacer", () => {
        const options = { spacer: " whole " };

        expect(duration(0, options)).toStrictEqual("0 whole seconds");
        expect(duration(1000, options)).toStrictEqual("1 whole second");
        expect(duration(260040000, options)).toStrictEqual("3 whole days, 14 whole minutes");
    });

    it("should use a conjunction", () => {
        const options = { conjunction: " and " };

        expect(duration(0, options)).toStrictEqual("0 seconds");
        expect(duration(1000, options)).toStrictEqual("1 second");
        expect(duration(260040000, options)).toStrictEqual("3 days and 14 minutes");
        expect(duration(10874000, options)).toStrictEqual("3 hours, 1 minute, and 14 seconds");
    });

    it("should use a conjunction without a serial comma", () => {
        const options = {
            conjunction: " & ",
            serialComma: false,
        };

        expect(duration(1000, options)).toStrictEqual("1 second");
        expect(duration(260040000, options)).toStrictEqual("3 days & 14 minutes");
        expect(duration(10874000, options)).toStrictEqual("3 hours, 1 minute & 14 seconds");
    });

    it("should change the units", () => {
        const options = { units: ["d"] as DurationUnitName[] };

        expect(duration(0, options)).toStrictEqual("0 days");
        expect(duration(ms("6h"), options)).toStrictEqual("0.25 days");
        expect(duration(ms("7d"), options)).toStrictEqual("7 days");
    });

    it("should overwrite the unit measures in the initializer", () => {
        const options = {
            unitMeasures: {
                y: 10512000000,
                mo: 864000000,
                w: 144000000,
                d: 28800000,
                h: 3600000,
                m: 60000,
                s: 1000,
                ms: 1,
            },
        };

        expect(duration(1000, options)).toStrictEqual("1 second");
        expect(duration(3600000, options)).toStrictEqual("1 hour");
        expect(duration(28800000, options)).toStrictEqual("1 day");
        expect(duration(144000000, options)).toStrictEqual("1 week");
    });

    it("should change the decimal", () => {
        const options = {
            units: ["s"] as DurationUnitName[],
            decimal: "what",
        };

        expect(duration(1234, options)).toStrictEqual("1what234 seconds");
        expect(
            duration(1234, {
                decimal: "!!",
            }),
            "1!!234 seconds",
        );
    });

    it("should do simple rounding", () => {
        const options = { round: true };

        expect(duration(0, options)).toStrictEqual("0 seconds");
        expect(duration(499, options)).toStrictEqual("0 seconds");
        expect(duration(500, options)).toStrictEqual("1 second");
        expect(duration(1000, options)).toStrictEqual("1 second");
        expect(duration(1499, options)).toStrictEqual("1 second");
        expect(duration(1500, options)).toStrictEqual("2 seconds");
        expect(duration(1500, options)).toStrictEqual("2 seconds");
        expect(duration(121499, options)).toStrictEqual("2 minutes, 1 second");
        expect(duration(121500, options)).toStrictEqual("2 minutes, 2 seconds");
    });

    it('should do rounding with the "units" option', () => {
        expect(duration(86364000, { units: ["y", "mo", "w", "d", "h"], round: true })).toStrictEqual("1 day");
        expect(duration(1209564000, { units: ["y", "mo", "w", "d", "h"], round: true })).toStrictEqual("2 weeks");
        expect(duration(3692131200000, { units: ["y", "mo"], round: true })).toStrictEqual("117 years");
        expect(duration(3692131200001, { units: ["y", "mo", "w", "d", "h", "m"], round: true })).toStrictEqual(
            "116 years, 11 months, 4 weeks, 1 day, 4 hours, 30 minutes",
        );
    });

    it('should do rounding with the "largest" option', () => {
        expect(duration(3692131200000, { largest: 1, round: true })).toStrictEqual("117 years");
        expect(duration(3692131200000, { largest: 2, round: true })).toStrictEqual("117 years");
        expect(duration(3692131200001, { largest: 100, round: true })).toStrictEqual("116 years, 11 months, 4 weeks, 1 day, 4 hours, 30 minutes");
        expect(duration(2838550, { largest: 3, round: true })).toStrictEqual("47 minutes, 19 seconds");
    });

    it('should do rounding with the "maxDecimalPoints" option', () => {
        expect(duration(8123.456789, { maxDecimalPoints: 2 })).toStrictEqual("8.12 seconds");
        expect(duration(8123.456789, { maxDecimalPoints: 3 })).toStrictEqual("8.123 seconds");
        expect(duration(8000, { maxDecimalPoints: 3 })).toStrictEqual("8 seconds");
        expect(duration(8123.45, { maxDecimalPoints: 6 })).toStrictEqual("8.12345 seconds");
        expect(duration(8000, { maxDecimalPoints: 6 })).toStrictEqual("8 seconds");
        expect(duration(7123.456, { maxDecimalPoints: 0 })).toStrictEqual("7 seconds");
        expect(duration(7999, { maxDecimalPoints: 2 })).toStrictEqual("7.99 seconds");
        expect(duration(7999, { maxDecimalPoints: 3 })).toStrictEqual("7.999 seconds");
    });

    it("should ask for the largest units", () => {
        const options = { largest: 2 };

        expect(duration(0, options)).toStrictEqual("0 seconds");
        expect(duration(1000, options)).toStrictEqual("1 second");
        expect(duration(2000, options)).toStrictEqual("2 seconds");
        expect(duration(540360012, options)).toStrictEqual("6 days, 6 hours");
        expect(duration(540360012, { largest: 3 })).toStrictEqual("6 days, 6 hours, 6 minutes");
        expect(duration(540360012, { largest: 100 })).toStrictEqual("6 days, 6 hours, 6 minutes, 0.012 seconds");
    });

    it("should overwrite an existing language", () => {
        const language: DurationLanguage = {
            future: "",
            past: "",
            y: () => "y",
            mo: () => "mo",
            w: () => "w",
            d: () => "d",
            h: () => "h",
            m: () => "m",
            s: () => "s",
            ms: () => "ms",
            delimiter: "--",
        };

        expect(duration(1000, { language })).toStrictEqual("1 s");
        expect(duration(61000, { language })).toStrictEqual("1 m--1 s");

        expect(duration(61000, { delimiter: "&&", language })).toStrictEqual("1 m&&1 s");
    });

    it('should uses "." as a fallback for a missing decimal', () => {
        const options = {
            language: {
                y: () => "y",
                mo: () => "mo",
                w: () => "w",
                d: () => "d",
                h: () => "h",
                m: () => "m",
                s: () => "s",
                ms: () => "ms",
                future: "",
                past: "",
            },
        };

        expect(duration(71750, options)).toStrictEqual("1 m, 11.75 s");
        expect(duration(71750, { decimal: "!", ...options })).toStrictEqual("1 m, 11!75 s");
    });

    it("accepts negative durations using the option timeAdverb", () => {
        expect(duration(363000, { timeAdverb: true })).toStrictEqual("in 6 minutes, 3 seconds");
        expect(duration(-363000, { timeAdverb: true })).toStrictEqual("6 minutes, 3 seconds ago");
        expect(duration(-363000, { language: trDurationLanguage, timeAdverb: true })).toStrictEqual("6 dakika, 3 saniye önce");
    });

    it("should replace digits", () => {
        expect.assertions(1);

        const options = {
            digitReplacements: ["Zero", "One", "Two", "Three", "UNUSED", "UNUSED", "UNUSED", "UNUSED", "UNUSED", "UNUSED"] as DurationDigitReplacements,
        };

        expect(duration(123, options)).toStrictEqual("Zero.OneTwoThree seconds");
    });

    it.each([
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
    ])("should handle Big numbers", (input, expected) => {
        expect(duration(input)).toStrictEqual(expected);
    });
});
