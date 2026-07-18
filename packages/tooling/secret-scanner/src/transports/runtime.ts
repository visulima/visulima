// Shared runtime helpers for validator transports:
//   - `tryImport` dynamically loads an optional peer dep via `createRequire`
//     so bundlers (Vite, Rollup, Webpack, Vitest) don't statically analyze
//     the specifier. Missing deps translate to one-time warnings + skipped.
//   - `emitInstallWarning` / `warnMissingDep` throttle messages to once per
//     process per (type, package) pair so a scan with 50 findings doesn't
//     produce 50 identical messages.

import { createRequire } from "node:module";

import type { TransportHostResolver, ValidatorTransport } from "./context";

const runtimeRequire = createRequire(import.meta.url);

const warnedTypes = new Set<string>();
const warnedMissingDeps = new Set<string>();

export const emitInstallWarning = (type: string, transport: ValidatorTransport): void => {
    if (warnedTypes.has(type)) {
        return;
    }

    warnedTypes.add(type);

    const installHint = transport.packageName
        ? `install it with \`npm add ${transport.packageName}\` (or your package manager's equivalent)`
        : "this transport needs a bespoke implementation; open an issue if you need it";
    const summary = transport.summary ? ` — ${transport.summary}` : "";

    // eslint-disable-next-line no-console -- Diagnostic output; stderr is the intended channel for library warnings.
    console.error(`secret-scanner: validator \`${type}\` (${transport.displayName}) is not implemented yet; ${installHint}${summary}`);
};

export const warnMissingDep = (type: string, packageName: string): void => {
    const key = `${type}:${packageName}`;

    if (warnedMissingDeps.has(key)) {
        return;
    }

    warnedMissingDeps.add(key);

    // eslint-disable-next-line no-console -- Diagnostic output; stderr is the intended channel for library warnings.
    console.error(
        `secret-scanner: \`${type}\` validator requires \`${packageName}\` — install it to verify findings from this rule, or disable the rule. Skipping validation.`,
    );
};

/**
 * Load an optional peer dependency at runtime. Returns the module export on
 * success, or `undefined` when the dep isn't installed (emitting a one-time
 * missing-dep warning). Rethrows any non-"module not found" errors so genuine
 * bugs in the user's peer dep surface loudly.
 *
 * Detection prefers the structured `error.code` field (Node sets
 * `MODULE_NOT_FOUND` / `ERR_MODULE_NOT_FOUND`) and falls back to a message
 * regex only when `code` is missing — bundlers and ESM loaders don't always
 * preserve `code`.
 */
const MODULE_NOT_FOUND_PATTERN = /Cannot find (?:module|package)|ERR_MODULE_NOT_FOUND|Failed to resolve module specifier|Could not resolve/i;
const MODULE_NOT_FOUND_CODES = new Set(["ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND"]);

export const tryImport = async <T>(packageName: string, type: string): Promise<T | undefined> => {
    try {
        return runtimeRequire(packageName) as T;
    } catch (error) {
        const { code } = error as { code?: unknown };
        const isMissingByCode = typeof code === "string" && MODULE_NOT_FOUND_CODES.has(code);
        const message = error instanceof Error ? error.message : String(error);
        const isMissingByMessage = code === undefined && MODULE_NOT_FOUND_PATTERN.test(message);

        if (isMissingByCode || isMissingByMessage) {
            warnMissingDep(type, packageName);

            return undefined;
        }

        throw error;
    }
};

/**
 * Extract a `mongodb://…`, `mysql://…`, `postgres://…` URI from a rule's
 * captured secret. Some rules capture the whole `user:pass@host/db` URI as
 * group 1; others capture a token-shaped substring. Returns `undefined` when we
 * can't find a parseable URI — the validator skips in that case rather than
 * guessing.
 */
const URI_PATTERN_CACHE = new Map<string, RegExp>();

export const extractUri = (secret: string, scheme: string): string | undefined => {
    const trimmed = secret.trim();

    if (trimmed.startsWith(`${scheme}://`) || trimmed.startsWith(`${scheme}+srv://`)) {
        return trimmed;
    }

    let uriPattern = URI_PATTERN_CACHE.get(scheme);

    if (!uriPattern) {
        uriPattern = new RegExp(String.raw`${scheme}(?:\+srv)?://\S+`);
        URI_PATTERN_CACHE.set(scheme, uriPattern);
    }

    const match = uriPattern.exec(trimmed);

    return match ? match[0] : undefined;
};

/**
 * Derive the outbound host (`host` or `host:port`) from a connection URI for
 * the allowlist gate. Returns `undefined` when the URI can't be parsed (e.g. a
 * comma-separated replica-set list) — the caller then fails closed when an
 * allowlist is active. Matches the HTTP validator's `URL.host` comparison so a
 * single allowlist entry covers both transports.
 */
export const hostFromUri = (uri: string): string | undefined => {
    try {
        return new URL(uri).host;
    } catch {
        return undefined;
    }
};

/**
 * Build a host resolver for a connection-string transport: extract the first
 * URI matching one of `schemes` from the captured secret and read its host for
 * the allowlist gate. Returns `undefined` when no scheme matches or the URI
 * can't be parsed to a host — fail-closed when an allowlist is active.
 */
export const createUriHostResolver
    = (...schemes: [string, ...string[]]): TransportHostResolver =>
        ({ secret }) => {
            let uri: string | undefined;

            for (const scheme of schemes) {
                uri = extractUri(secret, scheme);

                if (uri) {
                    break;
                }
            }

            if (!uri) {
                return undefined;
            }

            const host = hostFromUri(uri);

            return host === undefined ? undefined : [host];
        };

/** Test-only: reset the warning caches so test ordering doesn't matter. */
export const resetWarningsForTests = (): void => {
    warnedTypes.clear();
    warnedMissingDeps.clear();
};
