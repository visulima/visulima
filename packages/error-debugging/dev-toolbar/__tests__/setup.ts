import * as matchers from "@testing-library/jest-dom/matchers";
import { expect } from "vitest";

expect.extend(matchers);

// Node 25 ships a built-in `localStorage`/`sessionStorage` global (gated on
// `--experimental-webstorage`/`--localstorage-file`) that shadows jsdom's
// per-window Storage. The native object may be a partial implementation
// missing methods like `clear`, and CI prints
//   `--localstorage-file was provided without a valid path`
// before any of these tests run. Force jsdom's Storage onto globalThis so
// bare `localStorage.*` calls in test files work on Node 22/24/25.
//
// We can't always replace the descriptor — Node may install localStorage as a
// non-configurable accessor — so as a last resort we monkey-patch the missing
// Storage methods onto whatever the native global already exposes.
// eslint-disable-next-line sonarjs/different-types-comparison -- `globalThis.window` is undefined outside jsdom.
if (globalThis.window !== undefined) {
    const jsdomWindow = globalThis.window;

    for (const key of ["localStorage", "sessionStorage"] as const) {
        const jsdomStorage = jsdomWindow[key];

        // Strategy 1: replace the descriptor outright. Works when the native
        // global is configurable (most current Node 25 builds) or unset.
        try {
            Object.defineProperty(globalThis, key, {
                configurable: true,
                get: () => jsdomStorage,
            });
        } catch {
            // Strategy 2: plain assignment for writable data descriptors.
            try {
                (globalThis as unknown as Record<string, Storage>)[key] = jsdomStorage;
            } catch {
                // ignore — fall through to monkey-patch below.
            }
        }

        // Strategy 3: if globalThis[key] still isn't jsdom's Storage (e.g. Node
        // pinned a non-configurable, non-writable accessor), patch the native
        // object so the public Storage surface delegates to jsdom.
        const current = (globalThis as unknown as Record<string, Storage | undefined>)[key];

        if (current !== undefined && current !== jsdomStorage) {
            for (const method of ["clear", "getItem", "key", "removeItem", "setItem"] as const) {
                if (typeof (current as unknown as Record<string, unknown>)[method] !== "function") {
                    try {
                        (current as unknown as Record<string, unknown>)[method] = (jsdomStorage[method] as (...arguments_: unknown[]) => unknown).bind(jsdomStorage);
                    } catch {
                        // ignore — at this point the native is fully locked down.
                    }
                }
            }
        }
    }
}
