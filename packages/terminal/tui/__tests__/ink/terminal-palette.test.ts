import { EventEmitter } from "node:events";
import type { Writable } from "node:stream";

import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { clearTerminalPaletteCache, isTerminalPaletteQuerySupported, queryTerminalPalette, takeOscAnswers } from "../../src/ink/terminal-palette";

const BEL = "\u{7}";
const ESCAPE = "\u{1B}";
const OSC = `${ESCAPE}]`;

/**
 * A stdin stand-in that models the parts of stream flow the probe depends on.
 *
 * Recording the `unshift` call alone is not enough: a real stream keeps flowing after its last
 * `data` listener is removed, and an unshift into a flowing stream is re-emitted to nobody. This
 * tracks `flowing` so a test can assert the bytes are actually recoverable.
 */
class FakeStdin extends EventEmitter {
    public readonly unshifted: string[] = [];

    public flowing = false;

    public override on(event: string, listener: (...arguments_: unknown[]) => void): this {
        if (event === "data") {
            this.flowing = true;
        }

        return super.on(event, listener);
    }

    public pause(): this {
        this.flowing = false;

        return this;
    }

    public unshift(chunk: string): void {
        this.unshifted.push(chunk);
    }

    /** What a listener attaching after the probe would read. */
    public get recoverable(): string {
        return this.flowing ? "" : this.unshifted.join("");
    }

    public send(data: string): void {
        this.emit("data", data);
    }
}

/** A stdout stand-in that records what was written. */
const createStdout = (): Writable & { writes: string[] } => {
    const writes: string[] = [];

    return {
        write: (chunk: string) => {
            writes.push(chunk);

            return true;
        },
        writes,
    } as unknown as Writable & { writes: string[] };
};

/** What every indexed slot answers with in these fixtures. */
const SIXTEEN_GREYS = Array.from({ length: 16 }).fill("#102030");

const colorResponse = (ps: string, hex: string): string => {
    const channel = (offset: number) => hex.slice(offset, offset + 2).repeat(2);

    return `${OSC}${ps};rgb:${channel(1)}/${channel(3)}/${channel(5)}${BEL}`;
};

const fullPaletteResponse = (): string => {
    let response = colorResponse("10", "#ffffff") + colorResponse("11", "#000000") + colorResponse("12", "#ff0000");

    for (let index = 0; index < 16; index += 1) {
        response += colorResponse(`4;${String(index)}`, "#102030");
    }

    return response;
};

describe("terminal-palette", () => {
    it("isTerminalPaletteQuerySupported should detect supported terminals", () => {
        expect.assertions(1);

        const original = process.env["TERM_PROGRAM"];

        process.env["TERM_PROGRAM"] = "kitty";

        expect(isTerminalPaletteQuerySupported()).toBe(true);

        process.env["TERM_PROGRAM"] = "unknown-terminal";
        // May return true if TERM is xterm or WT_SESSION is set
        const isResult = isTerminalPaletteQuerySupported();

        expectTypeOf(isResult).toBeBoolean();

        if (original === undefined) {
            delete process.env["TERM_PROGRAM"];
        } else {
            process.env["TERM_PROGRAM"] = original;
        }
    });

    it("should detect WezTerm", () => {
        expect.assertions(1);

        const original = process.env["TERM_PROGRAM"];

        process.env["TERM_PROGRAM"] = "WezTerm";

        expect(isTerminalPaletteQuerySupported()).toBe(true);

        if (original === undefined) {
            delete process.env["TERM_PROGRAM"];
        } else {
            process.env["TERM_PROGRAM"] = original;
        }
    });

    it("should detect xterm via TERM variable", () => {
        expect.assertions(1);

        const originalProgram = process.env["TERM_PROGRAM"];
        const originalTerm = process.env["TERM"];

        process.env["TERM_PROGRAM"] = "";
        process.env["TERM"] = "xterm-256color";

        expect(isTerminalPaletteQuerySupported()).toBe(true);

        if (originalProgram === undefined) {
            delete process.env["TERM_PROGRAM"];
        } else {
            process.env["TERM_PROGRAM"] = originalProgram;
        }

        if (originalTerm === undefined) {
            delete process.env["TERM"];
        } else {
            process.env["TERM"] = originalTerm;
        }
    });

    describe(takeOscAnswers, () => {
        it("separates answers from application bytes", () => {
            expect.assertions(3);

            const result = takeOscAnswers(`q${colorResponse("11", "#112233")}uit`);

            expect(result.answers).toStrictEqual(["11;rgb:1111/2222/3333"]);
            expect(result.foreign).toBe("quit");
            expect(result.rest).toBe("");
        });

        it("carries an incomplete answer forward instead of emitting it", () => {
            expect.assertions(2);

            const response = colorResponse("10", "#445566");
            const first = takeOscAnswers(response.slice(0, 6));

            expect(first.answers).toStrictEqual([]);

            const second = takeOscAnswers(first.rest + response.slice(6));

            expect(second.answers).toStrictEqual(["10;rgb:4444/5555/6666"]);
        });

        it("holds back a trailing lone escape, which may begin the next answer", () => {
            expect.assertions(2);

            const result = takeOscAnswers(`ab${ESCAPE}`);

            expect(result.foreign).toBe("ab");
            expect(result.rest).toBe(ESCAPE);
        });

        it("accepts a string-terminated answer as well as a bell-terminated one", () => {
            expect.assertions(1);

            expect(takeOscAnswers(`${OSC}11;rgb:0000/0000/0000${ESCAPE}\\`).answers).toStrictEqual(["11;rgb:0000/0000/0000"]);
        });

        it("treats a stray bell as application input, not as an answer", () => {
            expect.assertions(2);

            const result = takeOscAnswers(BEL);

            expect(result.answers).toStrictEqual([]);
            expect(result.foreign).toBe(BEL);
        });

        it("pulls several answers out of one chunk", () => {
            expect.assertions(1);

            const chunk = colorResponse("10", "#010203") + colorResponse("11", "#040506") + colorResponse("4;7", "#070809");

            expect(takeOscAnswers(chunk).answers).toHaveLength(3);
        });
    });

    describe(queryTerminalPalette, () => {
        afterEach(() => {
            vi.useRealTimers();
        });

        it("sends all 19 queries in a single write", async () => {
            expect.assertions(3);

            const stdin = new FakeStdin();
            const stdout = createStdout();

            const query = queryTerminalPalette(stdin, stdout, 50);

            expect(stdout.writes).toHaveLength(1);
            // Nineteen queries, one round trip: previously each waited for the last to time out.
            expect(stdout.writes[0]?.split(BEL).filter(Boolean)).toHaveLength(19);

            stdin.send(fullPaletteResponse());

            await expect(query).resolves.toStrictEqual({
                background: "#000000",
                colors: SIXTEEN_GREYS,
                cursor: "#ff0000",
                foreground: "#ffffff",
            });

            clearTerminalPaletteCache(stdout);
        });

        it("resolves as soon as the last answer arrives, without waiting out the timeout", async () => {
            expect.assertions(1);

            const stdin = new FakeStdin();
            const stdout = createStdout();

            const query = queryTerminalPalette(stdin, stdout, 10_000);

            stdin.send(fullPaletteResponse());

            const result = await query;

            expect(result.foreground).toBe("#ffffff");

            clearTerminalPaletteCache(stdout);
        });

        it("detaches its stdin listener once finished", async () => {
            expect.assertions(2);

            const stdin = new FakeStdin();
            const stdout = createStdout();

            const query = queryTerminalPalette(stdin, stdout, 50);

            expect(stdin.listenerCount("data")).toBe(1);

            stdin.send(fullPaletteResponse());
            await query;

            expect(stdin.listenerCount("data")).toBe(0);

            clearTerminalPaletteCache(stdout);
        });

        it("hands keystrokes typed during the query back to the stream", async () => {
            expect.assertions(2);

            const stdin = new FakeStdin();
            const stdout = createStdout();

            const query = queryTerminalPalette(stdin, stdout, 50);

            // The user types while the terminal is answering. Those bytes are not ours to eat.
            stdin.send(colorResponse("10", "#ffffff"));
            stdin.send("q");
            stdin.send(colorResponse("11", "#000000"));
            stdin.send("uit");

            await query;

            // Not just "unshift was called" — the stream must be out of flowing mode, or the
            // bytes are re-emitted to nobody and the keystrokes are lost anyway.
            expect(stdin.recoverable).toBe("quit");
            // One unshift call: successive unshifts would deliver the input back to front.
            expect(stdin.unshifted).toHaveLength(1);

            clearTerminalPaletteCache(stdout);
        });

        it("does not hand bytes back when the app is already listening", async () => {
            expect.assertions(1);

            const stdin = new FakeStdin();
            const stdout = createStdout();

            // The app's own input handler is attached, so it already received these chunks.
            // Unshifting would deliver every keystroke a second time.
            stdin.on("data", () => undefined);

            const query = queryTerminalPalette(stdin, stdout, 50);

            stdin.send("q");

            await query;

            expect(stdin.unshifted).toHaveLength(0);

            clearTerminalPaletteCache(stdout);
        });

        it("keeps a response split across chunks intact", async () => {
            expect.assertions(2);

            const stdin = new FakeStdin();
            const stdout = createStdout();
            const controller = new AbortController();

            const query = queryTerminalPalette(stdin, stdout, 50, controller.signal);
            const response = colorResponse("11", "#123456");

            stdin.send(response.slice(0, 5));
            stdin.send(response.slice(5));
            // Only the background answered, so the batch runs to its timeout; stop waiting for it.
            controller.abort();
            await query;

            const cached = await queryTerminalPalette(stdin, stdout, 50);

            expect(cached.background).toBe("#123456");
            expect(stdin.unshifted.join("")).toBe("");

            clearTerminalPaletteCache(stdout);
        });

        it("ignores a stray BEL from user input instead of treating it as an answer", async () => {
            expect.assertions(2);

            vi.useFakeTimers();

            const stdin = new FakeStdin();
            const stdout = createStdout();

            const query = queryTerminalPalette(stdin, stdout, 50);

            // A lone BEL used to satisfy the "response arrived" check and resolve with garbage.
            stdin.send(BEL);

            await vi.advanceTimersByTimeAsync(60);

            const result = await query;

            expect(result).toStrictEqual({});
            expect(stdin.unshifted.join("")).toBe(BEL);

            clearTerminalPaletteCache(stdout);
        });

        it("gives up after one timeout for the whole batch", async () => {
            expect.assertions(2);

            vi.useFakeTimers();

            const stdin = new FakeStdin();
            const stdout = createStdout();

            const query = queryTerminalPalette(stdin, stdout, 200);

            // A single 200ms budget covers all 19 queries; the old code spent 200ms per query.
            await vi.advanceTimersByTimeAsync(250);

            await expect(query).resolves.toStrictEqual({});
            expect(stdin.listenerCount("data")).toBe(0);

            clearTerminalPaletteCache(stdout);
        });

        it.each([
            ["an rgb: device specification", "rgb:ffff/0000/0000"],
            ["a short rgb: specification", "rgb:f/0/0"],
            ["a hex triplet", "#ff0000"],
            ["a long hex triplet", "#ffff00000000"],
            ["an X11 colour name", "red"],
        ])("accepts %s as a foreground reply", async (_name, spec) => {
            expect.assertions(1);

            // Only `rgb:` used to be understood; every other form a terminal answers with was
            // silently dropped and the palette came back missing that entry.
            vi.useFakeTimers();

            const stdin = new FakeStdin();
            const stdout = createStdout();

            const query = queryTerminalPalette(stdin, stdout, 50);

            stdin.send(`${OSC}10;${spec}${BEL}`);
            // Only one of the nineteen answers arrived, so the batch runs to its timeout.
            await vi.advanceTimersByTimeAsync(60);

            await expect(query).resolves.toMatchObject({ foreground: "#ff0000" });

            clearTerminalPaletteCache(stdout);
        });

        it("reads the colour from an indexed reply, which carries two fields before it", async () => {
            expect.assertions(1);

            vi.useFakeTimers();

            const stdin = new FakeStdin();
            const stdout = createStdout();

            const query = queryTerminalPalette(stdin, stdout, 50);

            stdin.send(`${OSC}4;7;cornflowerblue${BEL}`);
            await vi.advanceTimersByTimeAsync(60);

            const result = await query;

            expect(result.colors?.[7]).toBe("#6495ed");

            clearTerminalPaletteCache(stdout);
        });

        it("stops waiting when aborted", async () => {
            expect.assertions(1);

            const stdin = new FakeStdin();
            const stdout = createStdout();
            const controller = new AbortController();

            const query = queryTerminalPalette(stdin, stdout, 10_000, controller.signal);

            controller.abort();

            await expect(query).resolves.toStrictEqual({});

            clearTerminalPaletteCache(stdout);
        });

        it("returns an empty palette without probing when the signal is already aborted", async () => {
            expect.assertions(2);

            const stdin = new FakeStdin();
            const stdout = createStdout();

            await expect(queryTerminalPalette(stdin, stdout, 50, AbortSignal.abort())).resolves.toStrictEqual({});
            expect(stdout.writes).toHaveLength(0);
        });

        it("keeps the shared probe alive when one caller aborts", async () => {
            expect.assertions(3);

            const stdin = new FakeStdin();
            const stdout = createStdout();
            const controller = new AbortController();

            // Two components want the palette; the first unmounts mid-flight. Cancelling the round
            // trip there would throw away the answer the second one is still waiting for.
            const aborted = queryTerminalPalette(stdin, stdout, 10_000, controller.signal);
            const survivor = queryTerminalPalette(stdin, stdout, 10_000);

            controller.abort();

            await expect(aborted).resolves.toStrictEqual({});

            expect(stdin.listenerCount("data")).toBe(1);

            stdin.send(fullPaletteResponse());

            await expect(survivor).resolves.toMatchObject({ foreground: "#ffffff" });

            clearTerminalPaletteCache(stdout);
        });

        it("does not poison the cache when the first caller aborts (StrictMode double-mount)", async () => {
            expect.assertions(2);

            const stdin = new FakeStdin();
            const stdout = createStdout();
            const first = new AbortController();

            // React 19 StrictMode mounts, unmounts, remounts. The remount must not be handed the
            // empty promise the unmount resolved.
            const mountOne = queryTerminalPalette(stdin, stdout, 10_000, first.signal);

            first.abort();
            await mountOne;

            const mountTwo = queryTerminalPalette(stdin, stdout, 10_000);

            stdin.send(fullPaletteResponse());

            await expect(mountTwo).resolves.toMatchObject({ foreground: "#ffffff" });
            expect(stdout.writes).toHaveLength(1);

            clearTerminalPaletteCache(stdout);
        });

        it("caches the result per stdout so a second caller does not re-query", async () => {
            expect.assertions(3);

            const stdin = new FakeStdin();
            const stdout = createStdout();

            const first = queryTerminalPalette(stdin, stdout, 50);

            stdin.send(fullPaletteResponse());
            await first;

            const second = await queryTerminalPalette(stdin, stdout, 50);

            expect(stdout.writes).toHaveLength(1);
            expect(second.foreground).toBe("#ffffff");

            clearTerminalPaletteCache(stdout);

            void queryTerminalPalette(stdin, stdout, 50);

            expect(stdout.writes).toHaveLength(2);

            clearTerminalPaletteCache(stdout);
        });

        it("does not cache an empty result, so a later attempt can still succeed", async () => {
            expect.assertions(2);

            vi.useFakeTimers();

            const stdin = new FakeStdin();
            const stdout = createStdout();

            const first = queryTerminalPalette(stdin, stdout, 50);

            await vi.advanceTimersByTimeAsync(60);

            await expect(first).resolves.toStrictEqual({});

            void queryTerminalPalette(stdin, stdout, 50);

            expect(stdout.writes).toHaveLength(2);

            clearTerminalPaletteCache(stdout);
        });
    });
});
