import { describe, expect, it } from "vitest";

import type { ESBuildMessage } from "../../../src/utils/esbuild-error";
import { isESBuildErrorArray, processESBuildErrors } from "../../../src/utils/esbuild-error";

describe(isESBuildErrorArray, () => {
    it("returns false for a non-array value", () => {
        expect.assertions(1);

        expect(isESBuildErrorArray("not-an-array" as unknown as unknown[])).toBe(false);
    });

    it("returns false for an empty array", () => {
        expect.assertions(1);

        expect(isESBuildErrorArray([])).toBe(false);
    });

    it("returns false when no entry carries an esbuild-shaped property", () => {
        expect.assertions(1);

        expect(isESBuildErrorArray([{ foo: 1 }, 42, null])).toBe(false);
    });

    it("returns true when an entry has a location property", () => {
        expect.assertions(1);

        expect(isESBuildErrorArray([{ location: { file: "a.ts" } }])).toBe(true);
    });

    it("returns true when an entry has a text property", () => {
        expect.assertions(1);

        expect(isESBuildErrorArray([{ text: "boom" }])).toBe(true);
    });

    it("returns true when an entry has a pluginName property", () => {
        expect.assertions(1);

        expect(isESBuildErrorArray([{ pluginName: "vite:react" }])).toBe(true);
    });
});

describe(processESBuildErrors, () => {
    it("maps text into the message and copies location fields", () => {
        expect.assertions(1);

        const errors = [{ location: { column: 5, file: "/src/a.ts", line: 10 }, text: "boom" }] as unknown as ESBuildMessage[];

        const result = processESBuildErrors(errors);

        expect(result[0]).toStrictEqual({
            column: 5,
            file: "/src/a.ts",
            line: 10,
            message: "boom",
            name: "Error",
            stack: "",
        });
    });

    it("falls back to a numbered message when text is missing", () => {
        expect.assertions(2);

        const errors = [{}, {}] as unknown as ESBuildMessage[];

        const result = processESBuildErrors(errors);

        expect(result[0]?.message).toBe("ESBuild error #1");
        expect(result[1]?.message).toBe("ESBuild error #2");
    });

    it("omits location fields when no location is present", () => {
        expect.assertions(3);

        const errors = [{ text: "no location" }] as unknown as ESBuildMessage[];

        const result = processESBuildErrors(errors);

        expect(result[0]).not.toHaveProperty("file");
        expect(result[0]).not.toHaveProperty("line");
        expect(result[0]).not.toHaveProperty("column");
    });

    it("includes the plugin name when pluginName is set", () => {
        expect.assertions(1);

        const errors = [{ pluginName: "vite:vue", text: "compile failed" }] as unknown as ESBuildMessage[];

        const result = processESBuildErrors(errors);

        expect(result[0]?.plugin).toBe("vite:vue");
    });

    it("preserves an existing name and stack", () => {
        expect.assertions(2);

        const errors = [{ name: "SyntaxError", stack: "at x (a.ts:1:1)", text: "bad" }] as unknown as ESBuildMessage[];

        const result = processESBuildErrors(errors);

        expect(result[0]?.name).toBe("SyntaxError");
        expect(result[0]?.stack).toBe("at x (a.ts:1:1)");
    });
});
