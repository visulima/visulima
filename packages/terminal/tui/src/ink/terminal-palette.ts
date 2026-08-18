/* eslint-disable unicorn/no-null */

/**
 * Terminal palette auto-detection via OSC escape sequences.
 *
 * Queries the terminal for its current 16-color palette, foreground,
 * background, and cursor colors using OSC 4/10/11/12 sequences.
 * @see https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-Operating-System-Commands
 */
import type { Writable } from "node:stream";

import { parseColor } from "@visulima/ansi";

import runExclusiveProbe from "./probe-terminal";

const BEL = "\u{7}";
const ESCAPE = "\u{1B}";
const OSC = `${ESCAPE}]`;
const ST = `${ESCAPE}\\`;

/** Number of indexed palette entries queried via OSC 4. */
const PALETTE_SIZE = 16;

/** Foreground, background and cursor, plus every indexed colour. */
const EXPECTED_RESPONSES = 3 + PALETTE_SIZE;

/**
 * Give up once the buffer grows past anything a real exchange could need.
 *
 * Nineteen answers run to roughly 600 bytes; the rest of the budget is headroom for the user
 * typing while we wait, since those bytes are held here until they can be handed back.
 */
const MAX_RESPONSE_BYTES = 8192;

export type TerminalPalette = {
    readonly background: string;
    readonly colors: ReadonlyArray<string>;
    readonly cursor: string;
    readonly foreground: string;
};

/**
 * Reads the colour out of an OSC 10/11/12 reply payload.
 *
 * Terminals disagree about the form they answer in: `rgb:` device specifications are the documented
 * one, but `#rrggbb` and bare X11 colour names both occur. Delegating to the shared parser means
 * this does not have to guess which terminal it is talking to — it previously understood `rgb:`
 * only, and silently dropped every other reply.
 * @param payload The reply payload, `&lt;ps>;&lt;colour>`.
 * @returns The colour as `#rrggbb`, or null when the payload names no colour.
 */
const parseOscColorResponse = (payload: string): string | null => {
    // The last field is the colour: OSC 10/11/12 answer `<ps>;<colour>`, but OSC 4 answers
    // `4;<index>;<colour>`. No colour form contains a semicolon, so the last one always precedes it.
    const separator = payload.lastIndexOf(";");
    const color = parseColor(separator === -1 ? payload : payload.slice(separator + 1));

    if (color === undefined) {
        return null;
    }

    const channel = (value: number): string => value.toString(16).padStart(2, "0");

    return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
};

/**
 * Check if the terminal likely supports OSC palette queries.
 * @returns Whether a palette query is worth attempting.
 */
export const isTerminalPaletteQuerySupported = (): boolean => {
    const termProgram = process.env["TERM_PROGRAM"] ?? "";
    const supported = new Set(["Alacritty", "contour", "foot", "Ghostty", "iTerm2", "iTerm.app", "kitty", "rio", "WezTerm"]);

    if (supported.has(termProgram)) {
        return true;
    }

    const term = process.env["TERM"] ?? "";

    return term.startsWith("xterm") || Boolean(process.env["WT_SESSION"]);
};

/** A palette under construction, filled in as responses arrive. */
type PaletteDraft = {
    background?: string;
    colors: (string | undefined)[];
    cursor?: string;
    foreground?: string;
};

/**
 * Routes one OSC payload into the draft palette.
 * @param payload The text between `OSC` and the string terminator, e.g. `11;rgb:0000/0000/0000`.
 * @param draft The palette being assembled.
 * @returns Whether the payload was a recognised colour response.
 */
const didApplyOscPayload = (payload: string, draft: PaletteDraft): boolean => {
    const color = parseOscColorResponse(payload);

    if (color === null) {
        return false;
    }

    if (payload.startsWith("10;")) {
        draft.foreground = color;

        return true;
    }

    if (payload.startsWith("11;")) {
        draft.background = color;

        return true;
    }

    if (payload.startsWith("12;")) {
        draft.cursor = color;

        return true;
    }

    if (payload.startsWith("4;")) {
        // `4;<index>;rgb:…` — take the index field, not everything after the "4;".
        const separator = payload.indexOf(";", 2);
        const index = Number(payload.slice(2, separator === -1 ? payload.length : separator));

        if (Number.isSafeInteger(index) && index >= 0 && index < PALETTE_SIZE) {
            draft.colors[index] = color;

            return true;
        }
    }

    return false;
};

/** Every query, concatenated so the terminal receives them in a single write. */
const buildQuery = (): string => {
    const queries = [`${OSC}10;?${BEL}`, `${OSC}11;?${BEL}`, `${OSC}12;?${BEL}`];

    for (let index = 0; index < PALETTE_SIZE; index += 1) {
        queries.push(`${OSC}4;${String(index)};?${BEL}`);
    }

    return queries.join("");
};

/**
 * Caches the in-flight or completed query per output stream.
 *
 * A terminal's palette does not change while the process runs, and every query blocks a slice of
 * stdin for up to `timeout`. Keying on the stream also collapses concurrent callers (several
 * mounted components asking at once) onto a single round trip.
 */
const paletteCache = new WeakMap<Writable, Promise<Partial<TerminalPalette>>>();

/**
 * Drops the cached palette for a stream.
 *
 * Not re-exported from the package barrel: a terminal's palette does not change under a running
 * program, so this exists for tests and for the rare caller that knows the theme was switched.
 */
export const clearTerminalPaletteCache = (stdout: Writable): void => {
    paletteCache.delete(stdout);
};

/**
 * The slice of a readable stream a probe needs.
 *
 * Narrower than `NodeJS.ReadableStream` so a caller can hand in any object with these four members
 * — a test double included — without asserting it is a full stream.
 */
export interface ProbeStdin {
    listenerCount: (event: string) => number;
    on: (event: "data", listener: (chunk: Buffer | string) => void) => unknown;
    pause: () => unknown;
    removeListener: (event: "data", listener: (chunk: Buffer | string) => void) => unknown;
    unshift: (chunk: string) => void;
}

/** What one pass of the incremental parser pulled out of the buffer. */
type ParseResult = {
    /** Complete OSC payloads, without the introducer or terminator. */
    answers: string[];

    /** Bytes that belong to the application, not to us. */
    foreign: string;

    /** A partial answer (or lone introducer) to prepend to the next chunk. */
    rest: string;
};

/**
 * Splits a stdin chunk into OSC answers and everything else.
 *
 * Pure and exported for tests: this is where the buffer-boundary reasoning lives, and testing it
 * through a fake stream would only obscure it.
 * @param buffer Unparsed bytes, oldest first.
 * @returns The answers found, the application's bytes, and any incomplete tail to carry forward.
 */
export const takeOscAnswers = (buffer: string): ParseResult => {
    const answers: string[] = [];

    let foreign = "";
    let rest = buffer;

    for (;;) {
        const start = rest.indexOf(OSC);

        if (start === -1) {
            // No answer is starting. A trailing lone ESC may be the first byte of one, so hold it
            // back; everything before it belongs to the app.
            const trailingEscape = rest.endsWith(ESCAPE) ? 1 : 0;

            foreign += rest.slice(0, rest.length - trailingEscape);

            return { answers, foreign, rest: rest.slice(rest.length - trailingEscape) };
        }

        foreign += rest.slice(0, start);
        rest = rest.slice(start);

        const bell = rest.indexOf(BEL);
        const stringTerminator = rest.indexOf(ST);
        const hasBell = bell !== -1;
        const hasStringTerminator = stringTerminator !== -1;

        if (!hasBell && !hasStringTerminator) {
            // Incomplete answer: wait for the rest.
            return { answers, foreign, rest };
        }

        const end = hasBell && (!hasStringTerminator || bell < stringTerminator) ? bell : stringTerminator;

        answers.push(rest.slice(OSC.length, end));
        rest = rest.slice(end + (end === bell ? BEL.length : ST.length));
    }
};

/**
 * Issues every OSC query in one write and collects the answers with a single listener.
 *
 * Deliberately takes no `AbortSignal`: the probe is shared between every caller for a given stream
 * (see {@link paletteCache}), so one subscriber going away must not cancel the round trip for the
 * rest. Callers opt out of *waiting* instead — see {@link queryTerminalPalette}.
 * @param stdin Readable stream (typically process.stdin in raw mode)
 * @param stdout Writable stream (typically process.stdout)
 * @param timeout Milliseconds to wait for the whole batch
 * @returns Whatever the terminal answered before the batch finished or timed out.
 */
const runQuery = async (stdin: ProbeStdin, stdout: Writable, timeout: number): Promise<Partial<TerminalPalette>> =>
    new Promise((resolve) => {
        const draft: PaletteDraft = { colors: Array.from({ length: PALETTE_SIZE }) };

        // Bytes that are not part of an OSC answer — the user typing while we wait. They are
        // handed back to the stream on cleanup rather than dropped.
        let foreign = "";
        let pending = "";
        let received = 0;
        let isSettled = false;

        // Only put bytes back if nothing else is listening. When the app's own input handler is
        // already attached it received the same chunks, so unshifting would deliver them twice.
        const isSoleConsumerAtStart = stdin.listenerCount("data") === 0;

        let timer: ReturnType<typeof setTimeout> | undefined;

        const onData = (data: Buffer | string): void => {
            const parsed = takeOscAnswers(pending + data.toString());

            foreign += parsed.foreign;
            pending = parsed.rest;

            for (const answer of parsed.answers) {
                if (didApplyOscPayload(answer, draft)) {
                    received += 1;
                }
            }

            if (received >= EXPECTED_RESPONSES || pending.length + foreign.length > MAX_RESPONSE_BYTES) {
                finish();
            }
        };

        function finish(): void {
            if (isSettled) {
                return;
            }

            isSettled = true;

            if (timer) {
                clearTimeout(timer);
            }

            const isSoleConsumerAtEnd = stdin.listenerCount("data") === 1;

            stdin.removeListener("data", onData);

            const leftover = foreign + pending;

            if (isSoleConsumerAtStart && isSoleConsumerAtEnd && leftover.length > 0) {
                try {
                    // Attaching the listener put the stream into flowing mode, and removing the
                    // last listener does not take it back out. Unshifting while it still flows
                    // re-emits the bytes to nobody, so pause first — and leave it paused, which is
                    // the state the stream was in before the probe attached. Whoever reads next
                    // gets the keystrokes at the front of the buffer.
                    stdin.pause();
                    // One unshift, in arrival order: successive unshifts would reverse the input.
                    stdin.unshift(leftover);
                } catch {
                    // The stream ended underneath us; the bytes have nowhere to go.
                }
            }

            // Built mutably, then handed out through the readonly public shape.
            const result: Partial<{ background: string; colors: string[]; cursor: string; foreground: string }> = {};

            if (draft.foreground) {
                result.foreground = draft.foreground;
            }

            if (draft.background) {
                result.background = draft.background;
            }

            if (draft.cursor) {
                result.cursor = draft.cursor;
            }

            if (draft.colors.some(Boolean)) {
                result.colors = draft.colors.map((color) => color ?? "");
            }

            resolve(result);
        }

        // Attach before writing so an immediate reply is not missed.
        stdin.on("data", onData);

        // One timer for the whole batch. Previously each of the 19 queries had its own, so an
        // unresponsive terminal held stdin for nineteen timeouts back to back.
        timer = setTimeout(finish, timeout);

        stdout.write(buildQuery());
    });

/**
 * Waits for `query`, giving up early if `signal` aborts.
 *
 * The listener is removed however the race ends, so a caller reusing one long-lived signal does
 * not accumulate one listener per call.
 * @param query The shared probe.
 * @param signal The caller's abort signal.
 * @returns The probe's answer, or an empty palette if the caller aborted first.
 */
const raceAbort = async (query: Promise<Partial<TerminalPalette>>, signal: AbortSignal): Promise<Partial<TerminalPalette>> => {
    const aborted = Promise.withResolvers<Partial<TerminalPalette>>();

    const onAbort = (): void => {
        aborted.resolve({});
    };

    signal.addEventListener("abort", onAbort, { once: true });

    try {
        return await Promise.race([query, aborted.promise]);
    } finally {
        signal.removeEventListener("abort", onAbort);
    }
};

/**
 * Runs the shared probe and drops it from the cache if the terminal said nothing.
 *
 * The eviction lives inside the cached promise rather than in a `.then()` on it: an aborted caller
 * resumes late, and a second caller arriving in that window would otherwise be handed a promise
 * that has already resolved empty.
 * @param stdin Readable stream to listen on.
 * @param stdout Writable stream, and the cache key.
 * @param timeout Milliseconds to wait for the whole batch.
 * @returns The colours the terminal reported.
 */
const runCachedQuery = async (stdin: ProbeStdin, stdout: Writable, timeout: number): Promise<Partial<TerminalPalette>> => {
    let result: Partial<TerminalPalette>;

    try {
        // Serialized against the kitty-keyboard query, which reads the same stdin: concurrent
        // probes swallow each other's answers and re-inject them as user input.
        result = await runExclusiveProbe(stdin, async () => runQuery(stdin, stdout, timeout));
    } catch (error) {
        paletteCache.delete(stdout);

        throw error;
    }

    if (Object.keys(result).length === 0) {
        paletteCache.delete(stdout);
    }

    return result;
};

/**
 * Query the terminal for its current color palette.
 *
 * All queries go out in a single write and are answered against one listener, so an unresponsive
 * terminal costs one `timeout` rather than one per query. The probe is shared per output stream:
 * concurrent callers collapse onto one round trip, and the answer is reused for the process
 * lifetime because a terminal's palette does not change underneath a running program.
 *
 * `signal` unsubscribes *this* caller; it does not cancel the shared probe, so a component
 * unmounting mid-flight cannot discard the answer every other component is waiting for.
 * @param stdin Readable stream (typically process.stdin in raw mode)
 * @param stdout Writable stream (typically process.stdout)
 * @param timeout Timeout in milliseconds for the whole batch (default: 500). Ignored when a probe
 * for this stream is already in flight.
 * @param signal Stops waiting; resolves with an empty palette
 * @returns The colours the terminal reported. Missing entries mean it did not answer.
 */
export const queryTerminalPalette = async (
    stdin: ProbeStdin,
    stdout: Writable,
    timeout = 500,
    signal?: AbortSignal,
): Promise<Partial<TerminalPalette>> => {
    if (signal?.aborted) {
        return {};
    }

    let query = paletteCache.get(stdout);

    if (!query) {
        query = runCachedQuery(stdin, stdout, timeout);
        paletteCache.set(stdout, query);
    }

    return signal ? raceAbort(query, signal) : query;
};
