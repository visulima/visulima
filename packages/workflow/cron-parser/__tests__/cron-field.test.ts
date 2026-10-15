/* eslint-disable vitest/prefer-expect-assertions, vitest/prefer-strict-equal -- ported from the reference implementation's suite; kept close to the original for easy comparison */
import { describe, expect, it } from "vitest";

import type { DayOfWeekRange, SixtyRange } from "../src";
import { CronDayOfWeek, CronField, CronHour, CronMinute, CronSecond } from "../src";

describe(CronField, () => {
    describe("wildcard detection", () => {
        it("should detect wildcard based on input values", () => {
            const secondField = new CronSecond([0, 1, 2, 3, 4, 5, 6, 7]);

            expect(secondField.isWildcard).toBe(false);

            const dayOfWeekField = new CronDayOfWeek([0, 1, 2, 3, 4, 5, 6, 7]);

            expect(dayOfWeekField.isWildcard).toBe(true);
        });

        it("should detect wildcard based options override", () => {
            const dayOfWeekField = new CronDayOfWeek([0, 1, 2, 3, 4, 5, 6], { rawValue: "", wildcard: true });

            expect(dayOfWeekField.isWildcard).toBe(true);
        });
    });

    describe("validate", () => {
        it("should throw error when values is not an array", () => {
            expect(() => new CronSecond(0 as never)).toThrow("CronSecond Validation error, values is not an array");
        });

        it("should throw error when values contains no values", () => {
            expect(() => new CronSecond([])).toThrow("CronSecond Validation error, values contains no values");
        });

        it("should throw an error when input value is out of the defined range", () => {
            expect(() => new CronSecond([0, 100] as SixtyRange[])).toThrow("CronSecond Validation error, got value 100 expected range 0-59");
        });

        it("should throw an error when duplicate value is provided as a range", () => {
            expect(() => new CronSecond([0, 59, 59])).toThrow("CronSecond Validation error, duplicate values found: 59");
        });

        it("should throw an error when the duplicated value is zero", () => {
            expect(() => new CronSecond([0, 0])).toThrow("CronSecond Validation error, duplicate values found: 0");
            expect(() => new CronMinute([0, 0])).toThrow("CronMinute Validation error, duplicate values found: 0");
            expect(() => new CronHour([0, 0])).toThrow("CronHour Validation error, duplicate values found: 0");
            expect(() => new CronDayOfWeek([0, 0])).toThrow("CronDayOfWeek Validation error, duplicate values found: 0");
        });

        it("should not throw an error when a non-duplicate set contains zero", () => {
            expect(() => new CronSecond([0, 1])).not.toThrow();
            expect(() => new CronMinute([0, 30])).not.toThrow();
            expect(new CronDayOfWeek([0, 7]).values).toEqual([0, 7]);
        });

        it("should not reorder the values array provided by the caller", () => {
            const values: SixtyRange[] = [30, 10, 20];

            // eslint-disable-next-line no-new, sonarjs/constructor-for-side-effects
            new CronSecond(values);

            expect(values).toEqual([30, 10, 20]);
        });

        it("should not keep a reference to the values array provided by the caller", () => {
            const values: SixtyRange[] = [10, 20];
            const field = new CronSecond(values);

            values.push(30);

            expect(field.values).toEqual([10, 20]);
        });

        it("should throw an error when day of week is a standalone L", () => {
            expect(() => new CronDayOfWeek(["L"])).toThrow("CronDayOfWeek Validation error, unexpected standalone L");
        });

        it("should throw an error when day of week contains a standalone L in a list", () => {
            expect(() => new CronDayOfWeek([1, "L"])).toThrow("CronDayOfWeek Validation error, unexpected standalone L");
        });

        it("should accept a day of week L qualified by a weekday", () => {
            const values: (number | string)[] = ["5L"];
            const field = new CronDayOfWeek(values as DayOfWeekRange[]);

            expect(field.values).toEqual(["5L"]);
        });
    });

    describe("findNearestValueInList", () => {
        it("returns the next greater value when reverse=false", () => {
            expect(CronField.findNearestValueInList([1, 2, 3], 1, false)).toBe(2);
            expect(CronField.findNearestValueInList([1, 2, 3], 2, false)).toBe(3);
        });

        it("returns null when there is no next greater value (reverse=false)", () => {
            expect(CronField.findNearestValueInList([1, 2, 3], 3, false)).toBeNull();
            expect(CronField.findNearestValueInList([], 3, false)).toBeNull();
        });

        it("returns the previous smaller value when reverse=true", () => {
            expect(CronField.findNearestValueInList([1, 2, 3], 3, true)).toBe(2);
            expect(CronField.findNearestValueInList([1, 2, 3], 2, true)).toBe(1);
        });

        it("returns null when there is no previous smaller value (reverse=true)", () => {
            expect(CronField.findNearestValueInList([1, 2, 3], 1, true)).toBeNull();
            expect(CronField.findNearestValueInList([], 1, true)).toBeNull();
        });
    });
});
