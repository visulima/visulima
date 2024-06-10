import type { Inspect, InspectType, Options } from "../types";
import inspectList from "../utils/inspect-list";
import inspectProperty from "../utils/inspect-property";

const gPO =
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    (typeof Reflect === "function" ? Reflect.getPrototypeOf : Object.getPrototypeOf) ||
    // @ts-expect-error - This is a fallback for older environments
    // eslint-disable-next-line no-restricted-properties,no-proto
    ([].__proto__ === Array.prototype
        ? // eslint-disable-next-line func-names
          function (O) {
              // eslint-disable-next-line no-restricted-properties
              return O.__proto__; // eslint-disable-line no-proto
          }
        : null);

// eslint-disable-next-line sonarjs/cognitive-complexity
const inspectObject: InspectType<object> = (object: object, options: Options, inspect: Inspect): string => {
    if (typeof window !== "undefined" && object === window) {
        return "{ [object Window] }";
    }

    if (typeof global !== "undefined" && object === global) {
        return "{ [object globalThis] }";
    }

    const properties = Object.getOwnPropertyNames(object);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const symbols = Object.getOwnPropertySymbols ? Object.getOwnPropertySymbols(object) : [];

    const isPlainObject = gPO(object) === Object.prototype || object.constructor === Object;

    const protoTag = object instanceof Object ? "" : "null prototype";
    const stringTag = !isPlainObject && typeof Symbol !== "undefined" && Symbol.toStringTag in object ? object[Symbol.toStringTag] : protoTag ? "Object" : "";
    const tag = (stringTag || protoTag ? "[" + [stringTag, protoTag].filter(Boolean).join(": ") + "] " : "");

    if (properties.length === 0 && symbols.length === 0) {
        return tag + "{}";
    }

    // eslint-disable-next-line no-param-reassign
    options.truncate -= 4;
    // eslint-disable-next-line no-param-reassign,@typescript-eslint/no-unnecessary-condition
    options.seen = options.seen ?? [];

    if (options.seen.includes(object)) {
        return "[Circular]";
    }

    options.seen.push(object);

    const propertyContents = inspectList(
        properties.map((key) => [key, object[key as keyof typeof object]]),
        options,
        inspect,
        inspectProperty,
    );
    const symbolContents = inspectList(
        symbols.map((key) => [key, object[key as keyof typeof object]]),
        options,
        inspect,
        inspectProperty,
    );

    options.seen.pop();

    let separator = "";

    if (propertyContents && symbolContents) {
        separator = ", ";
    }

    return tag + "{ " + propertyContents + separator + symbolContents + " }";
};

export default inspectObject;
