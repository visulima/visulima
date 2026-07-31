import { INSPECTION_THREW } from "../constants";

const chaiInspectSymbol = Symbol.for("chai/inspect");

/**
 * Builds a marker value that renders as `text` verbatim. It carries a
 * `chai/inspect` handler so the normal recursion prints the literal marker
 * instead of trying to descend into it.
 */
export const makeMarker = (text: string): { [chaiInspectSymbol]: () => string } => {
    return { [chaiInspectSymbol]: () => text };
};

/**
 * Safely reads an own property. The inspector must never crash on the value it
 * is asked to render (its primary consumer is a logger), so accessor getters are
 * invoked inside a try/catch and a placeholder is substituted on failure —
 * mirroring `util.inspect`'s `[Getter]` / `&lt;Inspection threw>` behaviour.
 */
export const safeReadProperty = (object: object, key: PropertyKey): unknown => {
    let descriptor: PropertyDescriptor | undefined;

    try {
        descriptor = Object.getOwnPropertyDescriptor(object, key);
    } catch {
        // A proxy whose `getOwnPropertyDescriptor` trap throws. The shape of the
        // property is unknowable, so fall through to the guarded direct read below.
        descriptor = undefined;
    }

    // Data property (or no descriptor): read directly, guarding against proxies
    // whose `get` trap throws.
    if (descriptor === undefined || "value" in descriptor) {
        try {
            return object[key as keyof typeof object];
        } catch {
            return makeMarker(INSPECTION_THREW);
        }
    }

    // Accessor without a getter — nothing to read.
    if (descriptor.get === undefined) {
        return makeMarker("[Setter]");
    }

    try {
        return object[key as keyof typeof object];
    } catch {
        return makeMarker(INSPECTION_THREW);
    }
};
