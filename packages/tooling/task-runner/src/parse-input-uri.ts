import type { InputDefinition } from "./types";

/**
 * URI schemes recognized by {@link parseInputUri}. Each maps to one of the
 * existing structured `InputDefinition` shapes — the URI form is a sugar
 * over the object form so the same hash semantics apply unchanged.
 *
 * - `file://&lt;path>` and `glob://&lt;pattern>` → {@link FileSetInput}
 *   (both produce a fileset; the split is purely documentary so a reader
 *   can tell at a glance whether the author meant a single path or a glob).
 * - `env://&lt;NAME>` → {@link EnvironmentInput}.
 * - `func://&lt;command>` → {@link RuntimeInput} (runtime command output).
 * - `dep://&lt;a,b,c>` → {@link ExternalDependencyInput} (comma-separated names).
 *
 * `{projectRoot}` and `{workspaceRoot}` tokens are honored inside `file://`
 * and `glob://` bodies, matching the bare-string form. Negation works for
 * filesets only (`!file://...`, `!glob://...`); attempting to negate the
 * other schemes throws because there is no semantic for "not this env var".
 */
export const INPUT_URI_SCHEMES = ["file", "glob", "env", "func", "dep"] as const;

export type InputUriScheme = (typeof INPUT_URI_SCHEMES)[number];

const URI_SCHEME_RE = /^([a-z][a-z0-9+.-]*):\/\//i;

/**
 * Thrown when a string carries a URI-shaped prefix but the scheme is
 * unrecognized or the body violates a scheme-specific constraint
 * (e.g. negating a non-fileset scheme).
 *
 * Surfaces as a config-load error rather than degrading silently into a
 * fileset glob — silent fallback would let typos like `gob://**` mask
 * cache-correctness bugs that only show up at hash-divergence time.
 */
export class InvalidInputUriError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = "InvalidInputUriError";
    }
}

/**
 * Parses a URI-prefixed input string into its structured `InputDefinition`.
 * Returns `undefined` for strings that don't carry a URI scheme — callers
 * fall back to existing handling (named-input lookup, bare globs).
 */
export const parseInputUri = (input: string): InputDefinition | undefined => {
    const negated = input.startsWith("!");
    const body = negated ? input.slice(1) : input;
    const match = URI_SCHEME_RE.exec(body);

    if (!match) {
        return undefined;
    }

    // Schemes are case-insensitive at the prefix (canonical form is
    // lowercase) so `FILE://path` is treated as a typo'd `file://`
    // rather than degrading silently into a literal-string fileset.
    const scheme = (match[1] as string).toLowerCase();
    const rest = body.slice(match[0].length);

    switch (scheme) {
        case "file":
        case "glob": {
            if (rest.length === 0) {
                throw new InvalidInputUriError(`${scheme}:// input requires a path or pattern (got "${input}").`);
            }

            return { fileset: negated ? `!${rest}` : rest };
        }
        case "env": {
            if (negated) {
                throw new InvalidInputUriError(`Negation is not supported for env:// inputs (got "${input}"). Drop env vars from the named-input set instead.`);
            }

            if (rest.length === 0) {
                throw new InvalidInputUriError(`env:// input requires a variable name (got "${input}").`);
            }

            return { env: rest };
        }
        case "func": {
            if (negated) {
                throw new InvalidInputUriError(`Negation is not supported for func:// inputs (got "${input}").`);
            }

            if (rest.length === 0) {
                throw new InvalidInputUriError(`func:// input requires a command (got "${input}").`);
            }

            return { runtime: rest };
        }
        case "dep": {
            if (negated) {
                throw new InvalidInputUriError(`Negation is not supported for dep:// inputs (got "${input}").`);
            }

            if (rest.length === 0) {
                throw new InvalidInputUriError(`dep:// input requires at least one dependency name (got "${input}").`);
            }

            // Reject any empty segment, not just fully-empty bodies.
            // `dep://a,` and `dep://a,,b` are typos that previously
            // got silently filtered down to valid-looking inputs.
            const names = rest.split(",").map((s) => s.trim());

            if (names.some((s) => s.length === 0)) {
                throw new InvalidInputUriError(`dep:// input contains an empty dependency segment (got "${input}"). Remove trailing or repeated commas.`);
            }

            return { externalDependencies: names };
        }
        default: {
            throw new InvalidInputUriError(
                `Unknown input URI scheme "${scheme}://" in "${input}". Recognized schemes: ${INPUT_URI_SCHEMES.map((s) => `${s}://`).join(", ")}.`,
            );
        }
    }
};

/**
 * Cheap predicate used by callers that only need to know whether a string
 * looks like a URI — saves them re-parsing when they want to short-circuit
 * other handling (e.g. file-group lookup) before delegating to
 * {@link parseInputUri} downstream.
 */
export const looksLikeInputUri = (input: string): boolean => {
    const body = input.startsWith("!") ? input.slice(1) : input;

    return URI_SCHEME_RE.test(body);
};
