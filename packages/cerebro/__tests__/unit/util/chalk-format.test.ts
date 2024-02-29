import chalk from "chalk";
import { describe, expect, it } from "vitest";

import templateFormat from "../../../src/util/template-format";

describe("util/chalk-format", () => {
    it("should return simple string", () => {
        const value = "Something";
        const result = templateFormat(value);

        expect(result).toStrictEqual(value);
    });

    it("should return template string in input", () => {
        const value = "Something `0`";
        const result = templateFormat(value);

        expect(result).toStrictEqual(value);
    });

    it("should return value in red color", () => {
        const value = "{red Something}";
        const result = templateFormat(value);

        expect(result).toStrictEqual(chalk.red("Something"));
    });
});
