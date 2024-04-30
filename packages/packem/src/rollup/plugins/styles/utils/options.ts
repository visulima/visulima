import type { AcceptedPlugin } from "postcss";

import type { LoaderContext } from "../loaders/types";
import type { Options, PostCSSLoaderOptions } from "../types";
import arrayFmt from "./array-fmt";
import loadModule from "./load-module";

export function inferOption<T, TDef extends T | boolean>(option: T | boolean | undefined, defaultValue: TDef): T | TDef | false {
    if (typeof option === "boolean") {
        return option && ({} as TDef);
    }

    if (typeof option === "object") {
        return option;
    }

    return defaultValue;
}

interface Mode {
    emit: PostCSSLoaderOptions["emit"];
    extract: PostCSSLoaderOptions["extract"];
    inject: PostCSSLoaderOptions["inject"];
}

const modes = ["inject", "extract", "emit"];
const modesFmt = arrayFmt(modes);
export function inferModeOption(mode: Options["mode"]): Mode {
    const m = Array.isArray(mode) ? mode : ([mode] as const);

    if (m[0] && !modes.includes(m[0])) {
        throw new Error(`Incorrect mode provided, allowed modes are ${modesFmt}`);
    }

    return {
        emit: m[0] === "emit",
        extract: m[0] === "extract" && (m[1] ?? true),
        inject: (!m[0] || m[0] === "inject") && (m[1] ?? true),
    };
}

export function inferSourceMapOption(sourceMap: Options["sourceMap"]): LoaderContext["sourceMap"] {
    const sm = Array.isArray(sourceMap) ? sourceMap : ([sourceMap] as const);

    if (!sm[0]) {
        return false;
    }

    return { content: true, ...sm[1], inline: sm[0] === "inline" };
}

export function inferHandlerOption<T extends { alias?: Record<string, string> }>(option: T | boolean | undefined, alias: T["alias"]): T | false {
    const opt = inferOption(option, {} as T);

    if (alias && typeof opt === "object" && !opt.alias) {
        opt.alias = alias;
    }

    return opt;
}

export function ensureUseOption(options: Options): [string, Record<string, unknown>][] {
    const all: Record<string, [string, Record<string, unknown>]> = {
        less: ["less", options.less ?? {}],
        sass: ["sass", options.sass ?? {}],
        stylus: ["stylus", options.stylus ?? {}],
    };

    if (options.use === undefined) {
        return Object.values(all);
    }

    if (!Array.isArray(options.use)) {
        throw new TypeError("`use` option must be an array!");
    }

    return options.use.map((loader) => {
        if (typeof loader !== "string") {
            throw new TypeError("`use` option must be an array of strings!");
        }

        return all[loader] || [loader, {}];
    });
}

type PCSSOption = "parser" | "plugin" | "stringifier" | "syntax";

export function ensurePCSSOption<T>(option: T | string, type: PCSSOption): T {
    if (typeof option !== "string") {
        return option;
    }

    const module = loadModule(option);

    if (!module) {
        throw new Error(`Unable to load PostCSS ${type} \`${option}\``);
    }

    return module as T;
}

export function ensurePCSSPlugins(plugins: Options["plugins"]): AcceptedPlugin[] {
    if (plugins === undefined) {
        return [];
    }

    if (typeof plugins !== "object") {
        throw new TypeError("`plugins` option must be an array or an object!");
    }

    const ps: AcceptedPlugin[] = [];

    for (const p of Array.isArray(plugins) ? plugins : Object.entries(plugins)) {
        if (!p) {
            continue;
        }

        if (!Array.isArray(p)) {
            ps.push(ensurePCSSOption(p, "plugin"));

            continue;
        }

        const [plug, options] = p;

        if (options) {
            ps.push(ensurePCSSOption(plug, "plugin")(options));
        } else {
            ps.push(ensurePCSSOption(plug, "plugin"));
        }
    }

    return ps;
}
