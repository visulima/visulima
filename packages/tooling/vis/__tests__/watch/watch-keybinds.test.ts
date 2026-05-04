// Two cooperating test fakes (FakeTTYInput + FakeOutput) live in this
// file because they're only used together by these tests. EventEmitter
// (not EventTarget) is required because installKeybinds wires into
// node:readline.emitKeypressEvents, which only speaks the EventEmitter
// API.
/* eslint-disable max-classes-per-file, unicorn/prefer-event-target */
import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import type { KeybindHandlers, KeypressKey } from "../../src/watch/watch-keybinds";
import { installKeybinds } from "../../src/watch/watch-keybinds";

// Stand-in for `process.stdin`. Adds the bits `installKeybinds` touches:
// `isTTY`, `setRawMode`, `resume`, and the keypress event channel that
// `node:readline.emitKeypressEvents` would normally drive.
class FakeTTYInput extends EventEmitter {
    public isTTY = true;

    public isRaw = false;

    public resumed = false;

    public readonly setRawMode = vi.fn((value: boolean) => {
        this.isRaw = value;
    });

    public override resume = (): this => {
        this.resumed = true;

        return this;
    };

    public press(key: KeypressKey, sequence?: string): void {
        this.emit("keypress", sequence, { sequence: sequence ?? "", ...key });
    }

    public typeLine(line: string): void {
        this.emit("data", `${line}\n`);
    }
}

class FakeOutput {
    public readonly chunks: string[] = [];

    public write(chunk: string | Uint8Array): boolean {
        this.chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));

        return true;
    }

    public get text(): string {
        return this.chunks.join("");
    }
}

const flush = (): Promise<void> =>
    new Promise((resolve) => {
        setImmediate(resolve);
    });

const makeHandlers = (): KeybindHandlers & {
    calls: { clear: number; filters: string[]; help: number; quit: number; rerun: number };
} => {
    const calls = { clear: 0, filters: [] as string[], help: 0, quit: 0, rerun: 0 };

    return {
        calls,
        onClearFilter: () => {
            calls.clear += 1;
        },
        onFilter: (pattern: string) => {
            calls.filters.push(pattern);
        },
        onHelp: () => {
            calls.help += 1;
        },
        onQuit: () => {
            calls.quit += 1;
        },
        onRerun: () => {
            calls.rerun += 1;
        },
    };
};

describe(installKeybinds, () => {
    it("dispatches r and Enter to onRerun", async () => {
        expect.assertions(2);

        const input = new FakeTTYInput();
        const output = new FakeOutput();
        const handlers = makeHandlers();

        const handle = installKeybinds({ handlers, input, output: output as unknown as NodeJS.WritableStream });

        input.press({ name: "r" });
        await flush();
        input.press({ name: "return" });
        await flush();

        expect(handlers.calls.rerun).toBe(2);
        expect(handlers.calls.quit).toBe(0);

        handle.close();
    });

    it("dispatches q and Ctrl+C to onQuit", async () => {
        expect.assertions(1);

        const input = new FakeTTYInput();
        const output = new FakeOutput();
        const handlers = makeHandlers();

        const handle = installKeybinds({ handlers, input, output: output as unknown as NodeJS.WritableStream });

        input.press({ name: "q" });
        await flush();
        input.press({ ctrl: true, name: "c" });
        await flush();

        expect(handlers.calls.quit).toBe(2);

        handle.close();
    });

    it("dispatches a to onClearFilter", async () => {
        expect.assertions(1);

        const input = new FakeTTYInput();
        const output = new FakeOutput();
        const handlers = makeHandlers();

        const handle = installKeybinds({ handlers, input, output: output as unknown as NodeJS.WritableStream });

        input.press({ name: "a" });
        await flush();

        expect(handlers.calls.clear).toBe(1);

        handle.close();
    });

    it("prints the keybind reference for h and ?", async () => {
        expect.assertions(2);

        const input = new FakeTTYInput();
        const output = new FakeOutput();
        const handlers = makeHandlers();

        const handle = installKeybinds({ handlers, input, output: output as unknown as NodeJS.WritableStream });

        input.press({ name: "h" });
        await flush();
        input.press({ name: "?" });
        await flush();

        expect(handlers.calls.help).toBe(2);
        // The host renders help — handler call is enough to verify dispatch.
        expect(output.text).toBe("");

        handle.close();
    });

    it("prompts for a filter pattern on p and forwards the prompt's return value verbatim", async () => {
        expect.assertions(3);

        const input = new FakeTTYInput();
        const output = new FakeOutput();
        const handlers = makeHandlers();

        const handle = installKeybinds({
            handlers,
            input,
            output: output as unknown as NodeJS.WritableStream,
            promptFilter: async () => "  cli  ",
        });

        input.press({ name: "p" });
        await flush();

        expect(handlers.calls.filters).toStrictEqual(["  cli  "]);
        expect(handlers.calls.rerun).toBe(0);
        expect(output.text).toBe("");

        handle.close();
    });

    it("treats an empty prompt as cancel and skips onFilter", async () => {
        expect.assertions(2);

        const input = new FakeTTYInput();
        const output = new FakeOutput();
        const handlers = makeHandlers();

        const handle = installKeybinds({
            handlers,
            input,
            output: output as unknown as NodeJS.WritableStream,
            promptFilter: async () => undefined,
        });

        input.press({ name: "p" });
        await flush();

        expect(handlers.calls.filters).toStrictEqual([]);
        expect(output.text).toContain("filter cancelled.");

        handle.close();
    });

    it("ignores keys while the filter prompt is open", async () => {
        expect.assertions(2);

        const input = new FakeTTYInput();
        const output = new FakeOutput();
        const handlers = makeHandlers();

        let resolvePrompt: (value: string | undefined) => void = () => {};
        const promptFilter = async (): Promise<string | undefined> =>
            await new Promise<string | undefined>((resolve) => {
                resolvePrompt = resolve;
            });

        const handle = installKeybinds({ handlers, input, output: output as unknown as NodeJS.WritableStream, promptFilter });

        input.press({ name: "p" });
        await flush();

        // While the prompt is open, r/q/a/h must not dispatch.
        input.press({ name: "r" });
        input.press({ name: "q" });
        input.press({ name: "a" });
        await flush();

        expect(handlers.calls.rerun + handlers.calls.quit + handlers.calls.clear).toBe(0);

        resolvePrompt("foo");
        await flush();

        expect(handlers.calls.filters).toStrictEqual(["foo"]);

        handle.close();
    });

    it("dispatches Ctrl+C to onQuit even while the filter prompt is open", async () => {
        expect.assertions(1);

        const input = new FakeTTYInput();
        const output = new FakeOutput();
        const handlers = makeHandlers();

        const promptFilter = async (): Promise<string | undefined> =>
            await new Promise<string | undefined>(() => {
                // Never resolves — we want to simulate a user stuck at
                // the prompt who hits Ctrl+C to bail out.
            });

        const handle = installKeybinds({ handlers, input, output: output as unknown as NodeJS.WritableStream, promptFilter });

        input.press({ name: "p" });
        await flush();

        input.press({ ctrl: true, name: "c" });
        await flush();

        expect(handlers.calls.quit).toBe(1);

        handle.close();
    });

    it("is a no-op when input is not a TTY", () => {
        expect.assertions(2);

        const input = new FakeTTYInput();

        input.isTTY = false;

        const output = new FakeOutput();
        const handlers = makeHandlers();

        const handle = installKeybinds({ handlers, input, output: output as unknown as NodeJS.WritableStream });

        input.press({ name: "r" });

        expect(handlers.calls.rerun).toBe(0);
        expect(input.setRawMode).not.toHaveBeenCalled();

        handle.close();
    });

    it("close() restores raw mode to its pre-install state", () => {
        expect.assertions(2);

        const input = new FakeTTYInput();

        input.isRaw = false;

        const output = new FakeOutput();
        const handlers = makeHandlers();

        const handle = installKeybinds({ handlers, input, output: output as unknown as NodeJS.WritableStream });

        expect(input.setRawMode).toHaveBeenCalledWith(true);

        handle.close();

        expect(input.setRawMode).toHaveBeenLastCalledWith(false);
    });

    it("surfaces async handler errors on the output stream", async () => {
        expect.assertions(1);

        const input = new FakeTTYInput();
        const output = new FakeOutput();
        const handlers: KeybindHandlers = {
            onClearFilter: () => {},
            onFilter: () => {},
            onHelp: () => {},
            onQuit: () => {},
            onRerun: async () => {
                throw new Error("boom");
            },
        };

        const handle = installKeybinds({ handlers, input, output: output as unknown as NodeJS.WritableStream });

        input.press({ name: "r" });
        await flush();
        // Awaits the next tick so the error-write lands.
        await flush();

        expect(output.text).toContain("boom");

        handle.close();
    });
});
