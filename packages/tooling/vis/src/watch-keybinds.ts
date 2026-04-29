import type { ReadStream } from "node:tty";
import { emitKeypressEvents } from "node:readline";

/**
 * Vitest-style keybinds for `vis run --watch`. The watch loop installs
 * this on entry and tears it down on exit. Keys:
 *
 * - `r` / `Enter`  — rerun the active task set
 * - `a`            — clear the active filter and rerun the full set
 * - `p`            — prompt for a project name filter (substring match);
 *                    subsequent reruns operate on matching projects only
 * - `q` / `Ctrl+C` — quit cleanly
 * - `h` / `?`      — print the keybind reference
 *
 * Designed for injectability: tests pass a synthetic stdin and assert on
 * the dispatched handler calls. The default uses `process.stdin` /
 * `process.stdout` and is a no-op when stdin isn't a TTY (CI runs).
 */

export interface KeybindHandlers {
    /** Called for `a` — clear filter, rerun the full task set. */
    onClearFilter: () => void | Promise<void>;
    /** Called when the user submits a non-empty filter via `p`. */
    onFilter: (pattern: string) => void | Promise<void>;
    /** Called for `h` / `?` — print keybind reference (handled by host). */
    onHelp: () => void | Promise<void>;
    /**
     * Called for `q` / `Ctrl+C` — close watcher, exit watch loop.
     *
     * Ctrl+C is dispatched even while the `p` filter prompt is open, so
     * the user always has an escape hatch. If a custom `promptFilter`
     * is in use, it must tolerate being abandoned mid-await — the
     * dispatcher will resolve `onQuit` regardless of any pending prompt
     * promise, and the host will tear the keybind handle down. A custom
     * prompt that wants to handle Ctrl+C internally must accept that
     * `onQuit` will fire as well; there is no way to suppress it.
     */
    onQuit: () => void | Promise<void>;
    /** Called for `r` / `Enter` — rerun active task set. */
    onRerun: () => void | Promise<void>;
}

export interface KeybindHandle {
    close: () => void;
}

// `node:readline`'s keypress event payload. We intentionally only depend
// on the fields we use so a non-Node TTY shim can implement enough.
export interface KeypressKey {
    ctrl?: boolean;
    name?: string;
    sequence?: string;
}

export interface InstallKeybindsOptions {
    handlers: KeybindHandlers;
    /** Defaults to `process.stdin`. Set in tests. */
    input?: NodeJS.ReadableStream & Partial<Pick<ReadStream, "isTTY" | "setRawMode">>;
    /** Defaults to `process.stdout`. Set in tests. */
    output?: NodeJS.WritableStream;
    /**
     * Inline prompt used by the `p` keybind. Receives the host stream
     * pair so a real readline can be substituted in tests.
     *
     * Contract: the prompt resolves with the user's input (any leading
     * `p` keystroke is already consumed by the dispatcher) or
     * `undefined` to signal cancellation. The dispatcher will not trim
     * the resolved string — handle whitespace at the prompt boundary
     * if your handler needs trimmed input. The prompt is responsible
     * for restoring stdin to the state expected by the dispatcher
     * (raw mode, paused/resumed) before resolving; the default
     * implementation re-enables raw mode if it was on at entry.
     */
    promptFilter?: (input: NodeJS.ReadableStream, output: NodeJS.WritableStream) => Promise<string | undefined>;
}

const KEYBIND_HELP = [
    "",
    "  Watch keybinds:",
    "    r, Enter  rerun",
    "    a        rerun all (clear filter)",
    "    p        filter by project name",
    "    q, Ctrl+C  quit",
    "    h, ?     show this help",
    "",
].join("\n");

const writeHelp = (output: NodeJS.WritableStream): void => {
    output.write(`${KEYBIND_HELP}\n`);
};

const defaultPromptFilter = async (input: NodeJS.ReadableStream, output: NodeJS.WritableStream): Promise<string | undefined> => {
    output.write("filter projects (empty to cancel) > ");

    const tty = input as NodeJS.ReadableStream & Partial<Pick<ReadStream, "setRawMode">>;
    const wasRaw = (tty as { isRaw?: boolean }).isRaw === true;

    if (wasRaw) {
        try {
            tty.setRawMode?.(false);
        } catch {
            // ignore — non-TTY input
        }
    }

    return await new Promise<string | undefined>((resolve) => {
        let buffer = "";

        const onData = (chunk: Buffer | string): void => {
            buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");

            const newlineIndex = buffer.indexOf("\n");

            if (newlineIndex < 0) {
                return;
            }

            const line = buffer.slice(0, newlineIndex).replace(/\r$/, "").trim();

            input.off("data", onData);

            if (wasRaw) {
                try {
                    tty.setRawMode?.(true);
                } catch {
                    // ignore
                }
            }

            resolve(line.length > 0 ? line : undefined);
        };

        input.on("data", onData);
    });
};

/**
 * Installs the watch-mode keybinds. Returns a handle whose `close`
 * removes listeners and restores the previous TTY mode.
 *
 * No-ops gracefully when `input.isTTY` is false (CI, piped stdin) so a
 * hook never blocks an unattended run.
 */
export const installKeybinds = (options: InstallKeybindsOptions): KeybindHandle => {
    const handlers = options.handlers;
    const input = options.input ?? (process.stdin as InstallKeybindsOptions["input"]);
    const output = options.output ?? process.stdout;
    const promptFilter = options.promptFilter ?? defaultPromptFilter;

    if (!input || input.isTTY === false) {
        return { close: () => {} };
    }

    emitKeypressEvents(input as NodeJS.ReadableStream);

    const previousIsRaw = (input as { isRaw?: boolean }).isRaw === true;

    try {
        input.setRawMode?.(true);
    } catch {
        // Non-TTY; pretend keybinds aren't installed.
        return { close: () => {} };
    }

    if (typeof (input as NodeJS.ReadStream).resume === "function") {
        (input as NodeJS.ReadStream).resume();
    }

    let prompting = false;

    const dispatch = async (key: KeypressKey): Promise<void> => {
        // Ctrl+C is the always-on escape hatch: the user must be able
        // to quit even while the `p` prompt is open. The default prompt
        // toggles raw mode off so the kernel routes Ctrl+C via SIGINT,
        // but custom prompts that keep raw mode on rely on this branch.
        if (key.ctrl === true && key.name === "c") {
            await handlers.onQuit();
            return;
        }

        if (prompting) {
            return;
        }

        switch (key.name) {
            case "return": {
                await handlers.onRerun();
                break;
            }
            case "r": {
                await handlers.onRerun();
                break;
            }
            case "a": {
                await handlers.onClearFilter();
                break;
            }
            case "q": {
                await handlers.onQuit();
                break;
            }
            case "h":
            case "?": {
                await handlers.onHelp();
                break;
            }
            case "p": {
                prompting = true;

                try {
                    const pattern = await promptFilter(input as NodeJS.ReadableStream, output);

                    if (pattern === undefined) {
                        output.write("filter cancelled.\n");
                    } else {
                        await handlers.onFilter(pattern);
                    }
                } finally {
                    prompting = false;
                }

                break;
            }
            default: {
                // Unknown keys are ignored — same as Vitest's watch mode.
                break;
            }
        }
    };

    const onKeypress = (_str: string | undefined, key: KeypressKey): void => {
        // Errors from async handlers should not crash watch — surface
        // them on stderr and continue listening.
        dispatch(key).catch((error: unknown) => {
            output.write(`[vis watch] keybind handler failed: ${(error as Error).message}\n`);
        });
    };

    input.on("keypress", onKeypress);

    return {
        close: () => {
            input.off("keypress", onKeypress);

            if (!previousIsRaw) {
                try {
                    input.setRawMode?.(false);
                } catch {
                    // ignore
                }
            }

            // Pair `resume()` above with a pause so stdin stops keeping
            // the event loop alive once the watch loop exits. Hosts that
            // need stdin again can resume it themselves.
            const pause = (input as NodeJS.ReadableStream & { pause?: () => void }).pause;

            if (typeof pause === "function") {
                try {
                    pause.call(input);
                } catch {
                    // ignore — non-pausable streams (test fakes, etc.)
                }
            }
        },
    };
};

export { KEYBIND_HELP, writeHelp };
