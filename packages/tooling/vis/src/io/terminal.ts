import { hyperlink } from "@visulima/ansi";
import { dim } from "@visulima/colorize";
import { readJsonSync } from "@visulima/fs";
import isInCi from "is-in-ci";

/**
 * Creates a clickable terminal hyperlink using `@visulima/ansi` OSC 8
 * implementation. Falls back to "text (url)" when not in a TTY.
 */
export const link = (text: string, url: string): string => {
    if (!process.stderr.isTTY || process.env.TERM === "dumb") {
        return text === url ? url : `${text} (${dim(url)})`;
    }

    return hyperlink(text, url);
};

const getVersion = (): string => {
    if (process.env.VIS_VERSION) {
        return process.env.VIS_VERSION;
    }

    try {
        const pkgPath = new URL("../../package.json", import.meta.url);

        return (readJsonSync(pkgPath) as { version: string }).version;
    } catch {
        return "0.0.0";
    }
};

export const injectVersion = (): void => {
    process.env.VIS_VERSION = getVersion();
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
