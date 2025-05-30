import { describe, expect, it } from "vitest";

import { BEL, OSC, SEP } from "../../src/constants";
import hyperlink from "../../src/hyperlink";

describe("link", () => {
    it("should create a basic hyperlink", () => {
        expect.assertions(1);

        const text = "Example";
        const url = "https://example.com";
        const expected = `${OSC}8${SEP}${SEP}${url}${BEL}${text}${OSC}8${SEP}${SEP}${BEL}`;

        expect(hyperlink(text, url)).toBe(expected);
    });

    it("should handle empty text", () => {
        expect.assertions(1);

        const text = "";
        const url = "https://example.com";
        const expected = `${OSC}8${SEP}${SEP}${url}${BEL}${text}${OSC}8${SEP}${SEP}${BEL}`;

        expect(hyperlink(text, url)).toBe(expected);
    });

    it("should handle empty URL", () => {
        expect.assertions(1);

        const text = "Example";
        const url = "";
        const expected = `${OSC}8${SEP}${SEP}${url}${BEL}${text}${OSC}8${SEP}${SEP}${BEL}`;

        expect(hyperlink(text, url)).toBe(expected);
    });

    it("should handle special characters in text", () => {
        expect.assertions(1);

        const text = "Example with !@#$%^&*()_+";
        const url = "https://example.com";
        const expected = `${OSC}8${SEP}${SEP}${url}${BEL}${text}${OSC}8${SEP}${SEP}${BEL}`;

        expect(hyperlink(text, url)).toBe(expected);
    });

    it("should handle special characters in URL (though the terminal might not like them if not encoded)", () => {
        expect.assertions(1);

        const text = "Example";
        const url = "https://example.com/path?query=value#fragment with spaces";
        const expected = `${OSC}8${SEP}${SEP}${url}${BEL}${text}${OSC}8${SEP}${SEP}${BEL}`;

        expect(hyperlink(text, url)).toBe(expected);
    });
});
