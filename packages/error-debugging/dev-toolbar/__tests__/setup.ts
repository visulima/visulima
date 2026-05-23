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
    readonly #map = new Map<string, string>();

    public get length(): number {
        return this.#map.size;
    }

    public clear(): void {
        this.#map.clear();
    }

    public getItem(key: string): string | null {
        return this.#map.get(key) ?? null;
    }

    public key(index: number): string | null {
        return [...this.#map.keys()][index] ?? null;
    }

    public removeItem(key: string): void {
        this.#map.delete(key);
    }

    public setItem(key: string, value: string): void {
        this.#map.set(key, value);
    }

    [name: string]: unknown;
}

const STORAGE_KEYS = ["localStorage", "sessionStorage"] as const;
const STORAGE_METHODS = ["clear", "getItem", "key", "removeItem", "setItem"] as const;

const tryDefineGlobal = (key: string, replacement: Storage): boolean => {
    try {
        Object.defineProperty(globalThis, key, {
            configurable: true,
            enumerable: true,
            value: replacement,
            writable: true,
        });

        return true;
    } catch {
        return false;
    }
};

const patchMissingMethods = (current: Storage, replacement: Storage): void => {
    for (const method of STORAGE_METHODS) {
        if (typeof (current as unknown as Record<string, unknown>)[method] === "function") {
            continue;
        }

        const bound = (replacement[method] as (...arguments_: unknown[]) => unknown).bind(replacement);

        try {
            Object.defineProperty(current, method, {
                configurable: true,
                value: bound,
                writable: true,
            });
        } catch {
            try {
                (current as unknown as Record<string, unknown>)[method] = bound;
            } catch {
                // native is fully locked; nothing more we can do
            }
        }
    }
};

const mirrorOntoWindow = (jsdomWindow: Window & typeof globalThis, key: string, replacement: Storage): void => {
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
};

const pickReplacement = (existing: Storage | undefined): Storage => {
    if (existing !== undefined && typeof existing.clear === "function") {
        return existing;
    }

    return new MapStorage();
};

const installStoragePolyfill = (): void => {
    const jsdomWindow = (globalThis as { window?: Window & typeof globalThis }).window;

    if (jsdomWindow === undefined) {
        return;
    }

    for (const key of STORAGE_KEYS) {
        const replacement = pickReplacement(jsdomWindow[key]);

        if (!tryDefineGlobal(key, replacement)) {
            const current = (globalThis as unknown as Record<string, Storage | undefined>)[key];

            if (current !== undefined && current !== replacement) {
                patchMissingMethods(current, replacement);
            }
        }

        mirrorOntoWindow(jsdomWindow, key, replacement);
    }
};

installStoragePolyfill();

beforeEach(() => {
    installStoragePolyfill();
});
