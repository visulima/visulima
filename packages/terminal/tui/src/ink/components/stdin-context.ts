import { EventEmitter } from "node:events";
import process from "node:process";

import type { Context } from "react";
import { createContext } from "react";

export type PublicProps = {
    /**
     * A boolean flag determining if the current `stdin` supports `setRawMode`. A component using `setRawMode` might want to use `isRawModeSupported` to nicely fall back in environments where raw mode is not supported.
     */
    readonly isRawModeSupported: boolean;

    /**
     * Ink exposes this function via own `&lt;StdinContext>` to be able to handle Ctrl+C, that's why you should use Ink's `setRawMode` instead of `process.stdin.setRawMode`. If the `stdin` stream passed to Ink does not support setRawMode, this function does nothing.
     */
    readonly setRawMode: (value: boolean) => void;

    /**
     * The stdin stream passed to `render()` in `options.stdin`, or `process.stdin` by default. Useful if your app needs to handle user input.
     */
    readonly stdin: NodeJS.ReadStream;
};

export type Props = PublicProps & {
    readonly internal_eventEmitter: EventEmitter;

    readonly internal_exitOnCtrlC: boolean;

    /**
     * Enable or disable bracketed paste mode on the terminal. When enabled, pasted text is wrapped in escape sequences that allow it to be distinguished from typed input.
     */
    readonly setBracketedPasteMode: (value: boolean) => void;
};

/**
 * `StdinContext` is a React context that exposes the input stream.
 */

const StdinContext: Context<Props> = createContext<Props>({
    internal_eventEmitter: new EventEmitter(),

    internal_exitOnCtrlC: true,
    isRawModeSupported: false,
    setBracketedPasteMode() {},
    setRawMode() {},
    stdin: process.stdin,
});

StdinContext.displayName = "InternalStdinContext";

export default StdinContext;
