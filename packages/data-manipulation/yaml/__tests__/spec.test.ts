import { describe, expect, it } from "vitest";

import { parse, parseAll } from "../src";

/**
 * Conformance-flavoured cases derived from the YAML 1.2 specification examples.
 * The intent is to cover the structural corners of the grammar rather than to
 * re-run the full public test suite.
 */
describe("yAML 1.2 spec examples", () => {
    it("2.1 sequence of scalars", () => {
        expect.assertions(1);

        expect(parse("- Mark McGwire\n- Sammy Sosa\n- Ken Griffey")).toStrictEqual(["Mark McGwire", "Sammy Sosa", "Ken Griffey"]);
    });

    it("2.2 mapping of scalars", () => {
        expect.assertions(1);

        expect(parse("hr:  65\navg: 0.278\nrbi: 147")).toStrictEqual({ avg: 0.278, hr: 65, rbi: 147 });
    });

    it("2.4 sequence of mappings", () => {
        expect.assertions(1);

        const source = ["-", "  name: Mark McGwire", "  hr:   65", "-", "  name: Sammy Sosa", "  hr:   63"].join("\n");

        expect(parse(source)).toStrictEqual([
            { hr: 65, name: "Mark McGwire" },
            { hr: 63, name: "Sammy Sosa" },
        ]);
    });

    it("2.6 mapping of mappings", () => {
        expect.assertions(1);

        const source = ["Mark McGwire: {hr: 65, avg: 0.278}", "Sammy Sosa: {", "    hr: 63,", "    avg: 0.288,", "  }"].join("\n");

        expect(parse(source)).toStrictEqual({
            "Mark McGwire": { avg: 0.278, hr: 65 },
            "Sammy Sosa": { avg: 0.288, hr: 63 },
        });
    });

    it("2.8 play by play feed (multi-doc with markers)", () => {
        expect.assertions(1);

        const source = [
            "---",
            "time: 20:03:20",
            "player: Sammy Sosa",
            "action: strike (miss)",
            "...",
            "---",
            "time: 20:03:47",
            "player: Sammy Sosa",
            "action: grand slam",
            "...",
        ].join("\n");

        expect(parseAll(source)).toStrictEqual([
            { action: "strike (miss)", player: "Sammy Sosa", time: "20:03:20" },
            { action: "grand slam", player: "Sammy Sosa", time: "20:03:47" },
        ]);
    });

    it("2.13 literal scalar preserves newlines", () => {
        expect.assertions(1);

        const source = ["--- |", String.raw`  \//||\/||`, "  // ||  ||__"].join("\n");

        expect(parse(source)).toBe("\\//||\\/||\n// ||  ||__\n");
    });

    it("2.14 folded scalar joins lines with spaces", () => {
        expect.assertions(1);

        const source = ["--- >", "  Mark McGwire's", "  year was crippled", "  by a knee injury."].join("\n");

        expect(parse(source)).toBe("Mark McGwire's year was crippled by a knee injury.\n");
    });

    it("2.15 folded scalar with blank lines and more-indented block", () => {
        expect.assertions(1);

        const source = [
            ">",
            " Sammy Sosa completed another",
            " fine season with great stats.",
            "",
            "   63 Home Runs",
            "   0.288 Batting Average",
            "",
            " What a year!",
        ].join("\n");

        expect(parse(source)).toBe("Sammy Sosa completed another fine season with great stats.\n\n  63 Home Runs\n  0.288 Batting Average\n\nWhat a year!\n");
    });

    it("2.16 indentation determines scope", () => {
        expect.assertions(1);

        const source = [
            "name: Mark McGwire",
            "accomplishment: >",
            "  Mark set a major league",
            "  home run record in 1998.",
            "stats: |",
            "  65 Home Runs",
            "  0.278 Batting Average",
        ].join("\n");

        expect(parse(source)).toStrictEqual({
            accomplishment: "Mark set a major league home run record in 1998.\n",
            name: "Mark McGwire",
            stats: "65 Home Runs\n0.278 Batting Average\n",
        });
    });

    it("2.17 quoted scalars", () => {
        expect.assertions(1);

        const source = [
            String.raw`unicode: "Sosa did fine.\u263A"`,
            String.raw`control: "\b1998\t1999\t2000\n"`,
            String.raw`hex esc: "\x0d\x0a is \r\n"`,
            "single: '\"Howdy!\" he cried.'",
            "quoted: ' # Not a ''comment''.'",
            String.raw`tie-fighter: '|\-*-/|'`,
        ].join("\n");

        expect(parse(source)).toStrictEqual({
            control: "\b1998\t1999\t2000\n",
            "hex esc": "\r\n is \r\n",
            quoted: " # Not a 'comment'.",
            single: `"Howdy!" he cried.`,
            "tie-fighter": String.raw`|\-*-/|`,
            unicode: "Sosa did fine.☺",
        });
    });

    it("2.19 integers and floats", () => {
        expect.assertions(1);

        const source = ["canonical: 12345", "decimal: +12345", "octal: 0o14", "hexadecimal: 0xC"].join("\n");

        expect(parse(source)).toStrictEqual({ canonical: 12_345, decimal: 12_345, hexadecimal: 12, octal: 12 });
    });

    it("2.23 anchors and references across a document", () => {
        expect.assertions(1);

        const source = ["---", "hr:", "  - Mark McGwire", "  - &SS Sammy Sosa", "rbi:", "  - *SS", "  - Ken Griffey"].join("\n");

        const result = parse(source) as { hr: string[]; rbi: string[] };

        expect(result).toStrictEqual({
            hr: ["Mark McGwire", "Sammy Sosa"],
            rbi: ["Sammy Sosa", "Ken Griffey"],
        });
    });
});
