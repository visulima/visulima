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
 *   this file (`reportError`, `RegExp.escape`, `Promise.try`, the `Float16`
 *   companions `Math.f16round` + `DataView` get/setFloat16, `Error.isError`,
 *   `navigator.locks`). No core-js, no package resolution.
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

// IEEE-754 binary16 codec, round-to-nearest-even, shared by Math.f16round and the
// DataView half-float companions.
/* eslint-disable no-bitwise -- IEEE-754 half-precision encode/decode is inherently bit-level. */
const toFloat16Bits = (value: number): number => {
    const floatView = new Float32Array(1);
    const intView = new Uint32Array(floatView.buffer);

    floatView[0] = value;

    const bits = intView[0] as number;
    const sign = (bits >>> 16) & 0x80_00;
    const exponentBits = (bits >>> 23) & 0xff;
    const mantissa = bits & 0x7f_ff_ff;

    // Input Inf / NaN: preserve a quiet NaN, else Infinity.
    if (exponentBits === 0xff) {
        return mantissa === 0 ? sign | 0x7c_00 : sign | 0x7e_00;
    }

    // Re-bias the float32 exponent for half precision.
    const exponent = exponentBits - 127 + 15;

    // Finite overflow rounds to Infinity (NOT NaN).
    if (exponent >= 0x1f) {
        return sign | 0x7c_00;
    }

    if (exponent <= 0) {
        // Too small even for a subnormal → signed zero.
        if (exponent < -10) {
            return sign;
        }

        // Subnormal: restore the implicit leading 1 then shift into the 10-bit
        // field, rounding to nearest, ties to even.
        const full = mantissa | 0x80_00_00;
        const shift = 14 - exponent;
        let result = full >> shift;
        const remainder = full & ((1 << shift) - 1);
        const halfway = 1 << (shift - 1);

        if (remainder > halfway || (remainder === halfway && (result & 1) === 1)) {
            result += 1;
        }

        return sign | result;
    }

    // Normal: round the 23-bit mantissa down to 10 bits, ties to even. A rounding
    // carry can ripple into the exponent (and overflow to Infinity) — which is
    // the correct result.
    let result = (exponent << 10) | (mantissa >> 13);
    const remainder = mantissa & 0x1f_ff;

    if (remainder > 0x10_00 || (remainder === 0x10_00 && (result & 1) === 1)) {
        result += 1;
    }

    return sign | result;
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

/**
 * Half-float (`Float16`) companions — `Math.f16round` and `DataView`'s
 * `getFloat16` / `setFloat16`. Native on Node 24+; shimmed below that band.
 *
 * We intentionally do NOT shim the `Float16Array` *typed array* global: a faithful
 * TypedArray (decoded iteration, `.set`/`.subarray`/`.map`, `Array.from`) can't be
 * emulated without re-implementing the whole TypedArray surface, and a partial
 * facade silently returns raw uint16 bits for those operations. Code that needs a
 * real `Float16Array` should run on Node 24+. The round + DataView codecs below
 * are exact, so they're safe to ship.
 */
const installFloat16 = (): void => {
    const math = Math as unknown as Record<string, unknown>;

    if (typeof math["f16round"] !== "function") {
        math["f16round"] = (value: number): number => fromFloat16Bits(toFloat16Bits(value));
    }

    const dataView = DataView.prototype as unknown as Record<string, unknown>;

    if (typeof dataView["getFloat16"] !== "function") {
        dataView["getFloat16"] = function getFloat16(this: DataView, byteOffset: number, littleEndian?: boolean): number {
            return fromFloat16Bits(this.getUint16(byteOffset, littleEndian));
        };
    }

    if (typeof dataView["setFloat16"] !== "function") {
        dataView["setFloat16"] = function setFloat16(this: DataView, byteOffset: number, value: number, littleEndian?: boolean): void {
            this.setUint16(byteOffset, toFloat16Bits(value), littleEndian);
        };
    }
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
    // queue to settle, then runs the callback while holding the lock. `heldNames`
    // backs `ifAvailable` (is the lock currently granted?).
    //
    // Scope limits (single-process parity shim): `mode: "shared"` is serialized as
    // exclusive (no concurrent readers), `steal` is unsupported, and `query()` is
    // not implemented. `ifAvailable` and `signal` ARE honored so the common
    // non-blocking / cancellable patterns don't silently misbehave.
    const queues = new Map<string, Promise<unknown>>();
    const heldNames = new Set<string>();

    const abortError = (signal: AbortSignal): unknown =>
        signal.reason
        ?? (typeof DOMException === "function"
            ? new DOMException("The lock request is aborted", "AbortError")
            : Object.assign(new Error("The lock request is aborted"), { name: "AbortError" }));

    const request = async (name: string, optionsOrCallback: unknown, maybeCallback?: unknown): Promise<unknown> => {
        const hasOptions = typeof optionsOrCallback !== "function";
        const options = (hasOptions ? (optionsOrCallback as { ifAvailable?: boolean; mode?: string; signal?: AbortSignal }) : {}) ?? {};
        const callback = (hasOptions ? maybeCallback : optionsOrCallback) as (lock: { mode: string; name: string } | null) => unknown;
        const mode = options.mode === "shared" ? "shared" : "exclusive";

        if (options.signal?.aborted) {
            throw abortError(options.signal);
        }

        // Non-blocking: if the lock is already held, grant `null` immediately
        // instead of queueing (per the Web Locks `ifAvailable` contract).
        if (options.ifAvailable === true && heldNames.has(name)) {
            return callback(null);
        }

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

        // Aborted while waiting in the queue: release our slot so the chain
        // continues, then reject.
        if (options.signal?.aborted) {
            release();

            throw abortError(options.signal);
        }

        heldNames.add(name);

        try {
            return await callback({ mode, name });
        } finally {
            heldNames.delete(name);
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
    float16array: installFloat16,
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
