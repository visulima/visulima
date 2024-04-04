/**
 * Modified copy of https://github.com/privatenumber/pkgroll/blob/develop/src/utils/rollup-plugins/externalize-node-builtins.ts
 *
 * MIT License
 *
 * Copyright (c) Hiroki Osame <hiroki.osame@gmail.com>
 */
import { builtinModules } from "node:module";

import type { Plugin } from "rollup";
import { compare } from "semver";

/**
 * Implemented as a plugin instead of the external API
 * to support altering the import specifier to remove `node:`
 *
 * Alternatively, we can create a mapping via output.paths
 * but this seems cleaner
 */
const externalizeNodeBuiltins = (target: string[]): Plugin => {
    /**
     * Only remove protocol if a Node.js version that doesn't
     * support it is specified.
     */
    const stripNodeProtocol = target.some((platform): boolean | undefined => {
        // eslint-disable-next-line no-param-reassign
        platform = platform.trim();

        // Ignore non Node platforms
        if (!platform.startsWith("node")) {
            return undefined;
        }

        const parsedVersion = platform.slice(4).split(".").map(Number);
        const semver = parsedVersion[0] + "." + (parsedVersion[1] ?? 0) + "." + (parsedVersion[2] ?? 0);

        return !(
            // 12.20.0 <= x < 13.0.0
            (
                (compare(semver, "12.20.0") >= 0 && compare(semver, "13.0.0") < 0) ||
                // 14.13.1 <= x
                compare(semver, "14.13.1") >= 0
            )
        );
    });

    return {
        name: "packem:externalize-node-builtins",
        resolveId: (id: string) => {
            const hasNodeProtocol = id.startsWith("node:");

            if (stripNodeProtocol && hasNodeProtocol) {
                // eslint-disable-next-line no-param-reassign
                id = id.slice(5);
            }

            if (builtinModules.includes(id) || hasNodeProtocol) {
                return {
                    external: true,
                    id,
                };
            }

            return null;
        },
    };
};

export default externalizeNodeBuiltins;
