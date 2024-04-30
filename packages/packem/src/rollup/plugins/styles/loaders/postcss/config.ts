import path from "node:path";

import { cosmiconfig } from "cosmiconfig";
import type { AcceptedPlugin, Parser, PluginCreator, Stringifier, Syntax } from "postcss";

import type { PostCSSConfigLoaderOptions } from "../../types";
import { ensurePCSSOption, ensurePCSSPlugins } from "../../utils/options";

interface Options {
    parser?: Parser;
    stringifier?: Stringifier;
    syntax?: Syntax;
}

interface Config extends Options {
    plugins?: (PluginCreator<unknown> | string)[] | Record<string, Record<string, unknown>>;
}

interface Result {
    options: Options;
    plugins: AcceptedPlugin[];
}

export default async function (id: string, config: PostCSSConfigLoaderOptions | false): Promise<Result> {
    if (!config) {
        return { options: {}, plugins: [] };
    }

    const { base, dir, ext } = path.parse(id);

    type Found = { config: Config | ((context: Record<string, unknown>) => Config); isEmpty?: boolean };
    const searchPath = config.path ? path.resolve(config.path) : dir;
    const found: Found | null = await cosmiconfig("postcss").search(searchPath);

    if (!found || found.isEmpty) {
        return { options: {}, plugins: [] };
    }

    const { parser, plugins, stringifier, syntax } =
        typeof found.config === "function"
            ? found.config({
                  cwd: process.cwd(),
                  env: process.env.NODE_ENV ?? "development",
                  file: { basename: base, dirname: dir, extname: ext },
                  options: config.ctx ?? {},
              })
            : found.config;

    const result: Result = { options: {}, plugins: ensurePCSSPlugins(plugins) };

    if (parser) {
        result.options.parser = ensurePCSSOption(parser, "parser");
    }

    if (syntax) {
        result.options.syntax = ensurePCSSOption(syntax, "syntax");
    }

    if (stringifier) {
        result.options.stringifier = ensurePCSSOption(stringifier, "stringifier");
    }

    return result;
}
