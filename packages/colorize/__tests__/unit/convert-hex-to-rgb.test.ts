import { describe, expect, it } from "vitest";

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
});
