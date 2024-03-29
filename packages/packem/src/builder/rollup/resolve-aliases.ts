import type { PackageJson } from "@visulima/package";
import { join } from "pathe";

import type { BuildContext } from "../../types";

const resolveAliases = (context: BuildContext): Record<string, string> => {
    let aliases: Record<string, string> = {};

    if (context.pkg.name) {
        aliases[context.pkg.name] = context.options.rootDir;
    }

    if (context.pkg.imports) {
        const { imports } = context.pkg;

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const alias in imports) {
            if (alias.startsWith("#")) {
                // eslint-disable-next-line no-continue
                continue;
            }

            const subpath = imports[alias as keyof PackageJson["imports"]];

            if (typeof subpath !== "string") {
                // eslint-disable-next-line no-continue
                continue;
            }

            aliases[alias] = join(context.rootDir, subpath);
        }
    }

    aliases = {
        ...aliases,
        ...context.options.alias,
    };

    if (context.options.rollup.alias) {
        if (Array.isArray(context.options.rollup.alias.entries)) {
            Object.assign(aliases, Object.fromEntries(context.options.rollup.alias.entries.map((entry) => [entry.find, entry.replacement])));
        } else {
            Object.assign(aliases, context.options.rollup.alias.entries || context.options.rollup.alias);
        }
    }

    return aliases;
};

export default resolveAliases;
