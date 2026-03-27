import chalk, { supportsColor } from "chalk";

export const enableTestColors = () => {
    chalk.level = 3;
};
export const disableTestColors = () => {
    chalk.level = supportsColor ? supportsColor.level : 0;
};
