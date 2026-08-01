import { INDENT_SEPARATOR, INSPECTION_THREW } from "../constants";
import type { Indent, InspectType, InternalInspect, Options } from "../types";
import { indentedJoin } from "../utils/indent";
import inspectList from "../utils/inspect-list";
import inspectProperty from "../utils/inspect-property";
import { safeReadProperty } from "../utils/safe-read-property";
import { safeIsEnumerable } from "../utils/safe-reflect";

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

// eslint-disable-next-line sonarjs/cognitive-complexity
const inspectObject: InspectType<object> = (object: object, options: Options, inspect: InternalInspect, indent: Indent | undefined): string => {
    if ("window" in globalThis && object === globalThis) {
        return "{ [object Window] }";
    }

    if (object === globalThis) {
        return "{ [object globalThis] }";
    }

    let allPropertyNames: string[];
    let allSymbols: symbol[];

    try {
        allPropertyNames = Object.getOwnPropertyNames(object);
        allSymbols = Object.getOwnPropertySymbols(object);
    } catch {
        // A revoked proxy, or one whose `ownKeys` trap throws: not a single key is
        // observable, so there is nothing honest left to print.
        return INSPECTION_THREW;
    }

    // By default only enumerable own properties are shown; `showHidden` opts into
    // non-enumerable ones too (mirrors util.inspect).
    //
    // The filters are attempted unguarded first and only re-run key-by-key if a
    // `getOwnPropertyDescriptor` trap threw, so the common case keeps the original
    // single descriptor lookup per key with no extra call per key.
    let properties: string[];
    let symbols: symbol[];

    try {
        properties = options.showHidden ? allPropertyNames : allPropertyNames.filter((key) => Object.getOwnPropertyDescriptor(object, key)?.enumerable);
    } catch {
        properties = allPropertyNames.filter((key) => safeIsEnumerable(object, key));
    }

    try {
        symbols = allSymbols.filter((key) => options.showHidden || Object.getOwnPropertyDescriptor(object, key)?.enumerable);
    } catch {
        symbols = allSymbols.filter((key) => safeIsEnumerable(object, key));
    }

    // The whole tag computation reads through the prototype chain, the `constructor`
    // property and `Symbol.toStringTag` — three separate hooks a hostile value can
    // throw from. None of them affect *which* properties are printed, so an
    // unreadable tag simply means no tag rather than a failed render.
    let tag: string;

    try {
        const isPlainObject = gPO(object) === Object.prototype || object.constructor === Object;

        const protoTag = object instanceof Object ? "" : "null prototype";

        let stringTag: string;

        if (!isPlainObject && Symbol.toStringTag in object) {
            stringTag = object[Symbol.toStringTag] as string;
        } else {
            stringTag = protoTag ? "Object" : "";
        }

        tag = stringTag || protoTag ? `[${[stringTag, protoTag].filter(Boolean).join(": ")}] ` : "";
    } catch {
        tag = "";
    }

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
