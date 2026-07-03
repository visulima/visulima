import EventEmitter from "node:events";

import type { ReactElement } from "react";

import type { Instance, RenderOptions } from "../ink/render";
import render from "../ink/render";
import type { KeySender } from "./keys";
import { createKeySender } from "./keys";
import type { Screen } from "./screen";
import { createScreen } from "./screen";
import type { WaitForOptions } from "./wait-for";
import { waitFor } from "./wait-for";

/**
 * Mock stdout stream that captures rendered frames.
 */
class Stdout extends EventEmitter {
    readonly columns: number;

    private _lastFrame: string | undefined;

    private readonly _frames: string[] = [];

    constructor(columns = 100) {
        super();
        this.columns = columns;
    }

    get frames(): ReadonlyArray<string> {
        return this._frames;
    }

    lastFrame(): string | undefined {
        return this._lastFrame;
    }

    write = (frame: string): boolean => {
        this._frames.push(frame);
        this._lastFrame = frame;

        return true;
    };
}

/**
 * Mock stderr stream that captures rendered frames.
 */
class Stderr extends EventEmitter {
    readonly columns: number;

    private _lastFrame: string | undefined;

    private readonly _frames: string[] = [];

    constructor(columns = 100) {
        super();
        this.columns = columns;
    }

    get frames(): ReadonlyArray<string> {
        return this._frames;
    }

    lastFrame(): string | undefined {
        return this._lastFrame;
    }

    write = (frame: string): boolean => {
        this._frames.push(frame);
        this._lastFrame = frame;

        return true;
    };
}

/**
 * Mock stdin stream that simulates user input.
 */
class Stdin extends EventEmitter {
    readonly isTTY = true;

    private pendingData: string | undefined;

    write = (data: string): boolean => {
        this.pendingData = data;
        this.emit("readable");
        this.emit("data", data);

        return true;
    };

    read(): string | undefined {
        const { pendingData } = this;

        this.pendingData = undefined;

        return pendingData;
    }

    setEncoding(): this {
        return this;
    }

    setRawMode(): this {
        return this;
    }

    resume(): this {
        return this;
    }

    pause(): this {
        return this;
    }

    ref(): this {
        return this;
    }

    unref(): this {
        return this;
    }
}

export type TestInstanceStdout = {
    /**
     * All rendered frames captured from stdout.
     */
    readonly frames: ReadonlyArray<string>;

    /**
     * Returns the most recently rendered frame, or `undefined` if no frames have been written.
     */
    lastFrame: () => string | undefined;

    /**
     * Write data to the mock stdout stream (used internally by the renderer).
     */
    write: (frame: string) => boolean;
};

export type TestInstanceStderr = {
    /**
     * All rendered frames captured from stderr.
     */
    readonly frames: ReadonlyArray<string>;

    /**
     * Returns the most recently rendered frame, or `undefined` if no frames have been written.
     */
    lastFrame: () => string | undefined;

    /**
     * Write data to the mock stderr stream (used internally by the renderer).
     */
    write: (frame: string) => boolean;
};

export type TestInstanceStdin = {
    /**
     * Whether the stdin is a TTY.
     */
    readonly isTTY: boolean;

    /**
     * Simulate user input by writing data to stdin.
     */
    write: (data: string) => boolean;
};

export type TestInstance = {
    /**
     * Unmount the app and clean up resources.
     */
    cleanup: () => void;

    /**
     * Wait for pending React renders to flush (two microtick delay).
     */
    flush: () => Promise<void>;

    /**
     * All rendered frames captured from stdout (shorthand for `stdout.frames`).
     */
    readonly frames: ReadonlyArray<string>;

    /**
     * Keyboard input helpers for simulating key presses.
     */
    keys: KeySender;

    /**
     * Returns the most recently rendered frame from stdout (shorthand for `stdout.lastFrame()`).
     */
    lastFrame: () => string | undefined;

    /**
     * Replace the previous root node with a new one or update props.
     */
    rerender: (node: ReactElement) => void;

    /**
     * Screen query helpers for inspecting rendered output with ANSI stripping.
     */
    screen: Screen;

    /**
     * Mock stderr stream with frame capture.
     */
    stderr: TestInstanceStderr;

    /**
     * Mock stdin stream for simulating user input.
     */
    stdin: TestInstanceStdin;

    /**
     * Mock stdout stream with frame capture.
     */
    stdout: TestInstanceStdout;

    /**
     * Manually unmount the whole app.
     */
    unmount: () => void;

    /**
     * Wait for a condition to be met by polling.
     *
     * If `condition` is a string, waits until the screen contains it.
     * If `condition` is a function, waits until it stops throwing.
     */
    waitFor: (condition: (() => void) | string, options?: WaitForOptions) => Promise<void>;
};

export type TestRenderOptions = {
    /**
     * Terminal column width for the mock stdout/stderr streams.
     * @default 100
     */
    columns?: number;

    /**
     * Additional render options passed through to the underlying render function.
     */
    options?: Omit<RenderOptions, "debug" | "exitOnCtrlC" | "patchConsole" | "stderr" | "stdin" | "stdout">;
};

const instances: Instance[] = [];

/**
 * Render a React element for testing, capturing output in mock streams.
 *
 * Returns an object with methods to inspect rendered output, simulate input,
 * and control the component lifecycle.
 * @example
 * ```tsx
 * import { render } from "@visulima/tui/test";
 * import { Text } from "@visulima/tui";
 *
 * const { lastFrame } = render(<Text>Hello</Text>);
 * console.log(lastFrame()); // "Hello"
 * ```
 */
const testRender = (node: ReactElement, testOptions: TestRenderOptions = {}): TestInstance => {
    const { columns, options: renderOptions } = testOptions;

    const stdout = new Stdout(columns);
    const stderr = new Stderr(columns);
    const stdin = new Stdin();

    const instance = render(node, {
        debug: true,
        exitOnCtrlC: false,
        patchConsole: false,
        stderr: stderr as unknown as NodeJS.WriteStream,
        stdin: stdin as unknown as NodeJS.ReadStream,
        stdout: stdout as unknown as NodeJS.WriteStream,
        ...renderOptions,
    });

    instances.push(instance);

    const screen = createScreen(() => stdout.lastFrame(), stdout.frames);
    const keys = createKeySender((data) => stdin.write(data));

    const flush = async (): Promise<void> => {
        await new Promise<void>((resolve) => {
            setTimeout(resolve, 0);
        });
        await new Promise<void>((resolve) => {
            setTimeout(resolve, 0);
        });
    };

    return {
        cleanup: instance.cleanup,
        flush,
        get frames() {
            return stdout.frames;
        },
        keys,
        lastFrame: () => stdout.lastFrame(),
        rerender: instance.rerender as (node: ReactElement) => void,
        screen,
        stderr,
        stdin,
        stdout,
        unmount: instance.unmount,
        async waitFor(condition: (() => void) | string, options?: WaitForOptions): Promise<void> {
            await waitFor(condition, () => screen.text(), options);
        },
    };
};

/**
 * Unmount and clean up all rendered test instances.
 *
 * Call this in your test teardown (e.g., `afterEach`) to ensure
 * no test instances leak between tests.
 * @example
 * ```ts
 * import { cleanup } from "@visulima/tui/test";
 *
 * afterEach(() => {
 *     cleanup();
 * });
 * ```
 */
const cleanup = (): void => {
    for (const instance of instances) {
        instance.cleanup();
    }

    instances.length = 0;
};

export { cleanup, testRender as render };
export type { KeyName, KeySender } from "./keys";
export { createKeySender, KEY } from "./keys";
export type { Screen } from "./screen";
export { createScreen } from "./screen";
export type { WaitForOptions } from "./wait-for";
export { waitFor } from "./wait-for";
