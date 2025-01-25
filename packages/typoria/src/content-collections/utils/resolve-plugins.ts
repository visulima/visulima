import type { Pluggable, Plugin } from "unified";

export type ResolvePlugins = Pluggable[] | ((v: Pluggable[]) => Pluggable[]);

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export const resolvePlugins = (def: (v: Pluggable[]) => (Pluggable | false)[], options: ResolvePlugins = []): Pluggable[] => {
    const list = def(Array.isArray(options) ? options : []).filter(Boolean) as Pluggable[];

    if (typeof options === "function") {
        return options(list);
    }

    return list;
}

export const resolvePlugin = <Parameter>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- config type
    plugin: Plugin<[Parameter], any, any>,
    options: Parameter | boolean,
    defaultOptions?: Parameter,
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
): Pluggable | false => {
    if (typeof options === "boolean") {
        return options ? [plugin, defaultOptions] : false;
    }

    return [plugin, { ...defaultOptions, ...options }];
}
