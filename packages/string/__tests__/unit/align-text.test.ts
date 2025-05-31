import { bold, cyan, green, red } from "@visulima/colorize";
import { describe, expect, it } from "vitest";

import { alignText } from "../../src/align-text";

describe(alignText, () => {
    it("aligns center, splits line feed, and pads with space by default", () => {
        expect.assertions(1);
        // one two three
        //   four five
        const out = alignText("one two three\nfour five");

        expect(out).toBe("one two three\n  four five");
    });

    it("supports ansi", () => {
        expect.assertions(1);
        // first line has four ansi escape sequences
        // second line has two ansi escape sequences
        const inp = `${red("one")} two ${bold("three")}\n${cyan("four ")}five`;
        const out = alignText(inp);

        expect(out).toBe(`${red("one")} two ${bold("three")}\n  ${cyan("four ")}five`);
    });

    it("returns array if given array", () => {
        expect.assertions(1);
        //     one two
        // three four five
        const inp = [green("one two"), "three four five"];
        const out = alignText(inp);

        expect(out).toStrictEqual([`    ${green("one two")}`, "three four five"]);
    });

    it("accepts opts for split, pad, and align", () => {
        expect.assertions(1);
        // ........one two
        // three four five
        const inp = "one two\tthree four five";
        const out = alignText(inp, { align: "right", pad: ".", split: "\t" });

        expect(out).toBe("........one two\tthree four five");
    });

    it("should supports `align: 'left'` as no-op", () => {
        expect.assertions(1);
        const inp = "one two three\nfour five";
        const out = alignText(inp, { align: "left" });

        expect(out).toBe(inp);
    });

    it("should center align", () => {
        expect.assertions(1);
        //    one
        //    two
        // three four
        //    five
        const inp = [" one ", " two ", " three four ", " five "];
        const out = alignText(inp, { align: "center" });

        expect(out).toStrictEqual(["    one ", "    two ", " three four ", "    five "]);
    });

    it("should support right align", () => {
        expect.assertions(1);
        //       one
        // two three
        //      four
        //      five
        const inp = "one\ntwo three\nfour\nfive";
        const out = alignText(inp, { align: "right" });

        expect(out).toBe("      one\ntwo three\n     four\n     five");
    });
});
