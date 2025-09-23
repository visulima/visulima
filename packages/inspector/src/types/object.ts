import type { Indent, InspectType, InternalInspect, Options } from "../types";
import { indentedJoin } from "../utils/indent";
import inspectList from "../utils/inspect-list";
import inspectProperty from "../utils/inspect-property";

const gPO
    = (typeof Reflect === "function" ? Reflect.getPrototypeOf : Object.getPrototypeOf)
    // @ts-expect-error - This is a fallback for older environments
    // eslint-disable-next-line no-restricted-properties,no-proto
        || ([].__proto__ === Array.prototype
            ? // eslint-disable-next-line func-names
            function (O) {
            // eslint-disable-next-line no-restricted-properties
                return O.__proto__; // eslint-disable-line no-proto
            }
            : undefined);

const getKeys = (object: object, options: Options): (string | symbol)[] => {
    const keys: (string | symbol)[] = Object.getOwnPropertyNames(object);

    if (options.showHidden) {
        const symbols = Object.getOwnPropertySymbols(object);

        return [...keys, ...symbols];
    }

    return keys;
};

// eslint-disable-next-line sonarjs/cognitive-complexity
const inspectObject: InspectType<object> = (object: object, options: Options, inspect: InternalInspect, indent: Indent | undefined, depth: number): string => {
    if (globalThis.window !== undefined && object === globalThis) {
        return "{ [object Window] }";
    }

    if ((typeof globalThis !== "undefined" && object === globalThis) || (globalThis.global !== undefined && object === globalThis)) {
        return "{ [object globalThis] }";
    }

    const properties = getKeys(object, options);

    if (options.sorted) {
        properties.sort((a, b) => {
            if (typeof options.sorted === "function") {
                return options.sorted(String(a), String(b));
            }

            return String(a).localeCompare(String(b));
        });
    }

    let symbols = Object.getOwnPropertySymbols ? Object.getOwnPropertySymbols(object) : [];
    const isPlainObject = gPO(object) === Object.prototype || object.constructor === Object;
    let protoTag = "";
    let currentProto = gPO(object);

    if (currentProto === null) {
        protoTag = "null prototype";
    } else {
        while (currentProto !== null && currentProto !== Object.prototype) {
            if (gPO(currentProto) === null) {
                protoTag = "null prototype";
                break;
            }

            currentProto = gPO(currentProto);
        }
    }

    let stringTag = "";
    let hasToStringTag = false;

    if (typeof object === "object" && typeof Symbol !== "undefined" && Symbol.toStringTag in object) {
        stringTag = object[Symbol.toStringTag] as string;
        hasToStringTag = true;
        // Exclude Symbol.toStringTag from displayed symbols
        symbols = symbols.filter((sym) => sym !== Symbol.toStringTag);
    } else if (!isPlainObject && (object.constructor === Object || protoTag)) {
        stringTag = "Object";
    }

    let tag: string = "";

    if (hasToStringTag && protoTag) {
        tag = `[${stringTag}: ${protoTag}] `;
    } else if (stringTag && protoTag) {
        tag = `[${stringTag}: ${protoTag}] `;
    } else if (stringTag) {
        tag = `${stringTag} `;
    } else if (protoTag) {
        tag = `[${protoTag}] `;
    }

    if (properties.length === 0 && symbols.length === 0) {
        return `${tag}{}`;
    }

    const temporaryOptions = { ...options, maxStringLength: Number.POSITIVE_INFINITY };
    const propertyContentsForCheck = inspectList(
        properties.map((key) => [key, object[key as keyof typeof object]]),
        object,
        temporaryOptions,
        inspect,
        inspectProperty,
    );
    const symbolContentsForCheck = inspectList(
        symbols.map((key) => [key, object[key as keyof typeof object]]),
        object,
        temporaryOptions,
        inspect,
        inspectProperty,
    );
    let separatorForCheck = "";

    if (propertyContentsForCheck && symbolContentsForCheck) {
        separatorForCheck = ", ";
    }

    const singleLineOutput = `${tag}{ ${propertyContentsForCheck}${separatorForCheck}${symbolContentsForCheck} }`;

    const multiline
        = (options.compact === false || (typeof options.compact === "number" && depth >= options.compact) || singleLineOutput.length > options.breakLength)
            && indent !== undefined;

    // eslint-disable-next-line no-param-reassign
    options.maxStringLength -= 4;

    const propertyContents = inspectList(
        properties.map((key) => {
            const descriptor = Object.getOwnPropertyDescriptor(object, key);

            if (descriptor?.get) {
                if (options.getters) {
                    const invoke
                        = options.getters === true || (options.getters === "get" && !descriptor.set) || (options.getters === "set" && !!descriptor.set);

                    if (invoke) {
                        try {
                            return [key, descriptor.get.call(object)];
                        } catch {
                            // ignore
                        }
                    }
                }

                return [key, descriptor.get];
            }

            return [key, object[key as keyof typeof object]];
        }),
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

    if (multiline) {
        return `${tag}{${indentedJoin(propertyContents + separator + symbolContents, indent as Indent)}}`;
    }

    return `${tag}{ ${propertyContents}${separator}${symbolContents} }`;
};

export default inspectObject;
