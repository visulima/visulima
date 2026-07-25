import isInCi from "is-in-ci";

import getPackageVersion from "../util/package-version";

export const injectVersion = (): void => {
    process.env.VIS_VERSION = getPackageVersion();
};

/**
 * Set the terminal window title using OSC 0 escape sequence.
 * No-op when stdout is not a TTY, running in CI, or TERM=dumb.
 */
export const setTerminalTitle = (title: string): void => {
    if (!process.stdout.isTTY || isInCi || process.env.TERM === "dumb") {
        return;
    }

    process.stdout.write(`]0;${title}`);
};
