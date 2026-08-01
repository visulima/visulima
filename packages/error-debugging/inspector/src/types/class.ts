import type { Indent, InspectType, InternalInspect, Options } from "../types";
import inspectObject from "./object";

const inspectClass: InspectType<new (...arguments_: any[]) => unknown> = (

    value: new (...arguments_: any[]) => unknown,
    options: Options,
    inspect: InternalInspect,
    indent: Indent | undefined,
): string => {
    let name: string;

    try {
        name = typeof value.constructor === "function" ? value.constructor.name : "";
    } catch {
        // A hostile `get` trap: the constructor (or its `name`) is unreadable, which
        // is indistinguishable from an anonymous one for labelling purposes.
        name = "";
    }

    // Babel transforms anonymous classes to the name `_class`
    if (!name || name === "_class") {
        name = "<Anonymous Class>";
    }

    // eslint-disable-next-line no-param-reassign
    options.truncate -= name.length;

    return `${name} ${inspectObject(value, options, inspect, indent)}`;
};

export default inspectClass;
