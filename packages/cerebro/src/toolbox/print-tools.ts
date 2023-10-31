import boxen from "boxen";
import type { Options as OraOptions, Ora } from "ora";
import ora from "ora";
import terminalLink from "terminal-link";

import type { Print as IPrint } from "../@types";
import { VERBOSITY_QUIET } from "../constants";
import annotation from "../ui/annotation";
import clear from "../ui/clear";
import colors from "../ui/colors";
import { justify, truncate, wrap } from "../ui/helpers";
import instructions from "../ui/instructions";
import { multiProgress, progress } from "../ui/progress";
import table from "../ui/table";
import terminalSize from "../ui/terminal-size";

/**
 * Print a blank line.
 */
const newline = (): void => {
    // eslint-disable-next-line no-console
    console.log("");
};

/**
 * Prints a divider line
 */
const divider = ({ fullWidth = false, width = 80 }: { fullWidth?: boolean; width?: number } = {}): void => {
    let lineWidth = width;

    if (fullWidth) {
        lineWidth = terminalSize().width;
    }

    // eslint-disable-next-line no-console
    console.log(colors.line(Array.from({ length: lineWidth }).join("-")));
};

/**
 * Creates an Ora spin.
 */
const spin = (config?: OraOptions | string): Ora => ora(config).start();

const log = (arguments_: any, type: "debug" | "error" | "info" | "log" | "warn" = "log"): void => {
    if (process.env["NODE_ENV"] === "test" || Number(process.env["CEREBRO_OUTPUT"]) === VERBOSITY_QUIET) {
        return;
    }

    // eslint-disable-next-line no-console,security/detect-object-injection
    console[type](arguments_);
};

export default {
    annotation,
    boxen,
    clear,
    colors,
    divider,
    instructions,
    justify,
    link: terminalLink,
    multiProgress,
    newline,
    print: log,
    progress,
    spin,
    table,
    terminalSize,
    truncate,
    wrap,
} as IPrint;
