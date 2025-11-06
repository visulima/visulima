import type { Indent, InspectType, InternalInspect, Options } from "../types";
import inspectObject from "./object";

const inspectClass: InspectType<new (...arguments_: any[]) => unknown> = (

    value: new (...arguments_: any[]) => unknown,
    options: Options,
    inspect: InternalInspect,
    indent: Indent | undefined,
): string => {
    let name = "";

    name = name || value.constructor.name;

    // Babel transforms anonymous classes to the name `_class`
    if (!name || name === "_class") {
        name = "<Anonymous Class>";
    }

    // eslint-disable-next-line no-param-reassign
    options.truncate -= name.length;

    return `${name} ${inspectObject(value, options, inspect, indent)}`;
};

export default inspectClass;
