import { stripVTControlCharacters as nodeStripVTControlCharacters } from "node:util";

import { describe, expect, it } from "vitest";

import { flipCase } from "../../src/case/flip-case";
import { splitByCase } from "../../src/case/split-by-case";
import { getStringWidth } from "../../src/get-string-width";
import { formatAnsiString } from "../../src/test/utils";
import { toEqualAnsi } from "../../src/test/vitest";
import stripVTControlCharacters from "../../src/utils/strip-vt-control-characters";

const ESC = "\u001B";
const BEL = "\u0007";
const CSI_8_BIT = "\u009B";

/**
 * A spread of VT sequences: SGR, 256/true colour, cursor movement, screen
 * clearing, private modes, OSC 8 hyperlinks with both BEL and ST terminators,
 * 8-bit CSI, and truncated/garbage sequences.
 */
const VT_CORPUS: string[] = [
    "plain text",
    "",
    `${ESC}[31mRedText${ESC}[0m`,
    `${ESC}[1mBoldText${ESC}[0m`,
    `${ESC}[32mGreenFOO${ESC}[0m_${ESC}[34mBlueBAR${ESC}[0m`,
    `${ESC}[38;2;255;0;0mtruecolor${ESC}[39m`,
    `${ESC}[38;5;196m256color${ESC}[39m`,
    `${ESC}[38;5;9m${ESC}[48;5;10mboth${ESC}[0m`,
    `${ESC}]8;;https://example.com${BEL}link${ESC}]8;;${BEL}`,
    `${ESC}]8;;https://example.com${ESC}\\link${ESC}]8;;${ESC}\\`,
    `${ESC}]0;window title${BEL}`,
    `${ESC}[2J${ESC}[H cleared`,
    `${ESC}[?25lhidden${ESC}[?25h`,
    `${ESC}[1A${ESC}[2Kup`,
    `${ESC}[s saved ${ESC}[u restored`,
    `${ESC}[10;20H`,
    `${ESC}[6n`,
    `${ESC}(Bcharset`,
    `${CSI_8_BIT}31mCSI-8bit${CSI_8_BIT}0m`,
    `${ESC}[31m`,
    `${ESC}[`,
    ESC,
    `caf${ESC}[31mé${ESC}[39m`,
    `${ESC}[31m👋${ESC}[39m`,
];

describe("node:util compatibility", () => {
    it("should resolve node:util under the workers nodejs_compat layer", () => {
        expect.assertions(2);

        expect(nodeStripVTControlCharacters).toBeTypeOf("function");
        expect(nodeStripVTControlCharacters(`${ESC}[31mfoo${ESC}[39m`)).toBe("foo");
    });

    it("should strip identically to node:util without importing it", () => {
        expect.assertions(24);

        for (const value of VT_CORPUS) {
            expect(stripVTControlCharacters(value)).toBe(nodeStripVTControlCharacters(value));
        }
    });

    it("should reject non-string input like the node builtin does", () => {
        expect.assertions(2);

        // @ts-expect-error -- deliberately violating the signature
        expect(() => stripVTControlCharacters(undefined)).toThrow(TypeError);
        // @ts-expect-error -- deliberately violating the signature
        expect(() => stripVTControlCharacters(42)).toThrow(TypeError);
    });

    it("should keep the stripAnsi option working for the case helpers", () => {
        expect.assertions(4);

        expect(flipCase(`${ESC}[31mRedText${ESC}[0m`, { stripAnsi: true })).toBe("rEDtEXT");
        expect(splitByCase(`${ESC}[31mRedText${ESC}[0m`, { stripAnsi: true })).toStrictEqual(["Red", "Text"]);
        expect(splitByCase(`${ESC}[32mGreenFOO${ESC}[0m_${ESC}[34mBlueBAR${ESC}[0m`, { stripAnsi: true })).toStrictEqual(["Green", "FOO", "Blue", "BAR"]);
        expect(flipCase(`${ESC}]8;;https://example.com${BEL}Link${ESC}]8;;${BEL}`, { stripAnsi: true })).toBe("lINK");
    });

    it("should expose the shipped test helpers without a node runtime", () => {
        expect.assertions(4);

        const formatted = formatAnsiString(`${ESC}[31mHello${ESC}[39m`);

        expect(formatted.stripped).toBe("Hello");
        expect(formatted.lengthDifference).toBeGreaterThan(0);
        expect(formatted.visible).toContain(String.raw`\u001B`);
        expect(toEqualAnsi(`${ESC}[31mHello${ESC}[39m`, `${ESC}[31mHello${ESC}[39m`).pass).toBe(true);
    });

    it("should render a detailed matcher message without node:util's format", () => {
        expect.assertions(3);

        const result = toEqualAnsi(`${ESC}[31mHello${ESC}[39m`, `${ESC}[34mHello${ESC}[39m`);

        expect(result.pass).toBe(false);
        expect(result.message()).toContain("ANSI string comparison failed");
        expect(result.message()).toContain("Visible content is identical, but escape codes differ");
    });
});

describe("pure-javascript width path", () => {
    it("should compute widths without any native addon", () => {
        expect.assertions(4);

        // `@visulima/string` ships no native binding: the east-asian-width and
        // emoji tables it relies on are plain JS data, so the same widths must
        // come out on a runtime that cannot load `.node` addons at all.
        expect(getStringWidth("古池や")).toBe(6);
        expect(getStringWidth("abcde")).toBe(5);
        expect(getStringWidth("👩‍👩‍👧‍👦")).toBe(2);
        expect(getStringWidth(`${ESC}[31mred${ESC}[39m`)).toBe(3);
    });

    it("should agree with Intl.Segmenter on grapheme boundaries", () => {
        expect.assertions(3);

        const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
        const segments = [...segmenter.segment("👩‍👩‍👧‍👦é🇩🇪")].map((segment) => segment.segment);

        expect(segments).toStrictEqual(["👩‍👩‍👧‍👦", "é", "🇩🇪"]);
        expect(getStringWidth("é")).toBe(1);
        expect(getStringWidth("🇩🇪")).toBe(2);
    });
});

describe("intl surface", () => {
    it("should provide the Intl constructors the case helpers rely on", () => {
        expect.assertions(4);

        expect(Intl.Collator).toBeTypeOf("function");
        expect(Intl.Segmenter).toBeTypeOf("function");
        expect(Intl.PluralRules).toBeTypeOf("function");
        expect(Intl.DisplayNames).toBeTypeOf("function");
    });

    it("should carry the ICU data required for locale-sensitive casing", () => {
        expect.assertions(4);

        // A trimmed-down ICU build silently falls back to root-locale casing,
        // which would make `{ locale: "tr" }` a no-op instead of an error.
        expect("i".toLocaleUpperCase("tr")).toBe("İ");
        expect("I".toLocaleLowerCase("tr")).toBe("ı");
        expect("i".toLocaleUpperCase("az")).toBe("İ");
        expect("ά".toLocaleUpperCase("el")).toBe("Α");
    });

    it("should collate with locale-specific rules", () => {
        expect.assertions(2);

        // German sorts "ä" next to "a"; Swedish sorts it after "z".
        expect(new Intl.Collator("de").compare("ä", "z")).toBe(-1);
        expect(new Intl.Collator("sv").compare("ä", "z")).toBe(1);
    });
});
