import type { InspectType, InternalInspect } from "../types";
import inspectObject from "./object";

const inspectProxy: InspectType<object> = (value, options, inspect, indent, depth): string => {
    const newOptions = { ...options, showProxy: false };

    if (Array.isArray(value)) {
        const output = [];

        for (const item of value) {
            output.push((inspect as InternalInspect)(item, value, newOptions));
        }

        return `Proxy [ [ ${output.join(", ")} ] ]`;
    }

    return `Proxy [ ${inspectObject(value, newOptions, inspect, indent, depth)} ]`;
};

export default inspectProxy;
