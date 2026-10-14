import { Readable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";

import { describe, expect, it, vi } from "vitest";

import { Text } from "../../src/components/index";
import { useApp } from "../../src/ink/hooks/use-app";
import { useFocus } from "../../src/ink/hooks/use-focus";
import { useInput } from "../../src/ink/hooks/use-input";
import { usePaste } from "../../src/ink/hooks/use-paste";
import { render } from "../../src/ink/index";
import { createInputParser } from "../../src/ink/input-parser";
import { resolveFlags } from "../../src/ink/kitty-keyboard";
import parseKeypress from "../../src/ink/parse-keypress";
import { createStdin, emitReadable } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";

// Helpers --------------------------------------------------------------------

const parseChunks = (chunks: string[]): string[] => {
    const parser = createInputParser();
    const events: string[] = [];

    for (const chunk of chunks) {
        for (const event of parser.push(chunk)) {
            if (typeof event === "string") {
                events.push(event);
            }
        }
    }

    return events;
};

// A real Readable so read()/readable ordering matches a terminal stdin.
const createTtyStdin = () => {
    const stdin = Object.assign(new Readable({ read() {} }), {
        isTTY: true,
        setRawMode() {
            return stdin;
        },
    });

    return stdin as unknown as NodeJS.ReadStream & Readable;
};

const createDetectionApp = (options: { interactive?: boolean; onQuery?: (stdin: Readable) => void } = {}) => {
    const stdin = createTtyStdin();
    const stdout = createStdout();
    const inputs: string[] = [];
    const writes: string[] = [];

    stdout.write = (data: string) => {
        writes.push(data);

        if (data === "\u001B[?u") {
            options.onQuery?.(stdin);
        }

        return true;
    };

    const Example = () => {
        useInput((input) => {
            inputs.push(input);
        });

        return <Text>Hello</Text>;
    };

    const app = render(<Example />, {
        interactive: options.interactive ?? true,
        kittyKeyboard: { mode: "auto" },
        stdin,
        stdout,
    });

    return { app, inputs, stdin, writes };
};

// Parser (input-parser) -------------------------------------------------------

describe("keyboard v8: input parser", () => {
    it("keeps rxvt shifted editing keys separate from following text", () => {
        expect.assertions(6);

        for (const key of [2, 3, 5, 6, 7, 8]) {
            const sequence = `\u001B[${String(key)}$`;

            expect(parseChunks([`${sequence}hello`])).toEqual([sequence, "hello"]);
        }
    });

    it("emits rxvt Shift+Delete as soon as its final byte arrives", () => {
        expect.assertions(4);

        const parser = createInputParser();

        expect(parser.push("\u001B[3")).toEqual([]);
        expect(parser.push("$")).toEqual(["\u001B[3$"]);
        expect(parser.hasPendingEscape()).toBe(false);
        expect(parser.push("hello")).toEqual(["hello"]);
    });

    it("parses consecutive rxvt shifted keys including meta", () => {
        expect.assertions(1);

        expect(parseChunks(["\u001B[3$\u001B\u001B[5$\u001B[A"])).toEqual(["\u001B[3$", "\u001B\u001B[5$", "\u001B[A"]);
    });

    it("preserves CSI intermediate bytes outside rxvt shifted keys", () => {
        expect.assertions(1);

        expect(parseChunks(["\u001B[1;", "2$", "yhello"])).toEqual(["\u001B[1;2$y", "hello"]);
    });

    it("preserves modified SS3 keys and the following text", () => {
        expect.assertions(3);

        for (const sequence of ["\u001BO2P", "\u001BO1;5A", "\u001B\u001BO5D"]) {
            expect(parseChunks([`${sequence}hello`])).toEqual([sequence, "hello"]);
        }
    });

    it("holds modified SS3 sequences until their final byte arrives", () => {
        expect.assertions(4);

        const parser = createInputParser();

        expect(parser.push("\u001BO1")).toEqual([]);
        expect(parser.hasPendingEscape()).toBe(true);
        expect(parser.push(";5")).toEqual([]);
        expect(parser.push("A")).toEqual(["\u001BO1;5A"]);
    });
});

// parseKeypress ----------------------------------------------------------------

const kittyKey = (codepoint: number, modifiers?: number, eventType?: number, text?: number[]): string => {
    let sequence = `\u001B[${String(codepoint)}`;

    if (modifiers !== undefined || eventType !== undefined || text !== undefined) {
        sequence += `;${String(modifiers ?? 1)}`;
    }

    if (eventType !== undefined) {
        sequence += `:${String(eventType)}`;
    }

    if (text !== undefined) {
        sequence += `;${text.join(":")}`;
    }

    return `${sequence}u`;
};

describe("keyboard v8: kitty CSI u parsing", () => {
    it("backspace release is reported as a release event", () => {
        expect.assertions(3);

        const key = parseKeypress(kittyKey(127, 1, 3));

        expect(key.name).toBe("backspace");
        expect(key.eventType).toBe("release");
        expect(key.isPrintable).toBe(false);
    });

    it("uppercase shift uses the unshifted key code", () => {
        expect.assertions(3);

        const key = parseKeypress(kittyKey(97, 2));

        expect(key.name).toBe("a");
        expect(key.shift).toBe(true);
        expect(key.ctrl).toBe(false);
    });

    it("ctrl letters use the unshifted key code and remain printable text", () => {
        expect.assertions(4);

        const key = parseKeypress(kittyKey(97, 5));

        expect(key.name).toBe("a");
        expect(key.ctrl).toBe(true);
        expect(key.isPrintable).toBe(true);
        expect(key.text).toBe("a");
    });

    it("accepts alternate key codes and keeps the primary key event", () => {
        expect.assertions(15);

        for (const sequence of ["\u001B[97:65;6:2;65u", "\u001B[97:65:113;6:2;65u", "\u001B[97::113;6:2;65u"]) {
            const key = parseKeypress(sequence);

            expect(key.name).toBe("a");
            expect(key.text).toBe("A");
            expect(key.ctrl).toBe(true);
            expect(key.shift).toBe(true);
            expect(key.eventType).toBe("repeat");
        }
    });

    it("text-only events have no key identity", () => {
        expect.assertions(3);

        const key = parseKeypress("\u001B[0;;229:128169u");

        expect(key.name).toBe("");
        expect(key.text).toBe("å💩");
        expect(key.isPrintable).toBe(true);
    });

    it("unknown functional and control codes do not invent printable characters", () => {
        expect.assertions(16);

        for (const codepoint of [0, 1, 3, 31, 128, 159, 57_344, 63_743]) {
            const key = parseKeypress(`\u001B[${String(codepoint)}u`);

            expect(key.name).toBe("");
            expect(key.isPrintable).toBe(false);
        }
    });

    it("keypad digits and operators carry printable associated text", () => {
        expect.assertions(8);

        for (const [sequence, name, text] of [
            ["\u001B[57399;129;48u", "kp0", "0"],
            ["\u001B[57413;1;43u", "kpadd", "+"],
        ] as const) {
            const key = parseKeypress(sequence);

            expect(key.name).toBe(name);
            expect(key.text).toBe(text);
            expect(key.isPrintable).toBe(true);
            expect(key.isKittyProtocol).toBe(true);
        }
    });

    it("keypad Enter produces a return key with carriage return text", () => {
        expect.assertions(14);

        for (const [sequence, shift, eventType] of [
            ["\u001B[57414u", false, "press"],
            ["\u001B[57414;2:2u", true, "repeat"],
        ] as const) {
            const key = parseKeypress(sequence);

            expect(key.name).toBe("return");
            expect(key.text).toBe("\r");
            expect(key.isPrintable).toBe(true);
            expect(key.isKittyProtocol).toBe(true);
            expect(key.sequence).toBe(sequence);
            expect(key.shift).toBe(shift);
            expect(key.eventType).toBe(eventType);
        }
    });

    it("keypad navigation keys use standard key names", () => {
        expect.assertions(10);

        for (const [codepoint, name] of [
            [57_417, "left"],
            [57_418, "right"],
            [57_419, "up"],
            [57_420, "down"],
            [57_421, "pageup"],
            [57_422, "pagedown"],
            [57_423, "home"],
            [57_424, "end"],
            [57_425, "insert"],
            [57_426, "delete"],
        ] as const) {
            const key = parseKeypress(`\u001B[${String(codepoint)};5:2u`);

            expect(key.name).toBe(name);
        }
    });

    it("keypad Begin supports both functional encodings", () => {
        expect.assertions(4);

        for (const sequence of ["\u001B[1E", "\u001B[57427~", "\u001B[1;1:2E", "\u001B[57427;1:2~"]) {
            expect(parseKeypress(sequence).name).toBe("clear");
        }
    });

    it("functional keys carry modifiers without an explicit event type", () => {
        expect.assertions(4);

        for (const [sequence, name] of [
            ["\u001B[1;249A", "up"],
            ["\u001B[3;249~", "delete"],
            ["\u001B[13;249~", "f3"],
            ["\u001B[1;249P", "f1"],
        ] as const) {
            const key = parseKeypress(sequence);

            expect(key).toMatchObject({
                capsLock: true,
                ctrl: false,
                eventType: "press",
                hyper: true,
                isPrintable: false,
                meta: true,
                name,
                numLock: true,
                super: true,
            });
        }
    });

    it("kitty modifiers and event types agree across key encodings", () => {
        expect.assertions(192);

        const modifierNames = ["shift", "option", "ctrl", "super", "hyper", "meta", "capsLock", "numLock"] as const;
        const eventSuffixes = [
            ["", "press"],
            [":1", "press"],
            [":2", "repeat"],
            [":3", "release"],
        ] as const;

        // Bit values from the kitty spec; `option` is the Alt bit.
        const bits = [1, 2, 4, 8, 16, 32, 64, 128];

        for (const [index, modifierName] of modifierNames.entries()) {
            for (const [suffix, eventType] of eventSuffixes) {
                const modifiers = `${String(bits[index]! + 1)}${suffix}`;

                for (const sequence of [`\u001B[97;${modifiers}u`, `\u001B[1;${modifiers}A`, `\u001B[3;${modifiers}~`]) {
                    const key = parseKeypress(sequence);

                    expect(key[modifierName], `${modifierName} in ${sequence}`).toBe(true);
                    expect(key.eventType, `event in ${sequence}`).toBe(eventType);
                }
            }
        }
    });

    it("kitty Ctrl+meta combinations parse as legacy-free kitty modifiers", () => {
        expect.assertions(2);

        // Legacy xterm modifier 9 means meta; under kitty encoding bit 8 is Super.
        const key = parseKeypress("\u001B[1;9A");

        expect(key.super).toBe(true);
        expect(key.meta).toBe(false);
    });
});

describe("keyboard v8: legacy parsing", () => {
    it("ctrl+Space keeps the space key with the ctrl modifier", () => {
        expect.assertions(8);

        for (const sequence of ["\u0000", "\u001B\u0000"]) {
            const key = parseKeypress(sequence);

            expect(key.name).toBe("space");
            expect(key.ctrl).toBe(true);
            expect(key.meta).toBe(sequence.length === 2);
            expect(key.shift).toBe(false);
        }
    });

    it("ctrl+punctuation shortcuts keep the punctuation name", () => {
        expect.assertions(32);

        for (const [character, name] of [
            ["\u001C", "\\"],
            ["\u001D", "]"],
            ["\u001E", "^"],
            ["\u001F", "_"],
        ] as const) {
            for (const prefix of ["", "\u001B"]) {
                const key = parseKeypress(prefix + character);

                expect(key.name).toBe(name);
                expect(key.ctrl).toBe(true);
                expect(key.meta).toBe(prefix.length > 0);
                expect(key.shift).toBe(false);
            }
        }
    });

    it("meta+Tab preserves the tab key and meta modifier", () => {
        expect.assertions(2);

        const key = parseKeypress("\u001B\t");

        expect(key.name).toBe("tab");
        expect(key.meta).toBe(true);
    });

    it("ctrl+Meta+letter keeps the letter, ctrl and meta", () => {
        expect.assertions(3);

        const key = parseKeypress("\u001B\u0002");

        expect(key.name).toBe("b");
        expect(key.ctrl).toBe(true);
        expect(key.meta).toBe(true);
    });

    it("does not mutate a caller-owned Buffer when parsing a meta key", () => {
        expect.assertions(2);

        const buffer = Buffer.from([0xe1]);

        parseKeypress(buffer);

        expect(buffer[0]).toBe(0xe1);
        expect(buffer).toHaveLength(1);
    });

    it("backspace and escape keep their names with and without meta", () => {
        expect.assertions(4);

        expect(parseKeypress("\u007F").name).toBe("backspace");
        expect(parseKeypress("\b").name).toBe("backspace");
        expect(parseKeypress("\u001B").name).toBe("escape");
        expect(parseKeypress("\u001B\u007F").meta).toBe(true);
    });

    it("parses modified SS3 arrows as the same keys as CSI", () => {
        expect.assertions(2);

        const key = parseKeypress("\u001BO1;5A");

        expect(key.name).toBe("up");
        expect(key.ctrl).toBe(true);
    });
});

// Kitty flags --------------------------------------------------------------------

describe("keyboard v8: kitty flags", () => {
    it("reportAssociatedText enables reportAllKeysAsEscapeCodes", () => {
        expect.assertions(2);

        expect(resolveFlags(["reportAssociatedText"])).toBe(24);
        expect(resolveFlags(["disambiguateEscapeCodes", "reportAssociatedText"])).toBe(25);
    });
});

// Hook and App level -------------------------------------------------------------

describe("keyboard v8: exit and focus keys", () => {
    const exitCases = [
        { exitOnCtrlC: true, input: "\u0003", name: "legacy Ctrl+C", shouldExit: true },
        { exitOnCtrlC: true, input: "\u001B[99;5u", name: "kitty Ctrl+C", shouldExit: true },
        { exitOnCtrlC: true, input: "\u001B[99;5:2u", name: "kitty Ctrl+C repeat", shouldExit: true },
        { exitOnCtrlC: true, input: "\u001B[99;5:3u", name: "kitty Ctrl+C release", shouldExit: false },
        { exitOnCtrlC: false, input: "\u001B[99;5u", name: "kitty Ctrl+C with automatic exit disabled", shouldExit: false },
        { exitOnCtrlC: true, input: "\u001B[99u", name: "kitty c without Ctrl", shouldExit: false },
    ] as const;

    for (const { exitOnCtrlC, input, name, shouldExit } of exitCases) {
        it(`automatic exit handles ${name}`, async () => {
            expect.assertions(2);

            let inputReceived = false;
            const Input = () => {
                useInput(() => {
                    inputReceived = true;
                });

                return null;
            };

            const stdin = createStdin();
            const stdout = createStdout();
            const instance = render(<Input />, { exitOnCtrlC, stdin, stdout });
            let exited = false;

            const exitPromise = instance.waitUntilExit().then(() => {
                exited = true;
            });

            emitReadable(stdin, input);
            await delay(10);

            expect(exited).toBe(shouldExit);
            expect(inputReceived).toBe(!shouldExit);

            instance.unmount();
            await exitPromise;
        });
    }

    it("kitty Tab moves focus forward, Shift+Tab backward, and release is ignored", async () => {
        expect.assertions(4);

        const Item = ({ autoFocus = false, label }: { readonly autoFocus?: boolean; readonly label: string }) => {
            const { isFocused } = useFocus({ autoFocus });

            return <Text>{isFocused ? `${label} *` : label}</Text>;
        };

        const Test = () => (
            <>
                <Item autoFocus label="First" />
                <Item label="Second" />
                <Item label="Third" />
            </>
        );

        const stdin = createStdin();
        const stdout = createStdout();
        const instance = render(<Test />, { debug: true, stdin, stdout });

        await delay(10);

        expect(stdout.get()).toContain("First *");

        emitReadable(stdin, "\u001B[9u");
        await delay(10);

        expect(stdout.get()).toContain("Second *");

        emitReadable(stdin, "\u001B[9;2u");
        await delay(10);

        expect(stdout.get()).toContain("First *");

        emitReadable(stdin, "\u001B[9;1:3u");
        await delay(10);

        expect(stdout.get()).toContain("First *");

        instance.unmount();
    });
});

// Rerender stability ------------------------------------------------------------

describe("keyboard v8: rerender keeps input state", () => {
    it("rerender() keeps a pending Escape keypress", async () => {
        expect.assertions(1);

        const stdin = createStdin();
        const stdout = createStdout();
        const keys: string[] = [];

        const Example = ({ label }: { readonly label: string }) => {
            useInput((_input, key) => {
                keys.push(key.escape ? "escape" : "other");
            });

            return <Text>{label}</Text>;
        };

        const app = render(<Example label="a" />, { interactive: true, stdin, stdout });

        emitReadable(stdin, "\u001B");
        app.rerender(<Example label="b" />);
        await delay(60);

        expect(keys).toEqual(["escape"]);

        app.unmount();
    });

    it("rerender() keeps an escape sequence that spans two reads", () => {
        expect.assertions(1);

        const stdin = createStdin();
        const stdout = createStdout();
        const keys: { input: string; upArrow: boolean }[] = [];

        const Example = ({ label }: { readonly label: string }) => {
            useInput((input, key) => {
                keys.push({ input, upArrow: key.upArrow });
            });

            return <Text>{label}</Text>;
        };

        const app = render(<Example label="a" />, { interactive: true, stdin, stdout });

        emitReadable(stdin, "\u001B[");
        app.rerender(<Example label="b" />);
        emitReadable(stdin, "A");

        expect(keys).toEqual([{ input: "", upArrow: true }]);

        app.unmount();
    });

    it("rerender() keeps a bracketed paste that spans two reads", () => {
        expect.assertions(2);

        const stdin = createStdin();
        const stdout = createStdout();
        const inputs: string[] = [];
        const pastes: string[] = [];

        const Example = ({ label }: { readonly label: string }) => {
            useInput((input) => {
                inputs.push(input);
            });
            usePaste((text) => {
                pastes.push(text);
            });

            return <Text>{label}</Text>;
        };

        const app = render(<Example label="a" />, { interactive: true, stdin, stdout });

        emitReadable(stdin, "\u001B[200~part1");
        app.rerender(<Example label="b" />);
        emitReadable(stdin, "part2\u001B[201~");

        expect(pastes).toEqual(["part1part2"]);
        expect(inputs).toEqual([]);

        app.unmount();
    });

    it("rerender() does not detach and reattach the stdin readable listener", () => {
        expect.assertions(1);

        const stdin = createStdin();
        const stdout = createStdout();
        let removed = 0;

        stdin.on("removeListener", (event: string) => {
            if (event === "readable") {
                removed++;
            }
        });

        const Example = ({ label }: { readonly label: string }) => {
            useInput(() => {});

            return <Text>{label}</Text>;
        };

        const app = render(<Example label="a" />, { interactive: true, stdin, stdout });

        app.rerender(<Example label="b" />);

        expect(removed).toBe(0);

        app.unmount();
    });
});

// Kitty negotiation -------------------------------------------------------------

describe("keyboard v8: kitty auto detection", () => {
    it("enables the protocol when the query is answered synchronously", async () => {
        expect.assertions(2);

        const { app, inputs, writes } = createDetectionApp({
            onQuery: (stdin) => {
                stdin.push("\u001B[?1u");
            },
        });

        await delay(30);

        expect(writes).toContain("\u001B[>1u");
        expect(inputs).toEqual([]);

        app.unmount();
    });

    it("enables the protocol and keeps input around the response", async () => {
        expect.assertions(2);

        const { app, inputs, stdin, writes } = createDetectionApp();

        stdin.push("x\u001B[?0u");
        await delay(30);

        expect(inputs).toEqual(["x"]);
        expect(writes).toContain("\u001B[>1u");

        app.unmount();
    });

    it("handles a response split across reads with surrounding input", async () => {
        expect.assertions(2);

        const { app, inputs, stdin, writes } = createDetectionApp();

        stdin.push("before\u001B[?");
        await delay(1);
        stdin.push("0uafter");
        await delay(30);

        expect(writes).toContain("\u001B[>1u");
        expect(inputs).toEqual(["before", "after"]);

        app.unmount();
    });

    it("timeout does not enable the protocol for a partial query response", async () => {
        expect.assertions(2);

        const { app, inputs, stdin, writes } = createDetectionApp();

        stdin.push("\u001B[?");
        await delay(250);

        expect(writes).not.toContain("\u001B[>1u");
        // An unnamed CSI sequence is dropped rather than typed as text.
        expect(inputs).toEqual([]);

        app.unmount();
    });

    it("a late CSI ? u without a flags number does not enable the protocol", async () => {
        expect.assertions(2);

        const { app, inputs, stdin, writes } = createDetectionApp();

        stdin.push("\u001B[?u");
        await delay(250);

        expect(writes).not.toContain("\u001B[>1u");
        expect(inputs).toEqual([]);

        app.unmount();
    });

    it("pasted query responses remain input and do not enable the protocol", async () => {
        expect.assertions(2);

        const { app, inputs, stdin, writes } = createDetectionApp();

        stdin.push("\u001B[200~\u001B[?0u\u001B[201~");
        await delay(30);

        expect(writes).not.toContain("\u001B[>1u");
        // Paste is never treated as a protocol reply; the unnamed sequence is then dropped as control traffic.
        expect(inputs).toEqual([]);

        app.unmount();
    });

    it("does not enable the protocol after unmount", async () => {
        expect.assertions(1);

        const { app, stdin, writes } = createDetectionApp();

        app.unmount();
        stdin.push("\u001B[?1u");
        await delay(30);

        expect(writes).not.toContain("\u001B[>1u");
    });

    it("suspension cancels pending keyboard negotiation", async () => {
        expect.assertions(2);

        const stdin = createTtyStdin();
        const stdout = createStdout();
        const writes = stdout.getWrites;
        let suspendTerminal!: ReturnType<typeof useApp>["suspendTerminal"];

        const Example = () => {
            suspendTerminal = useApp().suspendTerminal;
            useInput(() => {});

            return null;
        };

        const app = render(<Example />, {
            alternateScreen: true,
            interactive: true,
            kittyKeyboard: { mode: "auto" },
            stdin,
            stdout,
        });

        const suspension = await suspendTerminal();
        const before = writes().length;

        stdin.push("\u001B[?1u");
        await delay(30);

        expect(writes().slice(before)).toEqual([]);

        await suspension?.resume();

        expect(writes()).not.toContain("\u001B[>1u");

        app.unmount();
    });

    it("auto mode queries the terminal without any known-terminal environment", async () => {
        expect.assertions(1);

        vi.stubEnv("KITTY_WINDOW_ID", "");
        vi.stubEnv("TERM_PROGRAM", "");
        vi.stubEnv("TERM", "xterm-256color");

        try {
            const { app, writes } = createDetectionApp();

            await delay(5);

            expect(writes).toContain("\u001B[?u");

            app.unmount();
        } finally {
            vi.unstubAllEnvs();
        }
    });
});

describe("keyboard v8: hook-level key routing", () => {
    const cases = [
        { expected: { capsLock: true, input: "A", shift: false }, input: "\u001B[97;65;65u", name: "kitty Caps Lock uppercase text" },
        { expected: { ctrl: true, input: "a" }, input: "\u001B[97;5u", name: "kitty ctrl+a" },
        { expected: { ctrl: true, input: " " }, input: "\u0000", name: "legacy ctrl+space" },
        { expected: { input: "å" }, input: "\u001B[0;;229u", name: "kitty associated text" },
        { expected: { input: "\r", return: true }, input: "\u001B[57414u", name: "kitty keypad enter" },
    ] as const;

    for (const { expected, input, name } of cases) {
        it(`useInput receives ${name}`, async () => {
            expect.hasAssertions();

            const received: { input: string; key: Record<string, unknown> }[] = [];
            const Example = () => {
                useInput((value, key) => {
                    received.push({ input: value, key: { ...key } });
                });

                return null;
            };

            const stdin = createStdin();
            const stdout = createStdout();
            const instance = render(<Example />, { stdin, stdout });

            emitReadable(stdin, input);
            await delay(10);

            expect(received).toHaveLength(1);
            expect(received[0]!.input).toBe(expected.input);

            for (const [field, value] of Object.entries(expected)) {
                if (field !== "input") {
                    expect(received[0]!.key[field]).toBe(value);
                }
            }

            instance.unmount();
        });
    }

    it("kitty Escape clears focus, and its release does not", async () => {
        expect.hasAssertions();

        const Item = ({ autoFocus = false, label }: { readonly autoFocus?: boolean; readonly label: string }) => {
            const { isFocused } = useFocus({ autoFocus });

            return <Text>{isFocused ? `${label} *` : label}</Text>;
        };

        const stdin = createStdin();
        const stdout = createStdout();
        const instance = render(<Item autoFocus label="First" />, { debug: true, stdin, stdout });

        await delay(10);

        expect(stdout.get()).toContain("First *");

        emitReadable(stdin, "\u001B[27;1:3u");
        await delay(10);

        expect(stdout.get()).toContain("First *");

        emitReadable(stdin, "\u001B[27u");
        await delay(10);

        expect(stdout.get()).not.toContain("First *");

        instance.unmount();
    });

    it("kitty Ctrl+C with exitOnCtrlC drops text that follows it in the same chunk", async () => {
        expect.hasAssertions();

        const received: string[] = [];
        const Example = () => {
            useInput((value) => {
                received.push(value);
            });

            return null;
        };

        const stdin = createStdin();
        const stdout = createStdout();
        const instance = render(<Example />, { exitOnCtrlC: true, stdin, stdout });
        const exited = instance.waitUntilExit();

        emitReadable(stdin, "\u001B[99;5ux");
        await delay(10);

        expect(received).not.toContain("x");

        await exited;
    });
});

describe("keyboard v8: suspension and unmount", () => {
    it("unmount while suspended does not re-enable the protocol", async () => {
        expect.assertions(2);

        const stdin = createTtyStdin();
        const stdout = createStdout();
        let suspendTerminal!: ReturnType<typeof useApp>["suspendTerminal"];

        const Example = () => {
            suspendTerminal = useApp().suspendTerminal;
            useInput(() => {});

            return null;
        };

        const app = render(<Example />, {
            alternateScreen: true,
            interactive: true,
            kittyKeyboard: { mode: "enabled" },
            stdin,
            stdout,
        });

        const suspension = await suspendTerminal();

        app.unmount();
        await suspension?.resume();

        expect(stdout.getWrites().filter((value) => value === "\u001B[>1u")).toHaveLength(1);
        expect(stdout.getWrites().filter((value) => value === "\u001B[<u")).toHaveLength(1);
    });
});
