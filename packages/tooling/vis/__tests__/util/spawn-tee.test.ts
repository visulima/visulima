import { describe, expect, it } from "vitest";

import { quoteWindowsArgument } from "../../src/util/spawn-tee";

describe(quoteWindowsArgument, () => {
    it("passes through a plain argument unchanged", () => {
        expect.assertions(2);

        expect(quoteWindowsArgument("install")).toBe("install");
        expect(quoteWindowsArgument("--prod")).toBe("--prod");
    });

    it("quotes an argument containing whitespace", () => {
        expect.assertions(1);

        expect(quoteWindowsArgument(String.raw`C:\Program Files\app`)).toBe(String.raw`"C:\Program Files\app"`);
    });

    it("neutralizes shell metacharacters so they cannot be interpreted by cmd.exe", () => {
        expect.assertions(1);

        // A repo-derived path like `app & calc` must not let `calc` run.
        const result = quoteWindowsArgument("app & calc");

        // Wrapped in quotes and the ampersand caret-escaped.
        expect(result).toBe(String.raw`"app ^& calc"`);
    });

    it("caret-escapes pipe, redirection and grouping characters", () => {
        expect.assertions(1);

        expect(quoteWindowsArgument("a|b>c<d(e)")).toBe(String.raw`"a^|b^>c^<d^(e^)"`);
    });

    it("escapes embedded double quotes", () => {
        expect.assertions(1);

        expect(quoteWindowsArgument(String.raw`a"b`)).toBe(String.raw`"a\"b"`);
    });

    it("quotes an empty string so it survives as a distinct empty argument", () => {
        expect.assertions(1);

        expect(quoteWindowsArgument("")).toBe(String.raw`""`);
    });
});
