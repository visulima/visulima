import * as matchers from "@testing-library/jest-dom/matchers";
import { beforeEach, expect } from "vitest";

expect.extend(matchers);

// Node 25 ships a partial `localStorage`/`sessionStorage` (gated on
// `--experimental-webstorage`/`--localstorage-file`) that shadows jsdom's
// per-window Storage. The native stub is missing methods like `clear`/`key`
// and may be non-configurable on globalThis, so even Object.defineProperty
// can't replace it. We install a Map-backed Storage polyfill on `window`
// AND mirror it onto `globalThis` so bare `localStorage.*` calls work.

class MapStorage implements Storage {
    // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
    readonly #map = new Map<string, string>();

    get length(): number {
        return this.#map.size;
    }

    clear(): void {
        this.#map.clear();
    }

    getItem(key: string): string | null {
        return this.#map.get(key) ?? null;
    }

    key(index: number): string | null {
        return [...this.#map.keys()][index] ?? null;
    }

    removeItem(key: string): void {
        this.#map.delete(key);
    }

    setItem(key: string, value: string): void {
        this.#map.set(key, String(value));
    }

    [name: string]: unknown;
}

const STORAGE_KEYS = ["localStorage", "sessionStorage"] as const;

const installStoragePolyfill = (): void => {
    // eslint-disable-next-line sonarjs/different-types-comparison -- `globalThis.window` is undefined outside jsdom.
    if (typeof globalThis.window === "undefined") {
        return;
    }

    const jsdomWindow = globalThis.window;

    for (const key of STORAGE_KEYS) {
        // Prefer jsdom's Storage; fall back to MapStorage if jsdom didn't install one.
        const jsdomStorage = jsdomWindow[key];
        // eslint-disable-next-line sonarjs/different-types-comparison
        const replacement: Storage = jsdomStorage !== undefined && typeof jsdomStorage.clear === "function"
            ? jsdomStorage
            : new MapStorage();

        // Strategy 1: replace globalThis descriptor outright (works when configurable).
        let installed = false;

        try {
            Object.defineProperty(globalThis, key, {
                configurable: true,
                enumerable: true,
                value: replacement,
                writable: true,
            });
            installed = true;
        } catch {
            // ignore — fall through to per-method patch
        }

        // Strategy 2: native global is non-configurable; patch missing methods.
        if (!installed) {
            const current = (globalThis as unknown as Record<string, Storage | undefined>)[key];

            if (current !== undefined && current !== replacement) {
                for (const method of ["clear", "getItem", "key", "removeItem", "setItem"] as const) {
                    if (typeof (current as unknown as Record<string, unknown>)[method] === "function") {
                        continue;
                    }

                    try {
                        Object.defineProperty(current, method, {
                            configurable: true,
                            value: (replacement[method] as (...arguments_: unknown[]) => unknown).bind(replacement),
                            writable: true,
                        });
                    } catch {
                        // last resort: plain assignment
                        try {
                            (current as unknown as Record<string, unknown>)[method] = (replacement[method] as (...arguments_: unknown[]) => unknown).bind(replacement);
                        } catch {
                            // native is fully locked; nothing more we can do
                        }
                    }
                }
            }
        }

        // Mirror onto window so `window.localStorage` and bare `localStorage` agree.
        try {
            Object.defineProperty(jsdomWindow, key, {
                configurable: true,
                enumerable: true,
                value: replacement,
                writable: true,
            });
        } catch {
            // ignore
        }
    }
};

installStoragePolyfill();

// Re-install before each test in case vitest's module isolation resets globals.
beforeEach(() => {
    installStoragePolyfill();
});
