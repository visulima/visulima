export const KEY = {
    backspace: "\x7F",
    ctrlC: "\x03",
    delete: "\x1B[3~",
    down: "\x1B[B",
    end: "\x1B[F",
    escape: "\x1B",
    home: "\x1B[H",
    left: "\x1B[D",
    pageDown: "\x1B[6~",
    pageUp: "\x1B[5~",
    return: "\r",
    right: "\x1B[C",
    space: " ",
    tab: "\t",
    up: "\x1B[A",
} as const;

export type KeyName = keyof typeof KEY;

export interface KeySender {
    /**
     * Simulate pressing the backspace key.
     */
    backspace: () => void;
    /**
     * Simulate pressing the delete key.
     */
    delete: () => void;
    /**
     * Simulate pressing the down arrow key.
     */
    down: () => void;
    /**
     * Simulate pressing the end key.
     */
    end: () => void;
    /**
     * Simulate pressing the enter/return key.
     */
    enter: () => void;
    /**
     * Simulate pressing the escape key.
     */
    escape: () => void;
    /**
     * Simulate pressing the home key.
     */
    home: () => void;
    /**
     * Simulate pressing the left arrow key.
     */
    left: () => void;
    /**
     * Simulate pressing the page down key.
     */
    pageDown: () => void;
    /**
     * Simulate pressing the page up key.
     */
    pageUp: () => void;
    /**
     * Send a single character as a key press.
     */
    press: (char: string) => void;
    /**
     * Send arbitrary raw data to stdin.
     */
    raw: (data: string) => void;
    /**
     * Simulate pressing the right arrow key.
     */
    right: () => void;
    /**
     * Simulate pressing the space key.
     */
    space: () => void;
    /**
     * Simulate pressing the tab key.
     */
    tab: () => void;
    /**
     * Type a string character by character.
     */
    type: (text: string) => void;
    /**
     * Simulate pressing the up arrow key.
     */
    up: () => void;
}

export const createKeySender = (write: (data: string) => void): KeySender => ({
    backspace: () => write(KEY.backspace),
    delete: () => write(KEY.delete),
    down: () => write(KEY.down),
    end: () => write(KEY.end),
    enter: () => write(KEY.return),
    escape: () => write(KEY.escape),
    home: () => write(KEY.home),
    left: () => write(KEY.left),
    pageDown: () => write(KEY.pageDown),
    pageUp: () => write(KEY.pageUp),
    press(char: string) {
        write(char);
    },
    raw: write,
    right: () => write(KEY.right),
    space: () => write(KEY.space),
    tab: () => write(KEY.tab),
    type(text: string) {
        for (const char of text) {
            write(char);
        }
    },
    up: () => write(KEY.up),
});
