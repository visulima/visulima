import { stripVTControlCharacters } from "node:util";

import { blue, red } from "@visulima/colorize";
import { describe, expect, it } from "vitest";

import { toEqualAnsi } from "../../../src/test/vitest";

describe("ANSI string test utilities", () => {

    it("should work with the expect syntax", () => {
        expect.extend({ toEqualAnsi });
        expect(red("Test")).toEqualAnsi(red("Test"));
    });

    describe("toEqualAnsi custom matcher", () => {
        it("should pass when ANSI strings are identical", () => {
            const result = toEqualAnsi(red("Test"), red("Test"));
            expect(result.pass).toBeTruthy();
        });

        it("should fail when ANSI strings have different colors", () => {
            const result = toEqualAnsi(red("Test"), blue("Test"));
            expect(result.pass).toBeFalsy();
        });

        it("should fail when ANSI strings have different content", () => {
            const result = toEqualAnsi(red("Hello"), red("World"));
            expect(result.pass).toBeFalsy();
        });

        it("should provide detailed error message when strings differ", () => {
            const result = toEqualAnsi(red("Test"), blue("Test"));

            // Call the message function to get the error message
            const message = result.message();

            expect(message).toContain("ANSI string comparison failed");
            expect(message).toContain("Visible content is identical, but escape codes differ");
        });
    });
});
