import { describe, expect, it } from "vitest";

import { convertHexToRgb } from "../../src/util/convert-hex-to-rgb";
import { ansi256To16, rgbToAnsi16, rgbToAnsi256 } from "../../src/util/convert-rgb-to-ansi";

describe("convert RGB to ANSI 256", () => {
    it(`rgbToAnsi256(7, 7, 7) lowest greyscale`, () => {
        expect.assertions(1);

        const received = rgbToAnsi256(7, 7, 7);
        const expected = 16;

        expect(received).toStrictEqual(expected);
    });

    it(`rgbToAnsi256(249, 249, 249) highest greyscale`, () => {
        expect.assertions(1);

        const received = rgbToAnsi256(249, 249, 249);
        const expected = 231;

        expect(received).toStrictEqual(expected);
    });

    it(`rgbToAnsi256(127, 127, 127) greyscale`, () => {
        expect.assertions(1);

        const received = rgbToAnsi256(127, 127, 127);
        const expected = 244;

        expect(received).toStrictEqual(expected);
    });

    it(`rgbToAnsi256(16, 16, 16) greyscale`, () => {
        expect.assertions(1);

        const received = rgbToAnsi256(15, 15, 15);
        const expected = 233;

        expect(received).toStrictEqual(expected);
    });

    it(`rgbToAnsi256(127, 63, 63) color`, () => {
        expect.assertions(1);

        const received = rgbToAnsi256(200, 16, 16);
        const expected = 160;

        expect(received).toStrictEqual(expected);
    });
});

describe("convert ANSI 256 to ANSI 16", () => {
    it(`black`, () => {
        expect.assertions(1);

        const received = ansi256To16(0);
        const expected = 30;

        expect(received).toStrictEqual(expected);
    });

    it(`white`, () => {
        expect.assertions(1);

        const received = ansi256To16(7);
        const expected = 37;

        expect(received).toStrictEqual(expected);
    });

    it(`whiteBright`, () => {
        expect.assertions(1);

        const received = ansi256To16(15);
        const expected = 97;

        expect(received).toStrictEqual(expected);
    });

    it(`ansi256To16(232) -> black`, () => {
        expect.assertions(1);

        const received = ansi256To16(233);
        const expected = 30;

        expect(received).toStrictEqual(expected);
    });

    it(`redBright`, () => {
        expect.assertions(1);

        const received = ansi256To16(196);
        const expected = 91;

        expect(received).toStrictEqual(expected);
    });

    it(`red`, () => {
        expect.assertions(1);

        const received = ansi256To16(124);
        const expected = 31;

        expect(received).toStrictEqual(expected);
    });

    it(`blue`, () => {
        expect.assertions(1);

        const received = ansi256To16(20);
        const expected = 34;

        expect(received).toStrictEqual(expected);
    });

    it(`blueBright`, () => {
        expect.assertions(1);

        const received = ansi256To16(27);
        const expected = 94;

        expect(received).toStrictEqual(expected);
    });

    it(`green`, () => {
        expect.assertions(1);

        const received = ansi256To16(34);
        const expected = 32;

        expect(received).toStrictEqual(expected);
    });

    it(`greenBright`, () => {
        expect.assertions(1);

        const received = ansi256To16(82);
        const expected = 92;

        expect(received).toStrictEqual(expected);
    });
});

describe("convert RGB to ANSI 16", () => {
    it(`redBright`, () => {
        expect.assertions(1);

        const received = rgbToAnsi16(...convertHexToRgb("#ff6e67"));
        const expected = 91;

        expect(received).toStrictEqual(expected);
    });

    it(`red`, () => {
        expect.assertions(1);

        const received = rgbToAnsi16(...convertHexToRgb("#c91b00"));
        const expected = 31;

        expect(received).toStrictEqual(expected);
    });

    it(`blue`, () => {
        expect.assertions(1);

        const received = rgbToAnsi16(...convertHexToRgb("#0225c7"));
        const expected = 34;

        expect(received).toStrictEqual(expected);
    });

    it(`blueBright`, () => {
        expect.assertions(1);

        const received = rgbToAnsi16(...convertHexToRgb("#6871ff"));
        const expected = 94;

        expect(received).toStrictEqual(expected);
    });

    it(`green`, () => {
        expect.assertions(1);

        const received = rgbToAnsi16(...convertHexToRgb("#00c200"));
        const expected = 32;

        expect(received).toStrictEqual(expected);
    });

    it(`greenBright`, () => {
        expect.assertions(1);

        const received = rgbToAnsi16(...convertHexToRgb("#5ffa68"));
        const expected = 92;

        expect(received).toStrictEqual(expected);
    });
});
