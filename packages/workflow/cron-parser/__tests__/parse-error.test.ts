import { describe, expect, it } from "vitest";

import { CronExpressionParser, CronParseError } from "../src";

const thrownBy = (expression: string, options?: Parameters<typeof CronExpressionParser.parse>[1]): CronParseError => {
    try {
        CronExpressionParser.parse(expression, options);
    } catch (error) {
        expect(error).toBeInstanceOf(CronParseError);

        return error as CronParseError;
    }

    throw new Error(`Expected ${expression} to throw`);
};

describe("the typed parse error", () => {
    it("carries the field, the offending token and a code for a bad character", () => {
        expect.hasAssertions();

        const error = thrownBy("10 ! 12 8 0");

        expect(error.code).toBe("FIELD_CHARACTER");
        expect(error.field).toBe("hour");
        expect(error.token).toBe("!");
        expect(error.message).toBe("Invalid characters, got value: !");
    });

    it("carries the field and token for a value outside the range", () => {
        expect.hasAssertions();

        const error = thrownBy("61 * * * * *");

        expect(error.code).toBe("FIELD_RANGE");
        expect(error.field).toBe("second");
        expect(error.token).toBe("61");
    });

    it("carries the field and token for a duplicate value", () => {
        expect.hasAssertions();

        const error = thrownBy("0,0 * * * *");

        expect(error.code).toBe("DUPLICATE_VALUE");
        expect(error.field).toBe("minute");
        expect(error.token).toBe("0");
    });

    it("names the feature a dialect turned off", () => {
        expect.hasAssertions();

        const error = thrownBy("H * * * *", { dialect: "cloudflare" });

        expect(error.code).toBe("UNSUPPORTED_FEATURE");
        expect(error.field).toBe("minute");
        expect(error.token).toBe("H");
        expect(error.message).toContain("hashed");
    });

    it("stays an Error, so existing catch blocks keep working", () => {
        expect.hasAssertions();

        expect(thrownBy("10 ! 12 8 0")).toBeInstanceOf(Error);
    });
});
