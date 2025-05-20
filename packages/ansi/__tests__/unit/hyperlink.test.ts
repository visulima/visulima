import { describe, expect,it } from "vitest";

import { BEL, OSC, SEP } from "../../src/constants";
import { hyperlink } from "../../src/hyperlink";

describe("link", () => {
    it("should create a basic hyperlink", () => {
        const text = "Example";
        const url = "https://example.com";
        const expected = `${OSC}8${SEP}${SEP}${url}${BEL}${text}${OSC}8${SEP}${SEP}${BEL}`;
        expect(hyperlink(text, url)).toBe(expected);
    });

    it("should handle empty text", () => {
        const text = "";
        const url = "https://example.com";
        const expected = `${OSC}8${SEP}${SEP}${url}${BEL}${text}${OSC}8${SEP}${SEP}${BEL}`;
        expect(hyperlink(text, url)).toBe(expected);
    });

    it("should handle empty URL", () => {
        const text = "Example";
        const url = "";
        const expected = `${OSC}8${SEP}${SEP}${url}${BEL}${text}${OSC}8${SEP}${SEP}${BEL}`;
        expect(hyperlink(text, url)).toBe(expected);
    });

    it("should handle special characters in text", () => {
        const text = "Example with !@#$%^&*()_+";
        const url = "https://example.com";
        const expected = `${OSC}8${SEP}${SEP}${url}${BEL}${text}${OSC}8${SEP}${SEP}${BEL}`;
        expect(hyperlink(text, url)).toBe(expected);
    });

    it("should handle special characters in URL (though the terminal might not like them if not encoded)", () => {
        const text = "Example";
        const url = "https://example.com/path?query=value#fragment with spaces";
        const expected = `${OSC}8${SEP}${SEP}${url}${BEL}${text}${OSC}8${SEP}${SEP}${BEL}`;
        expect(hyperlink(text, url)).toBe(expected);
    });
});
