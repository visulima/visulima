import chalk, { colorNames } from "chalk";

import type { Colors } from "../@types/print";

const colors: Partial<Colors> = {
    critical: chalk.bold.red,
    error: chalk.bold.red,
    highlight: chalk.cyan,
    important: chalk.grey,
    info: chalk.blue,
    line: chalk.grey,
    muted: chalk.grey,
    success: chalk.green,
    warning: chalk.hex("#FF8800"),
};

colorNames.forEach((colorName) => {
    // eslint-disable-next-line security/detect-object-injection
    colors[colorName] = chalk[colorName];
});

export default colors as Colors;
