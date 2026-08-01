import { inspectHTMLElement, inspectNodeCollection } from "./html";
import type { Inspect, InspectType, InternalInspect, Options } from "./types";
import inspectArguments from "./types/arguments";
import inspectArray from "./types/array";
import inspectArrayBuffer from "./types/array-buffer";
import inspectBigInt from "./types/bigint";
import inspectClass from "./types/class";
import inspectDataView from "./types/data-view";
import inspectDate from "./types/date";
import inspectError from "./types/error";
import inspectFunction from "./types/function";
import inspectGenerator from "./types/generator";
import inspectMap from "./types/map";
import inspectNumber from "./types/number";
import inspectObject from "./types/object";
import inspectPromise from "./types/promise";
import inspectRegExp from "./types/regexp";
import inspectSet from "./types/set";
import inspectString from "./types/string";
import inspectSymbol from "./types/symbol";
import inspectTypedArray from "./types/typed-array";
import matchesBuiltInTag from "./utils/brand-check";
import { getIndent } from "./utils/indent";
import { safeGet, safeInstanceOf, safeIsArray } from "./utils/safe-reflect";

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
const constructorMap = new WeakMap<Function, Inspect>();

// `stringTagMap` and `baseTypesMap` are dispatched into with attacker-influenced
// keys (`Object.prototype.toString` slugs / `Symbol.toStringTag` values). Using a
// null-prototype object means a hostile tag like `"valueOf"` or `"toString"` can
// never resolve to an inherited `Object.prototype` method (which previously caused
// crashes / bogus output), and lets `registerStringTag("toString", …)` succeed.
const stringTagMap: Record<string, Inspect> = Object.create(null) as Record<string, Inspect>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const baseTypesMap: Record<string, InspectType<any>> = Object.assign(Object.create(null) as Record<string, InspectType<any>>, {
    Arguments: inspectArguments,
    Array: inspectArray,

    ArrayBuffer: inspectArrayBuffer,
    AsyncGenerator: inspectGenerator,
    BigInt: inspectBigInt,

    bigint: inspectBigInt,
    Boolean: (value: boolean, options: Options) => options.stylize(String(value), "boolean"),

    boolean: (value: boolean, options: Options) => options.stylize(String(value), "boolean"),
    DataView: inspectDataView,

    Date: inspectDate,
    Error: inspectError,

    Float32Array: inspectTypedArray,
    Float64Array: inspectTypedArray,

    Function: inspectFunction,
    function: inspectFunction,

    Generator: inspectGenerator,
    HTMLCollection: inspectNodeCollection,
    Int8Array: inspectTypedArray,
    Int16Array: inspectTypedArray,
    Int32Array: inspectTypedArray,
    Map: inspectMap,

    NodeList: inspectNodeCollection,
    null: (_value: null, options: Options) => options.stylize("null", "null"),

    Number: inspectNumber,
    number: inspectNumber,
    Promise: inspectPromise,
    RegExp: inspectRegExp,
    Set: inspectSet,
    SharedArrayBuffer: inspectArrayBuffer,
    String: inspectString,
    string: inspectString,
    // A Symbol polyfill will return `Symbol` not `symbol` from typedetect
    Symbol: inspectSymbol,
    symbol: inspectSymbol,
    Uint8Array: inspectTypedArray,

    Uint8ClampedArray: inspectTypedArray,
    Uint16Array: inspectTypedArray,
    Uint32Array: inspectTypedArray,

    undefined: (_value: undefined, options: Options) => options.stylize("undefined", "undefined"),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    WeakMap: (_value: WeakMap<any, unknown>, options: Options) => options.stylize("WeakMap{…}", "special"),
    // WeakSet, WeakMap are totally opaque to us
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    WeakSet: (_value: WeakSet<any>, options: Options) => options.stylize("WeakSet{…}", "special"),
});

const nodeInspectCustomSymbol = Symbol.for("nodejs.util.inspect.custom");

/**
 * The symbol consumers can attach a custom inspector to, mirroring loupe's
 * `Symbol.for("chai/inspect")` contract. Exposed publicly as {@link custom}.
 */
const chaiInspectSymbol = Symbol.for("chai/inspect");

// Every probe below reads a well-known key off an untrusted value. `safeGet` both
// guards the read (a `Proxy` `get` trap may throw for any key) and replaces the old
// `key in value && typeof value[key] === "function"` pair with a single operation —
// the `in` check was redundant, since a missing key already fails the `typeof` test.
const inspectCustom = (value: object, options: Options, type: string, depth: number): string => {
    // Honour loupe's `chai/inspect` contract first so values shared with the chai
    // ecosystem render identically. The handler receives only `options`.
    const chaiInspector = safeGet(value, chaiInspectSymbol);

    if (typeof chaiInspector === "function") {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return chaiInspector.call(value, options);
    }

    if (!("window" in globalThis)) {
        const nodeInspector = safeGet(value, nodeInspectCustomSymbol);

        if (typeof nodeInspector === "function") {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return nodeInspector.call(value, depth, options);
        }
    }

    const legacyInspector = safeGet(value, "inspect");

    if (typeof legacyInspector === "function") {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return legacyInspector.call(value, depth, options);
    }

    // `safeGet` returns `unknown` on purpose: `constructor` is an ordinary property on
    // an untrusted value, so it can be anything at all. Narrow rather than assert — the
    // `WeakMap` key type is the only thing the assertion was buying, and a non-callable
    // `constructor` was never going to be in it.
    const valueConstructor = safeGet(value, "constructor");

    if (typeof valueConstructor === "function" && constructorMap.has(valueConstructor)) {
        return constructorMap.get(valueConstructor)?.(value, options) ?? "unknown";
    }

    // `stringTagMap` is a null-prototype object, so an attacker-supplied tag (e.g.
    // `"toString"`) can only resolve to an entry the consumer explicitly registered.
    const tagInspector = Object.hasOwn(stringTagMap, type) ? stringTagMap[type] : undefined;

    if (tagInspector) {
        return tagInspector(value, options);
    }

    return "";
};

/**
 * Per top-level `inspect()` call state, threaded through the recursion instead of
 * being re-captured by a fresh closure at every descent. `depth` is the current
 * nesting level, `seen` a mutable DFS stack for circular-reference detection, and
 * `inspect` the single recursion callback handed to the type inspectors.
 */
interface InspectContext {
    depth: number;
    inspect: InternalInspect;
    seen: unknown[];
}

// eslint-disable-next-line sonarjs/cognitive-complexity
const internalInspect = (value: unknown, options: Options, context: InspectContext): string => {
    const { depth, inspect, seen } = context;

    if (seen.includes(value)) {
        return "[Circular]";
    }

    if (depth >= options.depth && options.depth > 0 && typeof value === "object" && value !== null) {
        return safeIsArray(value) ? "[Array]" : "[Object]";
    }

    const indent = options.indent ? getIndent(options.indent, depth) : undefined;

    let type = value === null ? "null" : typeof value;

    if (type === "object") {
        // Reads `Symbol.toStringTag` off the value, so this is the *first* thing a
        // hostile value can hijack — long before any guarded property read. On failure
        // the slug degrades to `"Object"`, which routes the value to `inspectObject`:
        // the most conservative renderer, and the only one that reads nothing but own
        // properties. Inlined rather than delegated so the successful path is exactly
        // the expression it always was.
        try {
            type = Object.prototype.toString.call(value).slice(8, -1);
        } catch {
            type = "Object";
        }
    }

    // If it is a base value that we already support, then use inspector
    let baseInspector = baseTypesMap[type];

    // For an object the slug above is not a fact about the value: `Symbol.toStringTag`
    // overrides the built-in tag outright, so `{ [Symbol.toStringTag]: "Map" }` matches
    // `inspectMap`, which then calls `map.entries()` and throws. Confirm the value owns
    // the internal slots the tag claims before handing it over. A value that fails is
    // treated as if it carried no built-in tag at all and takes the ordinary
    // unknown-object route below — custom inspectors, then `registerStringTag`, then the
    // renderers that read nothing but own properties.
    //
    // The check is reached only once a base inspector has matched, and is skipped
    // entirely for primitives (whose `type` is their `typeof`, which nothing can forge),
    // so plain objects and primitives pay nothing for it.
    if (baseInspector !== undefined && typeof value === "object" && value !== null && !matchesBuiltInTag(value, type)) {
        baseInspector = undefined;
    }

    if (baseInspector !== undefined) {
        return baseInspector(value, options, inspect, indent);
    }

    // If `options.customInspect` is set to true then try to use the custom inspector
    if (options.customInspect && value) {
        const output = inspectCustom(value, options, type, options.depth - depth);

        if (output) {
            if (typeof output === "string") {
                return output;
            }

            return inspect(output, value, options);
        }
    }

    let proto: unknown = false;

    if (value) {
        try {
            proto = Object.getPrototypeOf(value);
        } catch {
            // A throwing `getPrototypeOf` trap, or a revoked proxy. Assume the most
            // conservative shape — a plain object — rather than `null`, which would
            // add an `[Object: null prototype]` tag the value never earned.
            proto = Object.prototype;
        }
    }

    // If it's a plain Object then use inspector
    if (proto === Object.prototype || proto === null) {
        return inspectObject(value as object, options, inspect, indent);
    }

    // Specifically account for HTMLElements
    if (value && typeof HTMLElement === "function" && safeInstanceOf(value, HTMLElement)) {
        return inspectHTMLElement(value as Element, value, options, inspect);
    }

    // A single guarded read replaces the former `"constructor" in value` +
    // `value.constructor` pair. `undefined` now means "no usable constructor" —
    // whether because the key is absent or because reading it threw — and such a
    // value falls through to the plain-object renderer rather than being labelled
    // `<Anonymous Class>` on the strength of a property nobody could read.
    const valueConstructor = safeGet(value as object, "constructor");

    if (valueConstructor !== undefined) {
        // If it is a class, inspect it like an object but add the constructor name
        if (valueConstructor !== Object) {
            return inspectClass(value as new (...arguments_: any[]) => unknown, options, inspect, indent);
        }

        // If it is an object with an anonymous prototype, display it as an object.
        return inspectObject(value as object, options, inspect, indent);
    }

    // last chance to check if it's an object
    if (value === Object(value)) {
        return inspectObject(value as object, options, inspect, indent);
    }

    // We have run out of options! Just stringify the value
    return options.stylize(String(value), type);
};

export type { Options } from "./types";

export const inspect = (value: unknown, options_: Partial<Options> = {}): string => {
    const options = {
        customInspect: true,
        depth: 5,
        indent: undefined,
        maxArrayLength: Number.POSITIVE_INFINITY,
        numericSeparator: true,
        quoteStyle: "single",
        showHidden: false,
        stylize: (s: string) => s,
        truncate: Number.POSITIVE_INFINITY,
        ...options_,
    } satisfies Options;

    // @ts-expect-error - use can put a string in the indent option
    if (options.indent !== undefined && options.indent !== "\t" && !(Number.parseInt(options.indent, 10) === options.indent && options.indent > 0)) {
        throw new TypeError("option \"indent\" must be \"\\t\", an integer > 0, or `undefined`");
    }

    const context: InspectContext = {
        depth: 0,
        // Assigned just below; the recursion callback needs the context to exist first.
        inspect: undefined as unknown as InternalInspect,
        seen: [],
    };

    // The single recursion callback for this top-level call, handed to every type
    // inspector. Creating it once here (rather than re-allocating a closure on each
    // descent) keeps allocation off the hot path. It maintains `seen` and `depth` as
    // a mutable DFS stack — push/increment before descending, pop/decrement after —
    // giving O(1) circular-reference detection instead of the O(n) copy a
    // `[...seen, from]` spread would cost (which degrades to O(n²) across siblings).
    // eslint-disable-next-line @typescript-eslint/no-shadow
    context.inspect = (object: unknown, from: unknown, options: Options): string => {
        if (from === undefined || from === null) {
            context.depth += 1;

            const result = internalInspect(object, options, context);

            context.depth -= 1;

            return result;
        }

        context.seen.push(from);
        context.depth += 1;

        const result = internalInspect(object, options, context);

        context.depth -= 1;
        context.seen.pop();

        return result;
    };

    return internalInspect(value, options, context);
};

/**
 * The symbol a value can expose a custom inspector under. Mirrors loupe's
 * `custom` export (`Symbol.for("chai/inspect")`); the attached function is
 * called with the resolved {@link Options} and must return a string.
 */
export const custom: symbol = chaiInspectSymbol;

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const registerConstructor = (constructor: Function, inspector: Inspect): boolean => {
    if (constructorMap.has(constructor)) {
        return false;
    }

    constructorMap.set(constructor, inspector);

    return true;
};

export const registerStringTag = (stringTag: string, inspector: Inspect): boolean => {
    // `stringTagMap` is a null-prototype object, so `Object.hasOwn` (rather than the
    // former `in`, which also matched inherited keys) means tags like `"toString"`
    // or `"valueOf"` are no longer rejected as "already registered".
    if (Object.hasOwn(stringTagMap, stringTag)) {
        return false;
    }

    stringTagMap[stringTag] = inspector;

    return true;
};
