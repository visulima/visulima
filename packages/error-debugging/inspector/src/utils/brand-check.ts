import { safeGet, safeIsArray } from "./safe-reflect";

/**
 * Brand checks for the built-in tags the dispatcher keys on.
 *
 * `internalInspect` picks a renderer from the slug `Object.prototype.toString` hands
 * back, but that slug is not a fact about the value: per spec the built-in tag is
 * overridden by whatever `Get(O, @@toStringTag)` returns, provided it is a String. So
 * any object can claim to be a `Map`, and the matched renderer then calls a method that
 * only the real thing has (`map.entries()`, `date.toJSON()`, `regExp.flags`) and throws.
 * The same holds for a value that inherits a built-in prototype without the matching
 * internal slot — `Object.create(Map.prototype)`, `Map.prototype` itself, or a `Proxy`
 * wrapping a genuine `Map`, which forwards the tag read but has no `[[MapData]]` of its
 * own.
 *
 * Each check below asks the question the renderer is about to ask, using the built-in's
 * own accessor or method against the value. Those all begin with a `RequireInternalSlot`
 * step, so they throw for anything that merely looks the part — including a value that
 * supplies its own `entries` / `size` / `toJSON`, which is why a duck-type test would not
 * do. The probes are side-effect free: the size / byteLength / length getters and
 * `valueOf` read a slot and return, and `WeakMap` / `WeakSet` `has` answers `false` for a
 * key that was never added to anything.
 *
 * Cost on the genuine path is one null-prototype lookup plus one built-in call. Tags with
 * no entry pay nothing at all, and so do plain objects and primitives, because the lookup
 * only happens once a base inspector has already matched.
 */

type BrandCheck = (value: object) => boolean;

type Probe = (this: object, argument?: unknown) => unknown;

/**
 * Stands in for the two tags whose genuine bearers have no probeable slot at all:
 * `[[ParameterMap]]` is unobservable, and `[[ErrorData]]` only became testable with the
 * ES2025 `Error.isError`, absent from runtimes this package still supports. Rather than
 * diverge by engine, both lean on the fact that neither `Arguments` nor `Error` carries
 * a `Symbol.toStringTag` anywhere on its prototype chain, so a string tag is the only
 * way to produce those slugs without the slot.
 *
 * What this actually guarantees is one-directional. Accepting is sound: no string tag
 * plus one of those slugs does mean the slug came from an internal slot, because nothing
 * else can produce it. Rejecting is not — the check reads the converse, and a *genuine*
 * `Error` (or arguments object) that carries its own string `Symbol.toStringTag` still
 * reports the same slug and is turned away.
 *
 * That false negative is accepted. It costs output quality only: the value falls through
 * to the ordinary unknown-object route and renders via `inspectClass` instead of
 * `inspectError`, which is a worse rendering of a real error, never a throw. The trade is
 * deliberate — the alternative direction (trusting the slug) hands `inspectError` values
 * that only claim to be errors, which is the failure this table exists to prevent.
 */
const hasNoStringTag: BrandCheck = (value: object): boolean => typeof safeGet(value, Symbol.toStringTag) !== "string";

/**
 * The `Function` slug is only produced for a value with a `[[Call]]` slot, and those are
 * dispatched by `typeof` long before the tag is consulted — so reaching the tag path with
 * this slug always means it was forged.
 */
const isCallable: BrandCheck = (value: object): boolean => typeof value === "function";

/** Pulls a built-in's accessor (`kind: "get"`) or method (`kind: "value"`) off its prototype. */
const probeFrom = (holder: object | null | undefined, key: PropertyKey, kind: "get" | "value"): Probe | undefined => {
    if (holder === null || holder === undefined) {
        return undefined;
    }

    const descriptor = Object.getOwnPropertyDescriptor(holder, key);

    if (descriptor === undefined) {
        return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const candidate: unknown = kind === "get" ? descriptor.get : descriptor.value;

    return typeof candidate === "function" ? (candidate as Probe) : undefined;
};

/** Turns a probe into a brand check: it passed if the internal-slot check let it through. */
const brandedBy = (probe: Probe | undefined, argument?: unknown): BrandCheck | undefined => {
    if (probe === undefined) {
        return undefined;
    }

    return (value: object): boolean => {
        try {
            probe.call(value, argument);

            return true;
        } catch {
            return false;
        }
    };
};

const brandedByGetter = (holder: object | null | undefined, key: PropertyKey): BrandCheck | undefined => brandedBy(probeFrom(holder, key, "get"));

const brandedByMethod = (holder: object | null | undefined, key: PropertyKey, argument?: unknown): BrandCheck | undefined =>
    brandedBy(probeFrom(holder, key, "value"), argument);

/**
 * A key `WeakMap.prototype.has` / `WeakSet.prototype.has` can be asked about without
 * observable effect: it is never added to anything, so the answer is always `false` and
 * the call only ever exercises the receiver's internal-slot check.
 */
const NEVER_ADDED_KEY = Object.freeze({});

// All nine typed-array constructors share `%TypedArray%.prototype`, whose `length`
// accessor requires a `[[TypedArrayName]]` slot. It cannot tell a `Uint8Array` from an
// `Int8Array`, and does not need to: `inspectTypedArray` renders any of them and takes
// the label from the value's own tag.
const typedArrayBrand = brandedByGetter(Reflect.getPrototypeOf(Int8Array.prototype), "length");

// Absent from workerd and from browsers without cross-origin isolation, in which case
// the tag simply goes unchecked — no value in such a realm can bear it genuinely either.
const sharedArrayBufferPrototype = typeof SharedArrayBuffer === "function" ? (SharedArrayBuffer.prototype as object) : undefined;

const brandChecks: Record<string, BrandCheck | undefined> = Object.assign(Object.create(null) as Record<string, BrandCheck | undefined>, {
    Arguments: hasNoStringTag,
    Array: safeIsArray,
    ArrayBuffer: brandedByGetter(ArrayBuffer.prototype, "byteLength"),
    BigInt: brandedByMethod(BigInt.prototype, "valueOf"),
    Boolean: brandedByMethod(Boolean.prototype, "valueOf"),
    // Accepted false negative, the same shape as the one on `hasNoStringTag`: unlike the
    // typed-array `length` and `ArrayBuffer.prototype.byteLength` getters, which report
    // `0` once the buffer is gone, `DataView.prototype.byteLength` throws for a detached
    // or transferred buffer. So a genuine `DataView` over one fails its own probe and
    // renders as a plain object rather than through `inspectDataView`.
    DataView: brandedByGetter(DataView.prototype, "byteLength"),
    Date: brandedByMethod(Date.prototype, "valueOf"),
    Error: hasNoStringTag,
    Float32Array: typedArrayBrand,
    Float64Array: typedArrayBrand,
    Function: isCallable,
    Int8Array: typedArrayBrand,
    Int16Array: typedArrayBrand,
    Int32Array: typedArrayBrand,
    Map: brandedByGetter(Map.prototype, "size"),
    Number: brandedByMethod(Number.prototype, "valueOf"),
    RegExp: brandedByGetter(RegExp.prototype, "source"),
    Set: brandedByGetter(Set.prototype, "size"),
    SharedArrayBuffer: brandedByGetter(sharedArrayBufferPrototype, "byteLength"),
    String: brandedByMethod(String.prototype, "valueOf"),
    Symbol: brandedByMethod(Symbol.prototype, "valueOf"),
    Uint8Array: typedArrayBrand,
    Uint8ClampedArray: typedArrayBrand,
    Uint16Array: typedArrayBrand,
    Uint32Array: typedArrayBrand,
    WeakMap: brandedByMethod(WeakMap.prototype, "has", NEVER_ADDED_KEY),
    WeakSet: brandedByMethod(WeakSet.prototype, "has", NEVER_ADDED_KEY),
});

/**
 * Whether `value` really owns the internal slots the built-in `tag` claims for it.
 *
 * A tag with no registered check is reported as genuine, which covers three groups left
 * deliberately alone.
 *
 * `Promise`, `Generator` and `AsyncGenerator` have no side-effect-free probe. Unlike every
 * tag above, none of their prototypes carries a single accessor — `Promise.prototype` holds
 * `constructor` / `then` / `catch` / `finally`, `%GeneratorPrototype%` and
 * `%AsyncGeneratorPrototype%` hold `constructor` / `next` / `return` / `throw` — so the only
 * slot-bearing operations available are ones that schedule a job, mark a pending rejection
 * handled, or advance and close the iterator. Probing would corrupt the very value the
 * caller asked us to print. Their renderers touch nothing on the value, so a forgery cannot
 * make them throw either; it only mislabels, which is the trade taken here.
 *
 * The consequence is real and deliberate: `inspect({ [Symbol.toStringTag]: "Promise" })`
 * renders `Promise{…}`. Two substitutes were weighed and both rejected, so that a later
 * reader does not have to re-derive it:
 *
 * Prototype identity (`Object.getPrototypeOf(value) === Promise.prototype`, or `instanceof`)
 * is not a brand check. It is forgeable — `Object.create(Promise.prototype)` and
 * `Promise.prototype` itself both still report `[object Promise]` and would pass — and it is
 * cross-realm broken: a genuine promise from another realm (iframe, `vm` context, worker)
 * fails it, so real promises would start rendering as `{}`. It regresses the common case to
 * half-fix an adversarial one.
 *
 * Rejecting an own `Symbol.toStringTag` (the shape `hasNoStringTag` uses) is cross-realm safe,
 * but only catches the plain-object literal above. `Object.create(Promise.prototype)`,
 * `Promise.prototype`, and a class exposing a `get [Symbol.toStringTag]()` on its prototype
 * all forge the slug with no own tag and would sail past it.
 *
 * A runtime-sniffed `util.types.isPromise` is likewise out: this package takes no static
 * `node:*` dependency, and an optional probe would make the same input render differently on
 * Node than on workerd or in a browser.
 *
 * Note also that the runtime itself reports the forgery the same way — per spec
 * `Object.prototype.toString.call({ [Symbol.toStringTag]: "Promise" })` *is* `"[object
 * Promise]"`. The table exists to stop a renderer throwing on a value that lacks the slots it
 * is about to read (`map.entries()`, `date.toJSON()`); for these three there is no such read,
 * so there is nothing to protect. The limitation is documented for consumers under "Forged
 * tags" in `README.md`.
 *
 * `NodeList` and `HTMLCollection` are host tags with no ES-level brand. `instanceof` is
 * the only candidate, and it is not a brand check, fails cross-realm, and would break the
 * package's own browser suite, which renders DOM collections by attaching those tags to a
 * plain array. `inspectNode` bounds the per-member render instead.
 *
 * Anything a consumer added through `registerStringTag` is dispatched from a separate map
 * that this function is never consulted for.
 */
const matchesBuiltInTag = (value: object, tag: string): boolean => {
    const check = brandChecks[tag];

    return check === undefined || check(value);
};

export default matchesBuiltInTag;
