import { afterEach, describe, expect, it, vi } from "vitest";

import { convertHexToRgb } from "../../src/util/convert-hex-to-rgb";

describe("convertHexToRgb tests", () => {
    it(`should transform hex 'FFAA99' to a valid rgb`, () => {
        expect.assertions(1);

        const received = convertHexToRgb("FFAA99");
        const expected = [255, 170, 153];

        expect(received).toStrictEqual(expected);
    });

    it(`should transform hex '#FFAA99' to a valid rgb`, () => {
        expect.assertions(1);

        const received = convertHexToRgb("#FFAA99");
        const expected = [255, 170, 153];

        expect(received).toStrictEqual(expected);
    });

    it(`should transform hex '#FA9' to a valid rgb`, () => {
        expect.assertions(1);

        const received = convertHexToRgb("#FA9");
        const expected = [255, 170, 153];

        expect(received).toStrictEqual(expected);
    });

    it(`should transform hex '#FF99' to a valid rgb`, () => {
        expect.assertions(1);

        const received = convertHexToRgb("#FF99");
        const expected = [0, 0, 0];

        expect(received).toStrictEqual(expected);
    });

    it(`should transform hex 'something' to a valid rgb`, () => {
        expect.assertions(1);

        const received = convertHexToRgb("something");
        const expected = [0, 0, 0];

        expect(received).toStrictEqual(expected);
    });

    describe("invalid input dev warning", () => {
        afterEach(() => {
            vi.restoreAllMocks();
        });

        it("should warn when the input is not a valid hex color", () => {
            expect.assertions(2);

            const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

            const received = convertHexToRgb("#GGG");

            expect(received).toStrictEqual([0, 0, 0]);
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid hex color"));
        });

        it("should not warn for a valid hex color", () => {
            expect.assertions(2);

            const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

            const received = convertHexToRgb("#96C");

            expect(received).toStrictEqual([153, 102, 204]);
            expect(warnSpy).not.toHaveBeenCalled();
        });
    });
});
