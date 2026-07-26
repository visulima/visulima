import EventEmitter from "node:events";

import { expect, vi } from "vitest";

/**
 * Delivery state hung off the fake stdin, so {@link emitReadable} can tell
 * whether the component under test is listening yet.
 */
interface DeliveryState {
    pending: (() => void)[];
    /** DEBUG: every `setRawMode` argument, in order. */
    rawModeCalls: boolean[];
    /** DEBUG: how many times the App drained us via `read()`. */
    readCalls: number;
    ready: boolean;
}

const DELIVERY_STATE = Symbol("ink-test-stdin-delivery");

/**
 * DEBUG (temporary): emit one line per keystroke so a CI run can be read back.
 *
 * The question this answers: when a key is dropped, did the App's `readable`
 * handler run at all? `read()` being called means a listener consumed the chunk
 * and the drop is downstream (`useInput` inert because focus had not
 * propagated). `read()` not being called means no listener was attached — the
 * refcounted attach/detach in `handleSetRawMode` lost it.
 */
const debugLog = (message: string): void => {
    let testName = "?";

    try {
        testName = expect.getState().currentTestName ?? "?";
    } catch {
        // Outside a test scope — keep the marker anyway.
    }

    // eslint-disable-next-line no-console
    console.log(`[VIS-INPUT-DEBUG] pid=${String(process.pid)} test=${JSON.stringify(testName)} ${message}`);
};

export const createStdin = (): NodeJS.WriteStream => {
    // EventEmitter is required here for Node.js stream compatibility
    const stdin = new EventEmitter() as unknown as NodeJS.WriteStream;

    stdin.isTTY = true;

    const state: DeliveryState = { pending: [], rawModeCalls: [], readCalls: 0, ready: false };

    (stdin as unknown as Record<symbol, DeliveryState>)[DELIVERY_STATE] = state;

    // Define properties before spying since EventEmitter doesn't have these natively
    (stdin as Record<string, unknown>).setRawMode = () => stdin;
    (stdin as Record<string, unknown>).read = () => undefined;
    vi.spyOn(stdin, "setRawMode").mockImplementation(((isEnabled: boolean) => {
        state.rawModeCalls.push(isEnabled);

        // `useFocus` enables raw mode from the effect that also registers the
        // component with the focus manager, so this is the first observable
        // moment at which a keypress can reach a handler.
        if (isEnabled && !state.ready) {
            state.ready = true;

            // One macrotask so React can flush the `activeId` state update that
            // follows registration — `useInput` stays inert until `isFocused`
            // has propagated, and a key delivered before then is dropped, not
            // queued.
            setTimeout(() => {
                for (const deliver of state.pending.splice(0)) {
                    deliver();
                }
            }, 0);
        }

        return stdin;
    }) as never);
    stdin.setEncoding = () => stdin;
    vi.spyOn(stdin, "read").mockImplementation();
    stdin.unref = () => stdin;
    stdin.ref = () => stdin;

    return stdin;
};

/**
 * Feed a chunk to the component under test as if the terminal had produced it.
 *
 * Tests render, wait a fixed moment, then send a key. When a loaded CI runner
 * takes longer than that moment to mount + focus, the key lands while
 * `useInput` is still inert and is silently dropped — the assertion then waits
 * out its whole timeout for state that can never arrive. Buffering until raw
 * mode is on removes the race without making every test poll for readiness.
 * @param stdin The fake stdin from {@link createStdin}.
 * @param chunk The raw input to deliver.
 */
export const emitReadable = (stdin: NodeJS.WriteStream, chunk: string): void => {
    const state = (stdin as unknown as Record<symbol, DeliveryState | undefined>)[DELIVERY_STATE];

    const deliver = (buffered: boolean): void => {
        const read = stdin.read as ReturnType<typeof vi.fn>;
        const before = read.mock.calls.length;

        read.mockReturnValueOnce(chunk);
        read.mockReturnValueOnce(null);
        stdin.emit("readable");

        const drained = read.mock.calls.length - before;

        read.mockReset();

        if (state) {
            state.readCalls += drained;
        }

        debugLog(
            `deliver chunk=${JSON.stringify(chunk)} buffered=${String(buffered)} listeners=${String(stdin.listenerCount("readable"))}`
                + ` drained=${String(drained)} rawMode=[${(state?.rawModeCalls ?? []).join(",")}]`,
        );

        // A late listener would show up here — e.g. focus settling after the
        // key was already thrown away.
        setTimeout(() => {
            debugLog(
                `+500ms chunk=${JSON.stringify(chunk)} listeners=${String(stdin.listenerCount("readable"))}`
                    + ` rawMode=[${(state?.rawModeCalls ?? []).join(",")}]`,
            );
        }, 500);
    };

    // No state means a hand-rolled stdin, and `ready` means the component is
    // already listening — deliver straight away so ordering is preserved.
    if (!state || state.ready) {
        deliver(false);

        return;
    }

    debugLog(`buffering chunk=${JSON.stringify(chunk)} (raw mode not enabled yet) listeners=${String(stdin.listenerCount("readable"))}`);
    state.pending.push(() => deliver(true));
};
