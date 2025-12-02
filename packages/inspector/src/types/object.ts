import type { Indent, InspectType, InternalInspect, Options } from "../types";
import { indentedJoin } from "../utils/indent";
import inspectList from "../utils/inspect-list";
import inspectProperty from "../utils/inspect-property";

const gPO = (typeof Reflect === "function" ? Reflect.getPrototypeOf : Object.getPrototypeOf)
// @ts-expect-error - This is a fallback for older environments
// eslint-disable-next-line no-restricted-properties,no-proto
    || ([].__proto__ === Array.prototype
    // eslint-disable-next-line func-names
        ? function (O) {
            // eslint-disable-next-line no-restricted-properties
            return O.__proto__; // eslint-disable-line no-proto
        }
        : null);

// eslint-disable-next-line sonarjs/cognitive-complexity
const inspectObject: InspectType<object> = (object: object, options: Options, inspect: InternalInspect, indent: Indent | undefined): string => {
    if (globalThis.window !== undefined && object === globalThis) {
        return "{ [object Window] }";
    }

    if ((typeof globalThis !== "undefined" && object === globalThis) || (globalThis.global !== undefined && object === globalThis)) {
        return "{ [object globalThis] }";
    }

    const properties = Object.getOwnPropertyNames(object);

    const symbols = Object.getOwnPropertySymbols ? Object.getOwnPropertySymbols(object) : [];

    const isPlainObject = gPO(object) === Object.prototype || object.constructor === Object;

    const protoTag = object instanceof Object ? "" : "null prototype";
    const stringTag = !isPlainObject && typeof Symbol !== "undefined" && Symbol.toStringTag in object ? object[Symbol.toStringTag] : protoTag ? "Object" : "";
    const tag = stringTag || protoTag ? `[${[stringTag, protoTag].filter(Boolean).join(": ")}] ` : "";

    if (properties.length === 0 && symbols.length === 0) {
        return `${tag}{}`;
    }

    // eslint-disable-next-line no-param-reassign
    options.truncate -= 4;

    const propertyContents = inspectList(
        properties.map((key) => [key, object[key as keyof typeof object]]),
        object,
        options,
        inspect,
        inspectProperty,
    );
    const symbolContents = inspectList(
        symbols.map((key) => [key, object[key as keyof typeof object]]),
        object,
        options,
        inspect,
        inspectProperty,
    );

    let separator = "";

    if (propertyContents && symbolContents) {
        separator = ", ";
    }

    if (indent) {
        return `${tag}{${indentedJoin(propertyContents + separator + symbolContents, indent)}}`;
    }

    return `${tag}{ ${propertyContents}${separator}${symbolContents} }`;
};

export default inspectObject;
