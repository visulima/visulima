import type { Options } from "../types";
import inspectObject from "./object";

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
const toStringTag = typeof Symbol !== "undefined" && Symbol.toStringTag ? Symbol.toStringTag : false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inspectClass = (value: new (...arguments_: any[]) => unknown, options: Options): string => {
    let name = "";

    if (toStringTag && toStringTag in value) {
        // eslint-disable-next-line security/detect-object-injection
        name = value[toStringTag] as string;
    }

    name = name || value.constructor.name;

    // Babel transforms anonymous classes to the name `_class`
    if (!name || name === "_class") {
        name = "<Anonymous Class>";
    }

    // eslint-disable-next-line no-param-reassign
    options.truncate -= name.length;

    return `${name}${inspectObject(value, options)}`;
}

export default inspectClass;
