import { describe, expect, it } from "vitest";

import slice from "../src/slice";

describe(`slice`, () => {
    it(`should slice empty strings just fine`, () => {
        expect.assertions(1);

        expect(slice(``)).toStrictEqual({ slice: ``, visible: 0 });
    });

    it(`should slice regular strings just fine`, () => {
        expect.assertions(1);

        expect(slice(`foo`)).toStrictEqual({ slice: `foo`, visible: 3 });
    });

    it(`should slice strings with parameters just fine`, () => {
        expect.assertions(1);

        expect(slice(`foobar`, 1, 3)).toStrictEqual({ slice: `oo`, visible: 2 });
    });

    it(`shouldn't care if the slice goes beyond the string length`, () => {
        expect.assertions(1);

        expect(slice(`foobar`, 0, 100)).toStrictEqual({ slice: `foobar`, visible: 6 });
    });

    it(`should preserve escape codes preceding the slice`, () => {
        expect.assertions(1);

        expect(slice(`\u001B[3mfoobar`, 1)).toStrictEqual({ slice: `\u001B[3moobar`, visible: 5 });
    });

    it(`should preserve escape codes following the slice`, () => {
        expect.assertions(1);

        expect(slice(`foobar\u001B[3m`, 0, 5)).toStrictEqual({ slice: `fooba\u001B[3m`, visible: 5 });
    });

    it(`should preserve escape codes inside a slice`, () => {
        expect.assertions(1);

        expect(slice(`hello wo\u001B[3mrld f\u001B[6moo bar`, 1, 18)).toStrictEqual({ slice: `ello wo\u001B[3mrld f\u001B[6moo ba`, visible: 17 });
    });

    it(`should slice across hyperlinks`, () => {
        expect.assertions(2);

        expect(slice(`foo\u001B]8;;https://example.org\u001B\\bar\u001B]8;;\u001B\\baz`, 1, 8)).toStrictEqual({
            slice: `oo\u001B]8;;https://example.org\u001B\\bar\u001B]8;;\u001B\\ba`,
            visible: 7,
        });

        expect(slice(`foo\u001B]8;;https://example.org\u0007bar\u001B]8;;\u0007baz`, 1, 8)).toStrictEqual({
            slice: `oo\u001B]8;;https://example.org\u0007bar\u001B]8;;\u0007ba`,
            visible: 7,
        });
    });

    it(`should remove mode change escape codes`, () => {
        expect.assertions(1);

        expect(slice(`\u001B[?2004hfoo`, 0, 3)).toStrictEqual({ slice: `foo`, visible: 3 });
    });

    it(`should work with a variety of complexish cases`, () => {
        expect.assertions(1);

        expect(slice(`\u001B[93m➤\u001B[39m foo`, 0, 5)).toStrictEqual({ slice: `\u001B[93m➤\u001B[39m foo`, visible: 5 });
    });

    it("supports fullwidth characters", () => {
        expect.assertions(1);

        expect(slice("안녕하세", 0, 4)).toBe({
            slice: "안녕",
            visible: 4,
        });
    });
});
