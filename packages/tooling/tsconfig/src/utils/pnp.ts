/**
 * A modified version from `https://github.com/privatenumber/get-tsconfig`
 *
 * MIT License
 * Copyright (c) Hiroki Osame &lt;hiroki.osame@gmail.com>
 */
import Module from "node:module";

type PnpApi = {
    resolveRequest: (request: string, issuer: string, options?: { extensions?: string[] }) => string | null;
};

/**
 * Returns the Yarn Berry pnp API discovered from `from` (defaults to the
 * current process CWD), or `undefined` when not running under pnp.
 *
 * The issuer matters: a process started outside the pnp workspace can still
 * resolve into it as long as `from` points inside the workspace.
 * @see https://yarnpkg.com/advanced/pnpapi/#requirepnpapi
 */
// eslint-disable-next-line import/prefer-default-export
export const getPnpApi = (from: string = process.cwd()): PnpApi | undefined => {
    const { findPnpApi } = Module as unknown as { findPnpApi?: (path: string) => PnpApi | undefined };

    return findPnpApi ? findPnpApi(from) : undefined;
};
