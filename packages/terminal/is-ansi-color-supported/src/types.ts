/**
 * Levels:
 * - `0` - All colors disabled.
 * - `1` - Basic 16 colors support.
 * - `2` - ANSI 256 colors support.
 * - `3` - Truecolor 16 million colors support.
 */
export type ColorSupportLevel = 0 | 1 | 2 | 3;

/**
 * Options for the configurable `createIsColorSupported` detector.
 */
export interface CreateIsColorSupportedOptions {
    /**
     * Force the TTY state instead of reading it from the resolved stream.
     *
     * Useful when probing color support for a non-standard sink (e.g. a log file)
     * or when the runtime does not expose `isTTY`. When omitted, the stream's own
     * `isTTY` (or Deno's `isTerminal()`) is used.
     */
    isTTY?: boolean;

    /**
     * Whether to inspect `process.argv` for `--color`/`--no-color`-style flags.
     *
     * Set to `false` for library consumers whose CLIs define their own `--color`
     * semantics, so the detector does not react to unrelated flags.
     * @default true
     */
    sniffFlags?: boolean;
}
