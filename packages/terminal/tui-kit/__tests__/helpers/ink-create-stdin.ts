import EventEmitter from "node:events";

import { vi } from "vitest";

/**
 * Delivery state hung off the fake stdin, so {@link emitReadable} can tell
 * whether the component under test is listening yet.
 */
interface DeliveryState {
    pending: (() => void)[];
    ready: boolean;
}

const DELIVERY_STATE = Symbol("ink-test-stdin-delivery");

export const createStdin = (): NodeJS.WriteStream => {
    // EventEmitter is required here for Node.js stream compatibility
    const stdin = new EventEmitter() as unknown as NodeJS.WriteStream;

    stdin.isTTY = true;

    const state: DeliveryState = { pending: [], ready: false };

    (stdin as unknown as Record<symbol, DeliveryState>)[DELIVERY_STATE] = state;

    // Define properties before spying since EventEmitter doesn't have these natively
    (stdin as Record<string, unknown>).setRawMode = () => stdin;
    (stdin as Record<string, unknown>).read = () => undefined;
    vi.spyOn(stdin, "setRawMode").mockImplementation(((isEnabled: boolean) => {
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
    const deliver = (): void => {
        const read = stdin.read as ReturnType<typeof vi.fn>;

        read.mockReturnValueOnce(chunk);
        read.mockReturnValueOnce(null);
        stdin.emit("readable");
        read.mockReset();
    };

    const state = (stdin as unknown as Record<symbol, DeliveryState | undefined>)[DELIVERY_STATE];

    // No state means a hand-rolled stdin, and `ready` means the component is
    // already listening — deliver straight away so ordering is preserved.
    if (!state || state.ready) {
        deliver();

        return;
    }

    state.pending.push(deliver);
};
