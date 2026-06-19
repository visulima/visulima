/**
 * Yarn Plug'n'Play detection for `vis x`. Only active when a `.pnp.cjs` is present
 * (a Yarn PnP tree — only Yarn generates it). In a PnP tree there is no
 * `node_modules`; resolution goes through the `.pnp.cjs` runtime, so the Node
 * process running the script must load it (`--require &lt;.pnp.cjs>`, plus the
 * `.pnp.loader.mjs` ESM loader) before the script's bare imports resolve. Ported
 * from the dropped Rust launcher's pnp module.
 */
import { existsSync } from "node:fs";

import { dirname, join } from "@visulima/path";

export interface PnpContext {
    /** The sibling `.pnp.loader.mjs` ESM loader, if Yarn generated one. */
    esmLoader: string | undefined;
    /** The `.pnp.cjs` runtime to `--require`. */
    pnpCjs: string;
}

/** Walk up from `cwd` to the nearest `.pnp.cjs`. `undefined` when not a PnP tree. */
export const detectPnp = (cwd: string): PnpContext | undefined => {
    let directory = cwd;

    for (;;) {
        const candidate = join(directory, ".pnp.cjs");

        if (existsSync(candidate)) {
            const loader = join(directory, ".pnp.loader.mjs");

            return { esmLoader: existsSync(loader) ? loader : undefined, pnpCjs: candidate };
        }

        const parent = dirname(directory);

        if (parent === directory) {
            return undefined;
        }

        directory = parent;
    }
};

/**
 * Node start args that load the PnP runtime + ESM loader before the entry, so the
 * script's bare imports resolve through PnP. Empty when not in a PnP tree.
 */
export const pnpNodeArgs = (cwd: string): string[] => {
    const context = detectPnp(cwd);

    if (context === undefined) {
        return [];
    }

    const args = ["--require", context.pnpCjs];

    if (context.esmLoader !== undefined) {
        args.push("--import", context.esmLoader);
    }

    return args;
};
