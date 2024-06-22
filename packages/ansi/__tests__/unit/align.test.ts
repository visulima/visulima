// eslint-disable-next-line import/no-extraneous-dependencies
import { bold, cyan, red } from "@visulima/colorize";
import { describe, expect, it } from "vitest";

import align from "../../src/align";

describe("align", () => {
    it("should align center, splits line feed, and pads with space by default", () => {
        expect.assertions(1);
        // one two three
        //   four five
        expect(align.center("one two three\nfour five")).toBe("one two three\n  four five");
    });

    it("should support ansi", () => {
        expect.assertions(1);

        // first line has four ansi escape sequences
        // second line has two ansi escape sequences
        const input = red("one") + " two " + bold("three") + "\n" + cyan("four ") + "five";

        expect(align.center(input)).toBe(red("one") + " two " + bold("three") + "\n  " + cyan("four ") + "five");
    });

    it("should accepts opts for split, pad", () => {
        expect.assertions(1);
        // ........one two
        // three four five
        const input = "one two\tthree four five";

        expect(align.right(input, { pad: ".", split: "\t" })).toBe("........one two\tthree four five");
    });

    it("should align multiline text to the center", () => {
        expect.assertions(1);

        //    one
        //    two
        // three four
        //    five
        expect(align.center(" one \n two \n three four \n five ")).toBe( "    one \n    two \n three four \n    five ");
    });

    it("should align multiline text to the right", () => {
        expect.assertions(1);

        //       one
        // two three
        //      four
        //      five
        expect(align.right("one\ntwo three\nfour\nfive")).toBe( "      one\ntwo three\n     four\n     five");
    });
});
