import stripANSI from "strip-ansi";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { mockConsole } from "vitest-console";

import printTools from "../../../src/toolbox/print-tools";
import chalk from "chalk";
import terminalSize from "term-size";

const { clearConsole, restoreConsole } = mockConsole({ quiet: true });

describe("print-tools", () => {
    afterEach(clearConsole);

    afterAll(restoreConsole);

    it("should render a divider", () => {
        printTools.divider();

        expect(console.log).toHaveBeenCalledWith(chalk.grey("-------------------------------------------------------------------------------"));

        printTools.divider({ fullWidth: true });

        const { columns } = terminalSize();

        expect(console.log).toHaveBeenCalledWith(chalk.grey(Array.from({ length: columns }).join("-")));

        const width = 10;

        printTools.divider({ width });

        expect(console.log).toHaveBeenCalledWith(chalk.grey(Array.from({ length: width }).join("-")));
    });

    it("should render a newline", () => {
        printTools.newline();

        expect(console.log).toHaveBeenCalledWith("");
    });

    it("should return a progress bar instance", () => {
        const progressBar = printTools.progress();

        expect(typeof progressBar).toBe("object");
    });

    it("should return a multi progress bar instance", () => {
        const multiProgressBar = printTools.multiProgress();

        expect(typeof multiProgressBar).toBe("object");
    });

    it("spin", () => {
        expect(typeof printTools.spin).toBe("function");

        const spinner = printTools.spin();

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
