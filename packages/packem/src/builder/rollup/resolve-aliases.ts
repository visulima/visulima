import type { BuildContext } from "../../types";

const resolveAliases = (context: BuildContext): Record<string, string> => {
    const aliases: Record<string, string> = {
        [context.pkg.name!]: context.options.rootDir,
        ...context.options.alias,
    };

    if (context.options.rollup.alias) {
        if (Array.isArray(context.options.rollup.alias.entries)) {
            Object.assign(
                aliases,
                Object.fromEntries(
                    context.options.rollup.alias.entries.map((entry) => [entry.find, entry.replacement]),
                ),
            );
        } else {
            Object.assign(aliases, context.options.rollup.alias.entries || context.options.rollup.alias);
        }
    }

    return aliases;
};

export default resolveAliases;
