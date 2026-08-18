import { describe, expect, it } from "vitest";

import scan from "../src/scan";
import strip from "../src/strip";

const ESC = String.fromCodePoint(0x1B);
const BEL = String.fromCodePoint(0x07);
const ST = `${ESC}\\`;

const values = (input: string): string[] => [...scan(input)].map((token) => token.value);
const kinds = (input: string): string[] =>
    [...scan(input)].map((token) => {
        if (token.type === "sequence") {
            return token.kind;
        }

        return token.type;
    });

describe(scan, () => {
    it("returns a single text token for input with no sequences", () => {
        expect.assertions(1);

        expect([...scan("plain text")]).toStrictEqual([{ index: 0, type: "text", value: "plain text" }]);
    });

    it("yields nothing for an empty string", () => {
        expect.assertions(1);

        expect([...scan("")]).toStrictEqual([]);
    });

    it("splits text from an SGR sequence", () => {
        expect.assertions(2);

        expect(values(`${ESC}[31mred${ESC}[39m`)).toStrictEqual([`${ESC}[31m`, "red", `${ESC}[39m`]);
        expect(kinds(`${ESC}[31mred${ESC}[39m`)).toStrictEqual(["csi", "text", "csi"]);
    });

    it("reports the offset of every token", () => {
        expect.assertions(1);

        expect([...scan(`ab${ESC}[0mcd`)].map((token) => token.index)).toStrictEqual([0, 2, 6]);
    });

    it.each([
        ["osc terminated by BEL", `${ESC}]0;title${BEL}`, "osc"],
        ["osc terminated by ST", `${ESC}]0;title${ST}`, "osc"],
        ["dcs", `${ESC}Pq#0${ST}`, "dcs"],
        ["apc", `${ESC}_Gf=100${ST}`, "apc"],
        ["pm", `${ESC}^private${ST}`, "pm"],
        ["sos", `${ESC}Xstring${ST}`, "sos"],
        ["two-character escape", `${ESC}7`, "escape"],
    ])("classifies %s", (_name, input, kind) => {
        expect.assertions(2);

        expect(kinds(input)).toStrictEqual([kind]);
        expect(values(input)).toStrictEqual([input]);
    });

    it("keeps a non-ASCII OSC payload whole", () => {
        expect.assertions(1);

        // A regex over an ASCII allow-list splits this mid-payload and leaks the terminator.
        expect(values(`${ESC}]0;títlé ✳${BEL}after`)).toStrictEqual([`${ESC}]0;títlé ✳${BEL}`, "after"]);
    });

    it("recognises the 8-bit C1 introducers", () => {
        expect.assertions(2);

        expect(kinds(`31mred`)).toStrictEqual(["csi", "text"]);
        expect(kinds(`0;title${BEL}`)).toStrictEqual(["osc"]);
    });

    it("emits an unterminated sequence as a partial rather than dropping it", () => {
        expect.assertions(2);

        // A stream reader holds this back and prepends it to the next chunk.
        expect([...scan(`text${ESC}[31`)]).toStrictEqual([
            { index: 0, type: "text", value: "text" },
            { index: 4, type: "partial", value: `${ESC}[31` },
        ]);
        expect([...scan(`${ESC}]0;no terminator`)].map((token) => token.type)).toStrictEqual(["partial"]);
    });

    it("concatenating every token reproduces the input", () => {
        expect.assertions(1);

        const input = `a${ESC}[1mb${ESC}]8;;https://x.com${BEL}link${ESC}]8;;${BEL}c${ESC}7d0m`;

        expect(values(input).join("")).toBe(input);
    });

    it("agrees with strip about what is text", () => {
        expect.assertions(1);

        const input = `${ESC}[1mbold${ESC}[22m ${ESC}]0;t✳${BEL}tail${ESC}Pq${ST}`;
        const text = [...scan(input)]
            .filter((token) => token.type === "text")
            .map((token) => token.value)
            .join("");

        expect(text).toBe(strip(input));
    });

    it("is lazy — it does not tokenize past what the caller reads", () => {
        expect.assertions(1);

        const iterator = scan(`${ESC}[31m${"x".repeat(100_000)}`);

        expect(iterator.next().value).toStrictEqual({ index: 0, kind: "csi", type: "sequence", value: `${ESC}[31m` });
    });
});
