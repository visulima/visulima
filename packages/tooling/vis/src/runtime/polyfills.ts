/**
 * Feature-detected JS polyfills for `vis x` user scripts — the runtime
 * augmentation layer's polyfill tier. Strictly opt-in (launcher `--polyfill`,
 * surfaced as VIS_POLYFILL) and strictly feature-detected: a polyfill is only
 * installed onto `globalThis` when the native API is actually absent, so newer
 * runtimes that already ship the API are never touched.
 *
 * Scope is the user script run via `vis x` only — vis's own runtime is never
 * polyfilled.
 *
 * Two flavours live here:
 *
 * - **Inline shims** — tiny, dependency-free implementations written directly in
 *   this file (`reportError`, `RegExp.escape`, `Promise.try`, `Float16Array`,
 *   `Error.isError`, `navigator.locks`). No core-js, no package resolution.
 * - **Package-backed shims** — heavyweight APIs (`Temporal`, `URLPattern`) whose
 *   polyfill packages are NOT vis dependencies: they're resolved from the *user's*
 *   project (the cwd where `vis x` runs), where a script needing them would declare
 *   them. If one isn't installed we warn and continue.
 *
 * Every installer feature-detects first, so a runtime that already ships the API
 * natively is left untouched — native always wins.
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

import { join } from "@visulima/path";

type PolyfillName = "error-iserror" | "float16array" | "navigator-locks" | "promise-try" | "regexp-escape" | "reporterror" | "temporal" | "urlpattern";

const ALL: PolyfillName[] = ["temporal", "urlpattern", "reporterror", "regexp-escape", "promise-try", "float16array", "error-iserror", "navigator-locks"];

/** Parse the VIS_POLYFILL spec: "all", or a comma list like "temporal,urlpattern". */
const parseSpec = (spec: string): PolyfillName[] => {
    const trimmed = spec.trim().toLowerCase();

    if (trimmed === "" || trimmed === "all" || trimmed === "1" || trimmed === "true") {
        return ALL;
    }

    return trimmed
        .split(",")
        .map((part) => part.trim())
        .filter((part): part is PolyfillName => (ALL as string[]).includes(part));
};

/**
 * Import a package resolved from the user's project (cwd), not vis's own tree.
 * Returns the module namespace, or undefined if the package isn't installed there.
 */
const importFromCwd = async (packageName: string, cwd: string): Promise<Record<string, unknown> | undefined> => {
    try {
        // Anchor module resolution in the user's project so `resolve` walks THEIR
        // node_modules, not vis's. createRequire only uses its argument as a
        // resolution base path — the file need not (and does not) exist; the
        // `__vis_polyfill_resolver__.js` name is a deliberate non-existent anchor
        // sitting in `cwd`, equivalent to "resolve as if from a file in cwd".
        const requireFromCwd = createRequire(join(cwd, "__vis_polyfill_resolver__.js"));
        const resolved = requireFromCwd.resolve(packageName);

        return (await import(pathToFileURL(resolved).href)) as Record<string, unknown>;
    } catch {
        return undefined;
    }
};

/** Install `Temporal` from the `@js-temporal/polyfill` package if the runtime lacks it. */
const installTemporal = async (cwd: string): Promise<void> => {
    if ((globalThis as Record<string, unknown>)["Temporal"] !== undefined) {
        return;
    }

    const loaded = await importFromCwd("@js-temporal/polyfill", cwd);

    if (loaded?.["Temporal"] === undefined) {
        process.stderr.write("vis: --polyfill temporal requested but @js-temporal/polyfill is not installed in this project.\n");
    } else {
        (globalThis as Record<string, unknown>)["Temporal"] = loaded["Temporal"];
    }
};

/** Install `URLPattern` from the `urlpattern-polyfill` package if the runtime lacks it. */
const installUrlPattern = async (cwd: string): Promise<void> => {
    if ((globalThis as Record<string, unknown>)["URLPattern"] !== undefined) {
        return;
    }

    const loaded = await importFromCwd("urlpattern-polyfill", cwd);

    if (loaded?.["URLPattern"] === undefined) {
        process.stderr.write("vis: --polyfill urlpattern requested but urlpattern-polyfill is not installed in this project.\n");
    } else {
        (globalThis as Record<string, unknown>)["URLPattern"] = loaded["URLPattern"];
    }
};

// --- Inline shims --------------------------------------------------------------
//
// These are tiny, spec-faithful, dependency-free implementations. Each is gated on
// the native API being absent so a runtime that already ships it wins. They are
// installed synchronously (no package resolution), but exposed as async installers
// to share the dispatch shape with the package-backed ones.

/**
 * `reportError(error)` — surface an error to the host as if it were uncaught,
 * without throwing. A global on every browser and on Node 23+/24+; absent on the
 * supported Node floor (≤22.x), so shim across all supported Node. We emit an
 * `uncaughtException`-style report by writing to stderr, which is the closest
 * Node-side analogue of the WHATWG "report the exception" algorithm.
 */
const installReportError = (): void => {
    if (typeof (globalThis as Record<string, unknown>)["reportError"] === "function") {
        return;
    }

    (globalThis as Record<string, unknown>)["reportError"] = (error: unknown): void => {
        // Mirror the host "report an exception" semantics: never throw, just surface.
        // Prefer a stack when available; fall back to String().
        const rendered = error instanceof Error ? (error.stack ?? `${error.name}: ${error.message}`) : String(error);

        process.stderr.write(`${rendered}\n`);
    };
};

/**
 * `RegExp.escape(string)` — escape a string for literal use inside a RegExp.
 * Native on Node 24+; shim below that band. Follows the TC39 proposal: escape the
 * leading character if it is a decimal digit or ASCII letter (so the result can't
 * start an identifier-continue sequence), then escape every syntax/whitespace
 * character via `\xHH` / `\uHHHH`.
 */
const installRegExpEscape = (): void => {
    if (typeof (RegExp as unknown as Record<string, unknown>)["escape"] === "function") {
        return;
    }

    const SYNTAX_CHARACTERS = new Set(String.raw`^$\.*+?()[]{}|/`);
    const CONTROL_ESCAPES: Record<string, string> = {
        "\f": String.raw`\f`,
        "\n": String.raw`\n`,
        "\r": String.raw`\r`,
        "\t": String.raw`\t`,
        "\v": String.raw`\v`,
    };

    // \s covers ASCII + most Unicode whitespace; the explicit escapes close the
    // gaps the spec calls out (NBSP U+00A0, BOM/ZWNBSP U+FEFF, line/paragraph
    // separators U+2028/U+2029) without putting raw exotic chars in the source.
    const WHITESPACE_REGEX = /\s/u;

    const encode = (codePoint: number): string =>
        (codePoint <= 0xff ? String.raw`\x${codePoint.toString(16).padStart(2, "0")}` : String.raw`\u${codePoint.toString(16).padStart(4, "0")}`);

    const escape = (input: string): string => {
        if (typeof input !== "string") {
            throw new TypeError("RegExp.escape requires a string argument");
        }

        let result = "";
        let first = true;

        for (const character of input) {
            const codePoint = character.codePointAt(0) as number;

            if (first && /[\dA-Za-z]/u.test(character)) {
                // Escape a leading alphanumeric so the output can't be misread as a
                // back-reference or identifier when spliced into a larger pattern.
                result += encode(codePoint);
            } else if (SYNTAX_CHARACTERS.has(character)) {
                result += `\\${character}`;
            } else if (CONTROL_ESCAPES[character] !== undefined) {
                result += CONTROL_ESCAPES[character];
            } else if (WHITESPACE_REGEX.test(character)) {
                // Whitespace (incl. NBSP U+00A0, BOM U+FEFF, line/paragraph separators)
                // is hex-escaped so the pattern can't be reflowed when embedded.
                result += encode(codePoint);
            } else {
                result += character;
            }

            first = false;
        }

        return result;
    };

    (RegExp as unknown as Record<string, unknown>)["escape"] = escape;
};

/**
 * `Promise.try(fn, ...args)` — run `fn` and wrap its sync return, thrown error, or
 * returned thenable in a Promise. Native on Node 24+; shim below that band.
 */
const installPromiseTry = (): void => {
    if (typeof (Promise as unknown as Record<string, unknown>)["try"] === "function") {
        return;
    }

    (Promise as unknown as Record<string, unknown>)["try"] = function promiseTry<T>(
        this: unknown,
        callback: (...callbackArguments: unknown[]) => T,
        ...callbackArguments: unknown[]
    ): Promise<Awaited<T>> {
        // Spec calls `this` as the constructor; fall back to Promise when invoked
        // detached (e.g. destructured) so the shim works either way.
        const Constructor = (typeof this === "function" ? this : Promise) as PromiseConstructor;

        return new Constructor((resolve, reject) => {
            try {
                resolve(callback(...callbackArguments) as Awaited<T>);
            } catch (error) {
                // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Promise.try forwards the thrown value verbatim, which per spec may not be an Error.
                reject(error);
            }
        });
    };
};

/**
 * `Float16Array` — typed array of IEEE-754 half-precision floats, plus the
 * `Math.f16round` / `DataView` half-float companions where missing. Native on
 * Node 24+; shim below that band. We can only emulate the storage view (a Uint16
 * array with float16↔float64 conversion on element access) — close enough for the
 * common "read/write half floats" use, without pulling core-js.
 */
const installFloat16Array = (): void => {
    if (typeof (globalThis as Record<string, unknown>)["Float16Array"] === "function") {
        return;
    }

    // float16 round: convert a float64 to the nearest representable float16, then
    // back to float64 (round-trips through the 16-bit encoding).
    /* eslint-disable no-bitwise -- IEEE-754 half-precision encode/decode is inherently bit-level. */
    const toFloat16Bits = (value: number): number => {
        const floatView = new Float32Array(1);
        const intView = new Uint32Array(floatView.buffer);

        floatView[0] = value;

        const bits = intView[0] as number;
        const sign = (bits >>> 16) & 0x80_00;
        const exponent = ((bits >>> 23) & 0xff) - 127 + 15;
        const mantissa = bits & 0x7f_ff_ff;

        if (exponent <= 0) {
            if (exponent < -10) {
                return sign;
            }

            const subnormal = (mantissa | 0x80_00_00) >> (1 - exponent);

            return sign | (subnormal >> 13);
        }

        if (exponent >= 0x1f) {
            return sign | 0x7c_00 | (mantissa === 0 ? 0 : 0x2_00);
        }

        return sign | (exponent << 10) | (mantissa >> 13);
    };

    const fromFloat16Bits = (bits: number): number => {
        const sign = bits & 0x80_00 ? -1 : 1;
        const exponent = (bits >> 10) & 0x1f;
        const mantissa = bits & 0x3_ff;

        if (exponent === 0) {
            return sign * mantissa * 2 ** -24;
        }

        if (exponent === 0x1f) {
            return mantissa ? Number.NaN : sign * Number.POSITIVE_INFINITY;
        }

        return sign * (1 + mantissa / 1024) * 2 ** (exponent - 15);
    };
    /* eslint-enable no-bitwise */

    const f16round = (value: number): number => fromFloat16Bits(toFloat16Bits(value));

    if (typeof (Math as unknown as Record<string, unknown>)["f16round"] !== "function") {
        (Math as unknown as Record<string, unknown>)["f16round"] = f16round;
    }

    // A TypedArray-shaped view whose constructor returns a Proxy over a backing
    // Uint16Array — the class form is the cleanest way to expose `Symbol.species`.
    // eslint-disable-next-line @typescript-eslint/no-extraneous-class -- the constructor returns a Proxy (the public surface); members live on that.
    class Float16ArrayShim {
        static get [Symbol.species](): typeof Float16ArrayShim {
            return Float16ArrayShim;
        }

        constructor(...arguments_: unknown[]) {
            const storage = new Uint16Array(...(arguments_ as [number]));

            // Back the view with a Uint16Array but trap element access so reads/writes
            // go through the half-float codecs. A Proxy keeps `length`, iteration, and
            // index access working without re-implementing the whole TypedArray surface.
            // eslint-disable-next-line no-constructor-return -- intentional: the Proxy IS the constructed view.
            return new Proxy(storage, {
                get(target, property, receiver): unknown {
                    if (typeof property === "string" && /^\d+$/u.test(property)) {
                        return fromFloat16Bits(target[Number(property)] as number);
                    }

                    return Reflect.get(target, property, receiver);
                },
                set(target, property, value, receiver): boolean {
                    if (typeof property === "string" && /^\d+$/u.test(property)) {
                        target[Number(property)] = toFloat16Bits(Number(value));

                        return true;
                    }

                    return Reflect.set(target, property, value, receiver);
                },
            });
        }
    }

    (globalThis as Record<string, unknown>)["Float16Array"] = Float16ArrayShim;
};

/**
 * `Error.isError(value)` — branded check for genuine Error instances (robust across
 * realms, unlike `instanceof`). Native on Node 24+; shim below that band. We can't
 * read the internal `[[ErrorData]]` slot from JS, so we approximate via the brand
 * that `Object.prototype.toString` exposes for error objects.
 */
const installErrorIsError = (): void => {
    if (typeof (Error as unknown as Record<string, unknown>)["isError"] === "function") {
        return;
    }

    (Error as unknown as Record<string, unknown>)["isError"] = (value: unknown): boolean =>
        typeof value === "object" && value !== null && Object.prototype.toString.call(value) === "[object Error]";
};

/**
 * `navigator.locks` — Web Locks API. Native on Node 24.5+; shim below that band.
 * A single-process in-memory lock manager is sufficient for the `vis x` script
 * scope (one process). We never overwrite a native `navigator.locks`.
 */
const installNavigatorLocks = (): void => {
    const globalScope = globalThis as Record<string, unknown>;
    // eslint-disable-next-line n/no-unsupported-features/node-builtins -- read-only, guarded feature-detection of an experimental global; we only add a shim when it is absent.
    const navigatorValue = globalScope["navigator"] as { locks?: unknown } | undefined;

    if (navigatorValue?.locks !== undefined) {
        return;
    }

    // In-process lock queues keyed by name. Each request waits for the tail of its
    // queue to settle, then runs the callback while holding the lock.
    const queues = new Map<string, Promise<unknown>>();

    const request = async (name: string, optionsOrCallback: unknown, maybeCallback?: unknown): Promise<unknown> => {
        const callback = (typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback) as (lock: { mode: string; name: string }) => unknown;

        const previous = queues.get(name) ?? Promise.resolve();

        let release!: () => void;
        const held = new Promise<void>((resolve) => {
            release = resolve;
        });

        // The next waiter chains off `held`, so it can't start until we release.
        queues.set(
            name,
            previous.then(() => held),
        );

        await previous.catch(() => undefined);

        try {
            return await callback({ mode: "exclusive", name });
        } finally {
            release();
        }
    };

    const locks = { request };

    if (navigatorValue === undefined) {
        // No `navigator` at all (older Node) — define a minimal one carrying `locks`.
        // `navigator` may be a getter-only accessor on globalThis, so use
        // defineProperty rather than assignment (which would throw in strict mode).
        Object.defineProperty(globalScope, "navigator", { configurable: true, enumerable: true, value: { locks }, writable: true });
    } else {
        Object.defineProperty(navigatorValue, "locks", { configurable: true, enumerable: true, value: locks });
    }
};

const INLINE_INSTALLERS: Record<string, () => void> = {
    "error-iserror": installErrorIsError,
    float16array: installFloat16Array,
    "navigator-locks": installNavigatorLocks,
    "promise-try": installPromiseTry,
    "regexp-escape": installRegExpEscape,
    reporterror: installReportError,
};

/**
 * Install the requested polyfills. `spec` is the VIS_POLYFILL value; package-backed
 * shims are resolved from `cwd`. Each is feature-detected; a missing package
 * degrades to a warning.
 */
export const installPolyfills = async (spec: string, cwd: string = process.cwd()): Promise<void> => {
    const requested = parseSpec(spec);

    await Promise.all(
        requested.map(async (name) => {
            if (name === "temporal") {
                await installTemporal(cwd);
            } else if (name === "urlpattern") {
                await installUrlPattern(cwd);
            } else {
                INLINE_INSTALLERS[name]?.();
            }
        }),
    );
};
