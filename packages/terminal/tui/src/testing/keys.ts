export const KEY = {
    backspace: "\u007F",
    ctrlC: "\u0003",
    delete: "\u001B[3~",
    down: "\u001B[B",
    end: "\u001B[F",
    escape: "\u001B",
    home: "\u001B[H",
    left: "\u001B[D",
    pageDown: "\u001B[6~",
    pageUp: "\u001B[5~",
    return: "\r",
    right: "\u001B[C",
    space: " ",
    tab: "\t",
    up: "\u001B[A",
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

export const createKeySender = (write: (data: string) => void): KeySender => {
    return {
        backspace: () => {
            write(KEY.backspace);
        },
        delete: () => {
            write(KEY.delete);
        },
        down: () => {
            write(KEY.down);
        },
        end: () => {
            write(KEY.end);
        },
        enter: () => {
            write(KEY.return);
        },
        escape: () => {
            write(KEY.escape);
        },
        home: () => {
            write(KEY.home);
        },
        left: () => {
            write(KEY.left);
        },
        pageDown: () => {
            write(KEY.pageDown);
        },
        pageUp: () => {
            write(KEY.pageUp);
        },
        press(char: string) {
            write(char);
        },
        raw: write,
        right: () => {
            write(KEY.right);
        },
        space: () => {
            write(KEY.space);
        },
        tab: () => {
            write(KEY.tab);
        },
        type(text: string) {
            for (const char of text) {
                write(char);
            }
        },
        up: () => {
            write(KEY.up);
        },
    };
};
