/**
 * The spec's state model and the store that owns it.
 *
 * Paths are RFC 6901 JSON Pointers (`/expanded/0`), which is what keeps the
 * spec a plain wire format: a spec written here stays readable by any other
 * renderer of the same shape.
 */

export type StateModel = Record<string, unknown>;

export interface StateStore {
    /** Read a value by JSON Pointer. */
    get: (path: string) => unknown;

    /** The whole state object. */
    getSnapshot: () => StateModel;

    /** Write a value by JSON Pointer and notify subscribers. */
    set: (path: string, value: unknown) => void;

    /** Listen for changes. Returns an unsubscribe function. */
    subscribe: (listener: () => void) => () => void;
}

/** `/a/b` → `["a", "b"]`. `~1` and `~0` are the pointer escapes for `/` and `~`. */
const segments = (path: string): string[] =>
    path
        .split("/")
        .slice(1)
        .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));

export const getByPath = (root: StateModel, path: string): unknown => {
    let current: unknown = root;

    for (const segment of segments(path)) {
        if (current === null || typeof current !== "object") {
            return undefined;
        }

        current = (current as Record<string, unknown>)[segment];
    }

    return current;
};

/**
 * Write `value` at `path`, creating containers along the way.
 *
 * A numeric segment creates an array, so `/expanded/2` on empty state yields
 * `{ expanded: [undefined, undefined, true] }` rather than an object with a
 * `"2"` key — which is what keeps a spec's indexed state JSON-clean.
 */
export const setByPath = (root: StateModel, path: string, value: unknown): void => {
    const parts = segments(path);
    const last = parts.pop();

    if (last === undefined) {
        return;
    }

    let current: Record<string, unknown> = root;

    for (const [index, segment] of parts.entries()) {
        const existing = current[segment];

        if (existing === null || typeof existing !== "object") {
            current[segment] = /^\d+$/.test(parts[index + 1] ?? last) ? [] : {};
        }

        current = current[segment] as Record<string, unknown>;
    }

    current[last] = value;
};

/** In-memory store over a plain object. */
export const createStateStore = (initial: StateModel = {}): StateStore => {
    let model: StateModel = { ...initial };
    const listeners = new Set<() => void>();

    return {
        get: (path) => getByPath(model, path),
        getSnapshot: () => model,
        set: (path, value) => {
            if (getByPath(model, path) === value) {
                return;
            }

            // Replace the root so a consumer comparing snapshots by reference
            // sees the change; the nested write itself is in place.
            model = { ...model };
            setByPath(model, path, value);

            for (const listener of listeners) {
                listener();
            }
        },
        subscribe: (listener) => {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        },
    };
};
