import { INDENT_SEPARATOR } from "../constants";
import type { Indent, InspectType, InternalInspect, Options } from "../types";
import { indentedJoin } from "../utils/indent";
import inspectList from "../utils/inspect-list";
import inspectProperty from "../utils/inspect-property";

/* eslint-disable no-proto, no-restricted-properties */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
const gPO = (typeof Reflect === "function" ? Reflect.getPrototypeOf : Object.getPrototypeOf)
    // @ts-expect-error - This is a fallback for older environments
    || ([].__proto__ === Array.prototype
        // eslint-disable-next-line func-names
        ? function (O: Record<string, unknown>) {
            return O.__proto__;
        }
        : undefined);
/* eslint-enable no-proto, no-restricted-properties */

const chaiInspectSymbol = Symbol.for("chai/inspect");

/**
 * Builds a marker value that renders as `text` verbatim. It carries a
 * `chai/inspect` handler so the normal recursion prints the literal marker
 * instead of trying to descend into it.
 */
const makeMarker = (text: string): { [chaiInspectSymbol]: () => string } => {
    return { [chaiInspectSymbol]: () => text };
};

/**
 * Safely reads an own property. The inspector must never crash on the value it
 * is asked to render (its primary consumer is a logger), so accessor getters are
 * invoked inside a try/catch and a placeholder is substituted on failure —
 * mirroring `util.inspect`'s `[Getter]` / `&lt;Inspection threw>` behaviour.
 */
const safeReadProperty = (object: object, key: PropertyKey): unknown => {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);

    // Data property (or no descriptor): read directly, guarding against proxies
    // whose `get` trap throws.
    if (descriptor === undefined || "value" in descriptor) {
        try {
            return object[key as keyof typeof object];
        } catch {
            return makeMarker("[Inspection threw]");
        }
    }

    // Accessor without a getter — nothing to read.
    if (descriptor.get === undefined) {
        return makeMarker("[Setter]");
    }

    try {
        return object[key as keyof typeof object];
    } catch {
        return makeMarker("[Inspection threw]");
    }
};

// eslint-disable-next-line sonarjs/cognitive-complexity
const inspectObject: InspectType<object> = (object: object, options: Options, inspect: InternalInspect, indent: Indent | undefined): string => {
    if ("window" in globalThis && object === globalThis) {
        return "{ [object Window] }";
    }

    if (object === globalThis) {
        return "{ [object globalThis] }";
    }

    const allPropertyNames = Object.getOwnPropertyNames(object);

    // By default only enumerable own properties are shown; `showHidden` opts into
    // non-enumerable ones too (mirrors util.inspect).
    const properties = options.showHidden
        ? allPropertyNames
        : allPropertyNames.filter((key) => Object.getOwnPropertyDescriptor(object, key)?.enumerable);

    const symbols = Object.getOwnPropertySymbols(object).filter(
        (key) => options.showHidden || Object.getOwnPropertyDescriptor(object, key)?.enumerable,
    );

    const isPlainObject = gPO(object) === Object.prototype || object.constructor === Object;

    const protoTag = object instanceof Object ? "" : "null prototype";

    let stringTag: string;

    if (!isPlainObject && Symbol.toStringTag in object) {
        stringTag = object[Symbol.toStringTag] as string;
    } else {
        stringTag = protoTag ? "Object" : "";
    }

    const tag = stringTag || protoTag ? `[${[stringTag, protoTag].filter(Boolean).join(": ")}] ` : "";

    if (properties.length === 0 && symbols.length === 0) {
        return `${tag}{}`;
    }

    // eslint-disable-next-line no-param-reassign
    options.truncate -= 4;

    const entrySeparator = indent ? INDENT_SEPARATOR : ", ";

    const propertyContents = inspectList(
        properties.map((key) => [key, safeReadProperty(object, key)]),
        object,
        options,
        inspect,
        inspectProperty,
        entrySeparator,
    );
    const symbolContents = inspectList(
        symbols.map((key) => [key, safeReadProperty(object, key)]),
        object,
        options,
        inspect,
        inspectProperty,
        entrySeparator,
    );

    let separator = "";

    if (propertyContents && symbolContents) {
        separator = entrySeparator;
    }

    if (indent) {
        return `${tag}{${indentedJoin(propertyContents + separator + symbolContents, indent)}}`;
    }

    return `${tag}{ ${propertyContents}${separator}${symbolContents} }`;
};

export default inspectObject;
