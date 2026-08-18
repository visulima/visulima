/**
 * Serializes terminal capability probes that read from the same stdin.
 *
 * Several features ask the terminal a question and wait for it to answer: the kitty keyboard query
 * (`CSI ? u`), the OSC palette query, and anything added later. Each attaches its own `data`
 * listener, buffers what arrives, keeps the bytes it recognises and hands the rest back.
 *
 * Run two of those at once and they corrupt each other — one probe's answer looks like foreign
 * input to the other, which pushes it back into the stream as if the user had typed it, while the
 * probe that was waiting for it times out. The kitty query fires on first render and the palette
 * query from a mount effect, so the overlap is ordinary, not exotic.
 *
 * Rather than teach every probe about every other probe's wire format, they take turns.
 */

/** The tail of the probe chain for each stdin, so the next probe can await it. */
const chains = new WeakMap<object, Promise<void>>();

/**
 * Runs `probe` after `previous`, whichever way `previous` ended.
 *
 * A probe that threw must not cancel the next one; its own caller already sees the error.
 * @param previous The predecessor's completion.
 * @param probe The probe to run next.
 * @returns The probe's result.
 */
const runAfter = async <T>(previous: Promise<void>, probe: () => Promise<T>): Promise<T> => {
    await previous;

    return probe();
};

/**
 * Runs `probe` once every earlier probe on this stdin has finished.
 * @param stdin The stream the probe will listen on. Only its identity is used, as a queue key.
 * @param probe The probe to run. It gets exclusive use of `stdin` for its duration.
 * @returns Whatever `probe` resolves to.
 */
const runExclusiveProbe = <T>(stdin: object, probe: () => Promise<T>): Promise<T> => {
    const previous = chains.get(stdin);

    // With an empty queue the probe starts synchronously, so its listener is attached before the
    // caller's next statement — deferring by a microtask would let bytes arrive unobserved.
    const result = previous === undefined ? probe() : runAfter(previous, probe);

    let link: Promise<void> | undefined;

    const track = async (): Promise<void> => {
        try {
            await result;
        } catch {
            // Swallowed here only so the queue keeps moving; the caller still sees the rejection.
        }

        // Drop the link once the queue drains, so a later probe is synchronous again rather than
        // inheriting a microtask hop from a probe that finished long ago.
        if (chains.get(stdin) === link) {
            chains.delete(stdin);
        }
    };

    // `track` awaits before reading `link`, so the assignment below always lands first.
    link = track();
    chains.set(stdin, link);

    return result;
};

export default runExclusiveProbe;
