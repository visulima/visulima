/* eslint-disable @stylistic/no-tabs, @stylistic/no-trailing-spaces, @typescript-eslint/no-redundant-type-constituents, jsdoc/check-alignment, jsdoc/require-asterisk-prefix, sonarjs/no-tab */
import type { Context } from "react";
import { createContext } from "react";

/**
 * A handle returned by `suspendTerminal()` when called without a callback.
 * Call `resume()` (or use `await using`, which disposes it) to restore Ink's
 * rendering and input handling.
 */
export type TerminalSuspension = {
    readonly [Symbol.asyncDispose]: () => Promise<void>;
    readonly resume: () => Promise<void>;
};

export type Props = {
    /**
     * Exit (unmount) the whole Ink app.
     *
     * - `exit()` — resolves `waitUntilExit()` with `undefined`.
     * - `exit(new Error('…'))` — rejects `waitUntilExit()` with the error.
     * - `exit(value)` — resolves `waitUntilExit()` with `value`.
     */
    readonly exit: (errorOrResult?: Error | unknown) => void;

    /**
     * Temporarily hand terminal control to a child process (e.g. an editor,
     * pager, or interactive subprocess), then restore Ink's rendering.
     *
     * - `suspendTerminal(async () => { … })` — runs the callback with the
     *   terminal released and auto-resumes when it settles.
     * - `suspendTerminal()` — returns a {@link TerminalSuspension} handle; call
     *   `resume()` (or `await using`) to restore.
     */
    readonly suspendTerminal: {
        (callback: () => Promise<void> | void): Promise<undefined>;
        (): Promise<TerminalSuspension>;
    };

    /**
     * Returns a promise that settles after pending render output is flushed to stdout.
     * @example
     * ```jsx
     * import {useEffect} from 'react';
	* import {useApp} from '@visulima/tui/hooks/use-app';
     
	const Example = () => {
		const {waitUntilRenderFlush} = useApp();
     
		useEffect(() => {
			void (async () => {
				await waitUntilRenderFlush();
				runNextCommand();
			})();
		}, [waitUntilRenderFlush]);
     
		return …;
	};
	```
     */
    readonly waitUntilRenderFlush: () => Promise<void>;
};

/**
 * `AppContext` is a React context that exposes lifecycle methods for the app.
 */

const AppContext: Context<Props> = createContext<Props>({
    exit() {},
    suspendTerminal: (() => Promise.resolve(undefined)) as unknown as Props["suspendTerminal"],
    async waitUntilRenderFlush() {},
});

AppContext.displayName = "InternalAppContext";

export default AppContext;
