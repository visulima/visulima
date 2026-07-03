import EventEmitter from "node:events";

import { describe, expect, it, vi } from "vitest";

import { Text } from "../../src/components/index";
import { render } from "../../src/ink/index";
import parseKeypress from "../../src/ink/parse-keypress";

// Helper to create kitty protocol CSI u sequences
const kittyKey = (codepoint: number, modifiers?: number, eventType?: number, textCodepoints?: number[]): string => {
    let seq = `\u001B[${String(codepoint)}`;

    if (modifiers !== undefined || eventType !== undefined || textCodepoints !== undefined) {
        seq += `;${String(modifiers ?? 1)}`;
    }

    if (eventType !== undefined || textCodepoints !== undefined) {
        seq += `:${String(eventType ?? 1)}`;
    }

    if (textCodepoints !== undefined) {
        seq += `;${textCodepoints.join(":")}`;
    }

    seq += "u";

    return seq;
};

describe("kitty-keyboard", () => {
    it("kitty protocol - simple character", () => {
        expect.assertions(6);

        const result = parseKeypress(kittyKey(97));

        expect(result.name).toBe("a");
        expect(result.ctrl).toBe(false);
        expect(result.shift).toBe(false);
        expect(result.meta).toBe(false);
        expect(result.eventType).toBe("press");
        expect(result.isKittyProtocol).toBe(true);
    });

    it("kitty protocol - uppercase character (shift)", () => {
        expect.assertions(4);

        const result = parseKeypress(kittyKey(65, 2));

        expect(result.name).toBe("a");
        expect(result.shift).toBe(true);
        expect(result.ctrl).toBe(false);
        expect(result.eventType).toBe("press");
    });

    it("kitty protocol - ctrl modifier", () => {
        expect.assertions(4);

        const result = parseKeypress(kittyKey(97, 5));

        expect(result.name).toBe("a");
        expect(result.ctrl).toBe(true);
        expect(result.shift).toBe(false);
        expect(result.eventType).toBe("press");
    });

    it("kitty protocol - alt/option modifier", () => {
        expect.assertions(4);

        const result = parseKeypress(kittyKey(97, 3));

        expect(result.name).toBe("a");
        expect(result.option).toBe(true);
        expect(result.ctrl).toBe(false);
        expect(result.eventType).toBe("press");
    });

    it("kitty protocol - super modifier", () => {
        expect.assertions(4);

        const result = parseKeypress(kittyKey(97, 9));

        expect(result.name).toBe("a");
        expect(result.super).toBe(true);
        expect(result.ctrl).toBe(false);
        expect(result.eventType).toBe("press");
    });

    it("kitty protocol - hyper modifier", () => {
        expect.assertions(4);

        const result = parseKeypress(kittyKey(97, 17));

        expect(result.name).toBe("a");
        expect(result.hyper).toBe(true);
        expect(result.super).toBe(false);
        expect(result.eventType).toBe("press");
    });

    it("kitty protocol - meta modifier", () => {
        expect.assertions(3);

        const result = parseKeypress(kittyKey(97, 33));

        expect(result.name).toBe("a");
        expect(result.meta).toBe(true);
        expect(result.eventType).toBe("press");
    });

    it("kitty protocol - caps lock", () => {
        expect.assertions(3);

        const result = parseKeypress(kittyKey(97, 65));

        expect(result.name).toBe("a");
        expect(result.capsLock).toBe(true);
        expect(result.eventType).toBe("press");
    });

    it("kitty protocol - num lock", () => {
        expect.assertions(3);

        const result = parseKeypress(kittyKey(97, 129));

        expect(result.name).toBe("a");
        expect(result.numLock).toBe(true);
        expect(result.eventType).toBe("press");
    });

    it("kitty protocol - combined modifiers (ctrl+shift)", () => {
        expect.assertions(5);

        const result = parseKeypress(kittyKey(97, 6));

        expect(result.name).toBe("a");
        expect(result.ctrl).toBe(true);
        expect(result.shift).toBe(true);
        expect(result.meta).toBe(false);
        expect(result.eventType).toBe("press");
    });

    it("kitty protocol - combined modifiers (super+ctrl)", () => {
        expect.assertions(5);

        const result = parseKeypress(kittyKey(115, 13));

        expect(result.name).toBe("s");
        expect(result.super).toBe(true);
        expect(result.ctrl).toBe(true);
        expect(result.shift).toBe(false);
        expect(result.eventType).toBe("press");
    });

    it("kitty protocol - escape key", () => {
        expect.assertions(2);

        const result = parseKeypress(kittyKey(27));

        expect(result.name).toBe("escape");
        expect(result.eventType).toBe("press");
    });

    it("kitty protocol - return/enter key", () => {
        expect.assertions(2);

        const result = parseKeypress(kittyKey(13));

        expect(result.name).toBe("return");
        expect(result.eventType).toBe("press");
    });

    it("kitty protocol - tab key", () => {
        expect.assertions(2);

        const result = parseKeypress(kittyKey(9));

        expect(result.name).toBe("tab");
        expect(result.eventType).toBe("press");
    });

    it("kitty protocol - backspace key", () => {
        expect.assertions(2);

        const result = parseKeypress(kittyKey(8));

        expect(result.name).toBe("backspace");
        expect(result.eventType).toBe("press");
    });

    it("kitty protocol - backspace key (codepoint 127)", () => {
        expect.assertions(2);

        const result = parseKeypress(kittyKey(127));

        expect(result.name).toBe("backspace");
        expect(result.eventType).toBe("press");
    });

    it("kitty protocol - space key", () => {
        expect.assertions(2);

        const result = parseKeypress(kittyKey(32));

        expect(result.name).toBe("space");
        expect(result.eventType).toBe("press");
    });

    it("kitty protocol - event type press", () => {
        expect.assertions(2);

        const result = parseKeypress(kittyKey(97, 1, 1));

        expect(result.name).toBe("a");
        expect(result.eventType).toBe("press");
    });

    it("kitty protocol - event type repeat", () => {
        expect.assertions(2);

        const result = parseKeypress(kittyKey(97, 1, 2));

        expect(result.name).toBe("a");
        expect(result.eventType).toBe("repeat");
    });

    it("kitty protocol - event type release", () => {
        expect.assertions(2);

        const result = parseKeypress(kittyKey(97, 1, 3));

        expect(result.name).toBe("a");
        expect(result.eventType).toBe("release");
    });

    it("kitty protocol - number keys", () => {
        expect.assertions(2);

        const result = parseKeypress(kittyKey(49));

        expect(result.name).toBe("1");
        expect(result.eventType).toBe("press");
    });

    it("kitty protocol - special character", () => {
        expect.assertions(2);

        const result = parseKeypress(kittyKey(64));

        expect(result.name).toBe("@");
        expect(result.eventType).toBe("press");
    });

    it("kitty protocol - ctrl+letter produces codepoint 1-26", () => {
        expect.assertions(2);

        const result = parseKeypress(kittyKey(1, 5));

        expect(result.name).toBe("a");
        expect(result.ctrl).toBe(true);
    });

    it("kitty protocol - preserves sequence and raw", () => {
        expect.assertions(2);

        const seq = kittyKey(97, 5);
        const result = parseKeypress(seq);

        expect(result.sequence).toBe(seq);
        expect(result.raw).toBe(seq);
    });

    it("kitty protocol - text-as-codepoints field", () => {
        expect.assertions(4);

        const result = parseKeypress(kittyKey(97, 2, 1, [65]));

        expect(result.name).toBe("a");
        expect(result.text).toBe("A");
        expect(result.shift).toBe(true);
        expect(result.isKittyProtocol).toBe(true);
    });

    it("kitty protocol - supplementary unicode codepoint", () => {
        expect.assertions(2);

        const result = parseKeypress(kittyKey(128_512));

        expect(result.name).toBe("😀");
        expect(result.isKittyProtocol).toBe(true);
    });

    it("kitty protocol - invalid codepoint above U+10FFFF returns safe empty keypress", () => {
        expect.assertions(4);

        const result = parseKeypress("\u001B[1114112u");

        expect(result.name).toBe("");
        expect(result.ctrl).toBe(false);
        expect(result.isKittyProtocol).toBe(true);
        expect(result.isPrintable).toBe(false);
    });

    it("kitty protocol - surrogate codepoint returns safe empty keypress", () => {
        expect.assertions(4);

        const result = parseKeypress("\u001B[55296u");

        expect(result.name).toBe("");
        expect(result.ctrl).toBe(false);
        expect(result.isKittyProtocol).toBe(true);
        expect(result.isPrintable).toBe(false);
    });

    it("non-kitty sequences fall back to legacy parsing", () => {
        expect.assertions(2);

        const result = parseKeypress("\u001B[A");

        expect(result.name).toBe("up");
        expect(result.isKittyProtocol).toBeUndefined();
    });

    it("non-kitty sequences - ctrl+c", () => {
        expect.assertions(3);

        const result = parseKeypress("\u0003");

        expect(result.name).toBe("c");
        expect(result.ctrl).toBe(true);
        expect(result.isKittyProtocol).toBeUndefined();
    });

    it("kitty protocol - isPrintable is true for regular characters", () => {
        expect.assertions(1);

        const result = parseKeypress(kittyKey(97));

        expect(result.isPrintable).toBe(true);
    });

    it("kitty protocol - isPrintable is false for escape", () => {
        expect.assertions(1);

        const result = parseKeypress(kittyKey(27));

        expect(result.isPrintable).toBe(false);
    });

    it("kitty protocol - isPrintable is true for space", () => {
        expect.assertions(1);

        const result = parseKeypress(kittyKey(32));

        expect(result.isPrintable).toBe(true);
    });

    it("kitty protocol - isPrintable is false for backspace", () => {
        expect.assertions(1);

        const result = parseKeypress(kittyKey(8));

        expect(result.isPrintable).toBe(false);
    });

    it("kitty protocol - isPrintable is false for ctrl+letter", () => {
        expect.assertions(1);

        const result = parseKeypress(kittyKey(1, 5));

        expect(result.isPrintable).toBe(false);
    });

    it("kitty protocol - capslock (57358) is non-printable", () => {
        expect.assertions(3);

        const result = parseKeypress("\u001B[57358u");

        expect(result.name).toBe("capslock");
        expect(result.isPrintable).toBe(false);
        expect(result.isKittyProtocol).toBe(true);
    });

    it("kitty protocol - printscreen (57361) is non-printable", () => {
        expect.assertions(3);

        const result = parseKeypress("\u001B[57361u");

        expect(result.name).toBe("printscreen");
        expect(result.isPrintable).toBe(false);
        expect(result.isKittyProtocol).toBe(true);
    });

    it("kitty protocol - f13 (57376) is non-printable", () => {
        expect.assertions(3);

        const result = parseKeypress("\u001B[57376u");

        expect(result.name).toBe("f13");
        expect(result.isPrintable).toBe(false);
        expect(result.isKittyProtocol).toBe(true);
    });

    it("kitty protocol - space key has text field set to space character", () => {
        expect.assertions(1);

        const result = parseKeypress(kittyKey(32));

        expect(result.text).toBe(" ");
    });

    it("kitty protocol - return key has text field set to carriage return", () => {
        expect.assertions(1);

        const result = parseKeypress(kittyKey(13));

        expect(result.text).toBe("\r");
    });

    // Init/cleanup control sequence tests

    const createFakeStdout = () => {
        const stdout = new EventEmitter() as unknown as NodeJS.WriteStream;

        stdout.columns = 100;
        stdout.isTTY = true;
        const write = vi.fn<(...arguments_: unknown[]) => boolean>();

        stdout.write = write;

        return { stdout, write };
    };

    const createFakeStdin = () => {
        const stdin = new EventEmitter() as unknown as NodeJS.ReadStream;

        stdin.isTTY = true;
        (stdin as Record<string, unknown>).setRawMode = () => stdin;
        (stdin as Record<string, unknown>).read = () => undefined;
        vi.spyOn(stdin, "setRawMode").mockImplementation(() => stdin);
        stdin.setEncoding = () => stdin;
        vi.spyOn(stdin, "read").mockImplementation();

        return stdin;
    };

    const getWrittenStrings = (write: ReturnType<typeof vi.fn>): string[] => write.mock.calls.map((args: any) => args[0] as string);

    it("kitty protocol - writes enable sequence on init when mode is enabled", () => {
        expect.assertions(1);

        const { stdout, write } = createFakeStdout();
        const stdin = createFakeStdin();

        const { unmount } = render(<Text>Hello</Text>, {
            kittyKeyboard: { mode: "enabled" },
            stdin,
            stdout,
        });

        expect(getWrittenStrings(write)).toContain("\u001B[>1u");

        unmount();
    });

    it("kitty protocol - writes disable sequence on unmount", () => {
        expect.assertions(1);

        const { stdout, write } = createFakeStdout();
        const stdin = createFakeStdin();

        const { unmount } = render(<Text>Hello</Text>, {
            kittyKeyboard: { mode: "enabled" },
            stdin,
            stdout,
        });

        unmount();

        expect(getWrittenStrings(write)).toContain("\u001B[<u");
    });

    it("kitty protocol - not enabled when stdin is not a TTY", () => {
        expect.assertions(1);

        const { stdout, write } = createFakeStdout();
        const stdin = createFakeStdin();

        stdin.isTTY = false;

        const { unmount } = render(<Text>Hello</Text>, {
            kittyKeyboard: { mode: "enabled" },
            stdin,
            stdout,
        });

        expect(getWrittenStrings(write)).not.toContain("\u001B[>1u");

        unmount();
    });

    it("kitty protocol - not enabled when stdout is not a TTY", () => {
        expect.assertions(1);

        const { stdout, write } = createFakeStdout();

        stdout.isTTY = false;
        const stdin = createFakeStdin();

        const { unmount } = render(<Text>Hello</Text>, {
            kittyKeyboard: { mode: "enabled" },
            stdin,
            stdout,
        });

        expect(getWrittenStrings(write)).not.toContain("\u001B[>1u");

        unmount();
    });
});
