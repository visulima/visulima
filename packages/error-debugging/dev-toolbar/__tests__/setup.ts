import * as matchers from "@testing-library/jest-dom/matchers";
import { expect } from "vitest";

expect.extend(matchers);

// Node 25 exposes a native `localStorage` global. When `--localstorage-file`
// isn't configured the methods aren't usable, and bare `localStorage.*` in
// test files resolves to Node's broken global instead of jsdom's per-window
// implementation. Rebind both Web Storage globals to jsdom so the same tests
// work on Node 22/24/25.
if (globalThis.window !== undefined && globalThis.localStorage) {
    for (const key of ["localStorage", "sessionStorage"] as const) {
        try {
            // Plain assignment first — works when the global is writable.
            (globalThis as unknown as Record<string, unknown>)[key] = window[key];

            // If the previous assignment was silently dropped (frozen / accessor),
            // re-bind via defineProperty as a getter so reads always go through jsdom.
            if ((globalThis as unknown as Record<string, unknown>)[key] !== window[key]) {
                Object.defineProperty(globalThis, key, {
                    configurable: true,
                    get: () => window[key],
                });
            }
        } catch {
            // Non-configurable / non-writable globals — nothing we can do here.
        }
    }
}
