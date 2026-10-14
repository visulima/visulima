import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import url from "node:url";

import { Terminal } from "@xterm/headless";

import waitFor from "./wait-for";

const require = createRequire(import.meta.url);

const fixturesDirectory = url.fileURLToPath(new URL("../ink/fixtures", import.meta.url));

// Fixture side of the protocol lives in __tests__/ink/fixtures/pty-step.ts: the fixture sets the
// window title to `step:<name>` and then blocks until the test sends a key. Output is therefore
// quiescent at every step, so the emulator state read at a step is exactly the state at that point.
const STEP_TITLE_PREFIX = "step:";

const getSpawn = (): (typeof import("node-pty"))["spawn"] => (require("node-pty") as typeof import("node-pty")).spawn;

export type FixtureSession = {
    /** Lets the fixture continue past the step it is blocked on. */
    advance: () => void;
    /** Absolute row index (scrollback included) of the emulator cursor. */
    cursorRow: () => number;
    dispose: () => void;
    /** Every buffer line, scrollback first, right-trimmed. */
    lines: () => string[];
    /** Resolves once the fixture has printed the named step marker and is blocked waiting for `advance()`. */
    reachStep: (name: string) => Promise<void>;
    /** Resizes the pty and the emulator together, after everything already emitted has been parsed. */
    resize: (columns: number, rows: number) => Promise<void>;
    /** Lines that contain anything, in order. */
    text: () => string[];
};

export type StartFixtureOptions = {
    columns?: number;
    env?: Record<string, string>;
    rows?: number;
};

export const startFixture = (fixture: string, { columns = 40, env = {}, rows = 12 }: StartFixtureOptions = {}): FixtureSession => {
    const spawn = getSpawn();
    const emulator = new Terminal({ allowProposedApi: true, cols: columns, rows, scrollback: 500 });
    const reachedSteps = new Set<string>();

    emulator.onTitleChange((title) => {
        if (title.startsWith(STEP_TITLE_PREFIX)) {
            reachedSteps.add(title.slice(STEP_TITLE_PREFIX.length));
        }
    });

    const ps = spawn("node", ["--import=tsx", path.join(fixturesDirectory, `${fixture}.tsx`)], {
        cols: columns,
        cwd: fixturesDirectory,
        env: {
            ...(process.env as Record<string, string>),
            CI: "false",
            NODE_NO_WARNINGS: "1",
            ...env,
        },
        name: "xterm-color",
        rows,
    });

    ps.onData((data) => {
        emulator.write(data);
    });

    const lines = (): string[] => {
        const buffer = emulator.buffer.active;

        return Array.from({ length: buffer.length }, (_, row) => (buffer.getLine(row)?.translateToString(true) ?? "").trimEnd());
    };

    const drain = (): Promise<void> =>
        new Promise((resolve) => {
            emulator.write("", resolve);
        });

    let isDisposed = false;

    return {
        advance: () => {
            ps.write("\r");
        },
        cursorRow: () => emulator.buffer.active.baseY + emulator.buffer.active.cursorY,
        dispose: () => {
            if (!isDisposed) {
                isDisposed = true;

                try {
                    ps.kill();
                } catch {
                    // The fixture already exited.
                }
            }
        },
        lines,
        reachStep: async (name) => {
            try {
                await waitFor(() => reachedSteps.has(name), 15_000);
            } catch {
                throw new Error(`fixture ${fixture} never reached step "${name}"; screen so far:\n${lines().join("\n")}`);
            }
        },
        resize: async (nextColumns, nextRows) => {
            await drain();
            emulator.resize(nextColumns, nextRows);
            ps.resize(nextColumns, nextRows);
        },
        text: () => lines().filter((line) => line.trim() !== ""),
    };
};
