/**
 * This file is a modified version of the original `terminal-size` package.
 *
 * MIT License
 *
 * Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
 *
 * The upstream module reaches for `node:process`, `node:child_process`, `node:fs`
 * and `node:tty` through *static* imports. Importing it therefore drags those
 * builtins into the module graph of everything that imports `@visulima/boxen` —
 * which breaks at module-resolution time on runtimes that ship no Node builtins
 * (Cloudflare Workers without `nodejs_compat`, Deno Deploy, browsers), long
 * before any box is rendered.
 *
 * This port keeps the probing order and the documented 80x24 fallback, but
 * resolves the builtins lazily via `process.getBuiltinModule()` and only on the
 * path that actually needs them. That keeps `terminalSize()` synchronous — the
 * public `boxen()` API is synchronous and must stay that way — while leaving the
 * module graph free of `node:*` specifiers.
 */

/** Terminal dimensions in character cells. */
export interface TerminalSize {
    /** Number of columns (character cells across). */
    columns: number;

    /** Number of rows (character cells down). */
    rows: number;
}

/** Documented fallback used when no probe can determine the real terminal size. */
export const DEFAULT_COLUMNS = 80;

/** Documented fallback used when no probe can determine the real terminal size. */
export const DEFAULT_ROWS = 24;

interface StandardStream {
    columns?: number;
    rows?: number;
}

interface HostProcess {
    env?: Record<string, string | undefined>;
    getBuiltinModule?: (id: string) => unknown;
    platform?: string;
    stderr?: StandardStream;
    stdout?: StandardStream;
}

interface FsModule {
    constants: { O_EVTONLY: number; O_NONBLOCK: number };
    openSync: (path: string, flags: number) => number;
    readFileSync: (path: string, encoding: string) => string;
}

interface TtyModule {
    WriteStream: (fd: number) => StandardStream;
}

interface ChildProcessModule {
    execFileSync: (
        file: string,
        arguments_: string[],
        options: { encoding: string; env?: Record<string, string | undefined>; stdio: string[]; timeout: number },
    ) => string;
}

/**
 * The host `process` object, if the runtime exposes one.
 *
 * Read off `globalThis` rather than imported from `node:process` so the lookup
 * degrades to `undefined` instead of failing module resolution.
 * @returns The host `process`, or `undefined` on runtimes without one.
 */
const getHostProcess = (): HostProcess | undefined => (globalThis as { process?: HostProcess }).process;

/**
 * Synchronously resolve a Node builtin without a static import.
 *
 * `process.getBuiltinModule()` (Node >= 22.3) is the only synchronous escape
 * hatch that is invisible to bundlers and module resolvers — a dynamic
 * `import()` would work too, but it is asynchronous and `boxen()` is not.
 * @param id The builtin specifier, e.g. `node:fs`.
 * @returns The builtin module, or `undefined` when the runtime has no builtins.
 */
const getBuiltinModule = <T>(id: string): T | undefined => {
    const hostProcess = getHostProcess();

    if (typeof hostProcess?.getBuiltinModule !== "function") {
        return undefined;
    }

    try {
        return hostProcess.getBuiltinModule(id) as T;
    } catch {
        return undefined;
    }
};

const create = (columns: number | string, rows: number | string): TerminalSize => ({
    columns: Number.parseInt(String(columns), 10),
    rows: Number.parseInt(String(rows), 10),
});

/**
 * Reject probe output that is either unparseable or indistinguishable from the
 * fallback, so a bogus reading never wins over a later, better probe.
 * @param maybeColumns Raw column count reported by a probe.
 * @param maybeRows Raw row count reported by a probe.
 * @returns The parsed size, or `undefined` when it should not be trusted.
 */
const createIfNotDefault = (maybeColumns: string, maybeRows: string): TerminalSize | undefined => {
    const { columns, rows } = create(maybeColumns, maybeRows);

    if (Number.isNaN(columns) || Number.isNaN(rows)) {
        return undefined;
    }

    if (columns === DEFAULT_COLUMNS && rows === DEFAULT_ROWS) {
        return undefined;
    }

    return { columns, rows };
};

const exec = (command: string, arguments_: string[], environment?: Record<string, string | undefined>): string | undefined => {
    const childProcess = getBuiltinModule<ChildProcessModule>("node:child_process");

    if (childProcess?.execFileSync === undefined) {
        return undefined;
    }

    return childProcess
        .execFileSync(command, arguments_, {
            encoding: "utf8",
            env: environment,
            stdio: ["ignore", "pipe", "ignore"],
            timeout: 500,
        })
        .trim();
};

/**
 * On Linux, a background process must not steal the foreground terminal's size.
 * @returns `true` when this process owns the controlling terminal.
 */
const isForegroundProcess = (): boolean => {
    const hostProcess = getHostProcess();

    if (hostProcess?.platform !== "linux") {
        return true;
    }

    try {
        const fs = getBuiltinModule<FsModule>("node:fs");

        if (fs === undefined) {
            return false;
        }

        const statContents = fs.readFileSync("/proc/self/stat", "utf8");
        const closingParenthesisIndex = statContents.lastIndexOf(") ");

        if (closingParenthesisIndex === -1) {
            return false;
        }

        const statFields = statContents
            .slice(closingParenthesisIndex + 2)
            .trim()
            .split(/\s+/);
        const processGroupId = Number.parseInt(statFields[2] as string, 10);
        const foregroundProcessGroupId = Number.parseInt(statFields[5] as string, 10);

        if (Number.isNaN(processGroupId) || Number.isNaN(foregroundProcessGroupId)) {
            return false;
        }

        if (foregroundProcessGroupId <= 0) {
            return false;
        }

        return processGroupId === foregroundProcessGroupId;
    } catch {
        return false;
    }
};

/** Ask the controlling terminal directly; works even when stdout is redirected. */
const devTty = (): TerminalSize | undefined => {
    try {
        const fs = getBuiltinModule<FsModule>("node:fs");
        const tty = getBuiltinModule<TtyModule>("node:tty");

        if (fs === undefined || tty === undefined) {
            return undefined;
        }

        const hostProcess = getHostProcess();
        // eslint-disable-next-line no-bitwise
        const flags = hostProcess?.platform === "darwin" ? fs.constants.O_EVTONLY | fs.constants.O_NONBLOCK : fs.constants.O_NONBLOCK;
        // eslint-disable-next-line new-cap
        const { columns, rows } = tty.WriteStream(fs.openSync("/dev/tty", flags));

        if (columns === undefined || rows === undefined) {
            return undefined;
        }

        return { columns, rows };
    } catch {
        return undefined;
    }
};

/** On macOS this only returns correct values when stdout is not redirected. */
const tput = (): TerminalSize | undefined => {
    try {
        // `tput` requires the `TERM` environment variable to be set.
        const environment = { TERM: "dumb", ...getHostProcess()?.env };
        const columns = exec("tput", ["cols"], environment);
        const rows = exec("tput", ["lines"], environment);

        if (columns && rows) {
            return createIfNotDefault(columns, rows);
        }

        return undefined;
    } catch {
        return undefined;
    }
};

/** Only exists on Linux; works even when every file descriptor is redirected. */
const resize = (): TerminalSize | undefined => {
    try {
        if (!isForegroundProcess()) {
            return undefined;
        }

        const size = exec("resize", ["-u"])?.match(/\d+/g);

        if (size?.length === 2) {
            return createIfNotDefault(size[0] as string, size[1] as string);
        }

        return undefined;
    } catch {
        return undefined;
    }
};

/**
 * Reliably determine the terminal window size, synchronously.
 *
 * Probes, in order: `stdout`, `stderr`, the `COLUMNS`/`LINES` environment
 * variables, then platform-specific probes (`/dev/tty`, `tput`, `resize`).
 * Falls back to {@link DEFAULT_COLUMNS} x {@link DEFAULT_ROWS} when none of them
 * answer — which is what happens on runtimes without Node builtins.
 * @returns The detected terminal size, or the 80x24 fallback.
 */
const terminalSize = (): TerminalSize => {
    const hostProcess = getHostProcess();
    const { env, stderr, stdout } = hostProcess ?? {};

    if (stdout?.columns && stdout?.rows) {
        return create(stdout.columns, stdout.rows);
    }

    if (stderr?.columns && stderr?.rows) {
        return create(stderr.columns, stderr.rows);
    }

    // These values are static, so not the first choice.
    if (env?.COLUMNS && env?.LINES) {
        return create(env.COLUMNS, env.LINES);
    }

    const fallback: TerminalSize = {
        columns: DEFAULT_COLUMNS,
        rows: DEFAULT_ROWS,
    };

    // Every remaining probe needs Node builtins. On a runtime without them the
    // lazy lookups all return `undefined` and we land on the documented fallback.
    if (typeof hostProcess?.getBuiltinModule !== "function") {
        return fallback;
    }

    if (hostProcess.platform === "win32") {
        // We include `tput` for Windows users using Git Bash.
        return tput() ?? fallback;
    }

    if (hostProcess.platform === "darwin") {
        return devTty() ?? tput() ?? fallback;
    }

    return devTty() ?? tput() ?? resize() ?? fallback;
};

export default terminalSize;
