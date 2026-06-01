/**
 * Early-process `--ca-cert` parser. Runs before any TLS module loads
 * so `process.env.NODE_EXTRA_CA_CERTS` is in place by the time Node's
 * `tls.createSecureContext` reads it (lazy on first TLS handshake).
 *
 * Supports both `--ca-cert /path/to/ca.pem` and `--ca-cert=/path/to/ca.pem`.
 * Returns the resolved absolute path, or `undefined` when the flag isn't
 * present. Does not validate that the file exists — Node's TLS layer
 * surfaces a clear error on first connect when the path is bad, and we
 * don't want to crash unrelated commands at startup over a missing cert.
 */

import { resolve } from "node:path";

export const parseEarlyCaCert = (argv: ReadonlyArray<string>): string | undefined => {
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index]!;

        if (argument === "--ca-cert") {
            const value = argv[index + 1];

            if (value === undefined || value.startsWith("-")) {
                return undefined;
            }

            return resolve(value);
        }

        if (argument.startsWith("--ca-cert=")) {
            const value = argument.slice("--ca-cert=".length);

            if (value === "") {
                return undefined;
            }

            return resolve(value);
        }
    }

    return undefined;
};
