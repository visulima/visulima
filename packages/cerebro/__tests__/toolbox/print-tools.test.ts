import stripANSI from "strip-ansi";
import { afterAll, describe, expect, it } from "vitest";

import printTools from "../../src/toolbox/print-tools";

// hijack the console
const { log } = console;

let spyLogger = [];

console.log = (x, y) => spyLogger.push([stripANSI(x), stripANSI(y)]);

describe("print-tools", () => {
    afterAll(() => {
        spyLogger = [];

        console.log = log;
    });

    it("info", () => {
        printTools.divider();
        printTools.newline();
        printTools.table([], [
            ["liam", "5"],
            ["matthew", "2"],
        ]);
        printTools.table(
            [],
            [
                ["liam", "5"],
                ["matthew", "2"],
            ],
            { format: "markdown" },
        );

        expect(spyLogger).toMatchSnapshot();
    });

    it("spin", () => {
        expect(typeof printTools.spinner).toBe("function");

        const spinner = printTools.spinner();

        expect(typeof spinner).toBe("object");
    });

    it("colors", () => {
        expect(typeof printTools.colors.highlight).toBe("function");
        expect(typeof printTools.colors.info).toBe("function");
        expect(typeof printTools.colors.warning).toBe("function");
        expect(typeof printTools.colors.success).toBe("function");
        expect(typeof printTools.colors.error).toBe("function");
        expect(typeof printTools.colors.line).toBe("function");
        expect(typeof printTools.colors.muted).toBe("function");
    });
});
