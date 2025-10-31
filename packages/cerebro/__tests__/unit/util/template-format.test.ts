import { red } from "@visulima/colorize";
import { describe, expect, it } from "vitest";

import templateFormat from "../../../src/util/text-processing/template-format";

describe("util/template-format", () => {
    it("should return simple string", () => {
        expect.assertions(1);

        const value = "Something";
        const result = templateFormat(value);

        expect(result).toStrictEqual(value);
    });

    it("should return template string in input", () => {
        expect.assertions(1);

        const value = "Something `0`";
        const result = templateFormat(value);

        expect(result).toStrictEqual(value);
    });

    it("should return value in red color", () => {
        expect.assertions(1);

        const value = "{red Something}";
        const result = templateFormat(value);

        expect(result).toStrictEqual(red("Something"));
    });
});
