// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
    ANNOTATION_DARK,
    ANNOTATION_LIGHT,
    getAnnotationPalette,
    getInspectorPalette,
    INSPECTOR_DARK,
    INSPECTOR_LIGHT,
    isDarkTheme,
    resetPaletteCache,
} from "../../../src/apps/inspector/theme-palette";

// jsdom does not implement matchMedia, so install a stub that returns the given
// matches value. Returns a restore function to delete it afterwards.
const stubMatchMedia = (matches: boolean): () => void => {
    const original = Object.getOwnPropertyDescriptor(globalThis.window, "matchMedia");

    Object.defineProperty(globalThis.window, "matchMedia", {
        configurable: true,
        value: () => ({ matches }) as MediaQueryList,
        writable: true,
    });

    return () => {
        if (original) {
            Object.defineProperty(globalThis.window, "matchMedia", original);
        } else {
            delete (globalThis.window as unknown as Record<string, unknown>).matchMedia;
        }
    };
};

describe("theme-palette", () => {
    afterEach(() => {
        localStorage.clear();
        resetPaletteCache();
        vi.restoreAllMocks();
    });

    describe("palettes", () => {
        it("dark and light palettes have same keys", () => {
            expect.assertions(1);

            const darkKeys = Object.keys(INSPECTOR_DARK).sort();
            const lightKeys = Object.keys(INSPECTOR_LIGHT).sort();

            expect(darkKeys).toEqual(lightKeys);
        });

        it("annotation palettes have danger and success", () => {
            expect.assertions(4);

            expect(ANNOTATION_DARK).toHaveProperty("danger");
            expect(ANNOTATION_DARK).toHaveProperty("success");
            expect(ANNOTATION_LIGHT).toHaveProperty("danger");
            expect(ANNOTATION_LIGHT).toHaveProperty("success");
        });

        it("inspector palettes have overlay properties", () => {
            expect.assertions(2);

            expect(INSPECTOR_DARK).toHaveProperty("overlayBg");
            expect(INSPECTOR_DARK).toHaveProperty("overlayBorder");
        });
    });

    describe(isDarkTheme, () => {
        it("returns dark for 'dark' localStorage value", () => {
            expect.assertions(1);

            localStorage.setItem("__v_dt__theme", "dark");
            resetPaletteCache();

            expect(isDarkTheme()).toBe(true);
        });

        it("returns light for 'light' localStorage value", () => {
            expect.assertions(1);

            localStorage.setItem("__v_dt__theme", "light");
            resetPaletteCache();

            expect(isDarkTheme()).toBe(false);
        });

        it("reuses the cached value without re-reading localStorage", () => {
            expect.assertions(2);

            localStorage.setItem("__v_dt__theme", "dark");
            resetPaletteCache();

            expect(isDarkTheme()).toBe(true);

            // Change the stored value WITHOUT resetting the cache; the cached value wins.
            localStorage.setItem("__v_dt__theme", "light");

            expect(isDarkTheme()).toBe(true);
        });

        it("falls back to matchMedia when no theme is stored (dark preference)", () => {
            expect.assertions(1);

            const restore = stubMatchMedia(true);

            resetPaletteCache();

            expect(isDarkTheme()).toBe(true);

            restore();
        });

        it("falls back to matchMedia when no theme is stored (light preference)", () => {
            expect.assertions(1);

            const restore = stubMatchMedia(false);

            resetPaletteCache();

            expect(isDarkTheme()).toBe(false);

            restore();
        });

        it("survives a localStorage access error and falls back to matchMedia", () => {
            expect.assertions(1);

            const getItemSpy = vi.spyOn(globalThis.localStorage, "getItem").mockImplementation(() => {
                throw new Error("blocked");
            });
            const restore = stubMatchMedia(true);

            resetPaletteCache();

            expect(isDarkTheme()).toBe(true);

            getItemSpy.mockRestore();
            restore();
        });
    });

    describe("storage event listener", () => {
        it("invalidates the cache when the theme key changes in another tab", () => {
            expect.assertions(2);

            localStorage.setItem("__v_dt__theme", "dark");
            resetPaletteCache();

            expect(isDarkTheme()).toBe(true);

            // Simulate a cross-tab storage change for the theme key — the registered
            // listener clears the cache so the next read re-resolves from localStorage.
            localStorage.setItem("__v_dt__theme", "light");
            globalThis.dispatchEvent(new StorageEvent("storage", { key: "__v_dt__theme" }));

            expect(isDarkTheme()).toBe(false);
        });

        it("ignores storage changes for unrelated keys", () => {
            expect.assertions(1);

            localStorage.setItem("__v_dt__theme", "dark");
            resetPaletteCache();
            // Prime the cache.
            isDarkTheme();

            localStorage.setItem("__v_dt__theme", "light");
            // A different key must NOT invalidate the cache.
            globalThis.dispatchEvent(new StorageEvent("storage", { key: "something-else" }));

            expect(isDarkTheme()).toBe(true);
        });
    });

    describe(getInspectorPalette, () => {
        it("returns dark palette when theme is dark", () => {
            expect.assertions(1);

            localStorage.setItem("__v_dt__theme", "dark");
            resetPaletteCache();

            const palette = getInspectorPalette();

            expect(palette.bg).toBe(INSPECTOR_DARK.bg);
        });

        it("returns light palette when theme is light", () => {
            expect.assertions(1);

            localStorage.setItem("__v_dt__theme", "light");
            resetPaletteCache();

            const palette = getInspectorPalette();

            expect(palette.bg).toBe(INSPECTOR_LIGHT.bg);
        });
    });

    describe(getAnnotationPalette, () => {
        it("returns palette with base + annotation-specific fields", () => {
            // Set explicit theme to avoid matchMedia (not in JSDOM)
            expect.assertions(4);

            localStorage.setItem("__v_dt__theme", "dark");
            resetPaletteCache();

            const palette = getAnnotationPalette();

            expect(palette).toHaveProperty("bg");
            expect(palette).toHaveProperty("primary");
            expect(palette).toHaveProperty("danger");
            expect(palette).toHaveProperty("success");
        });
    });

    describe(resetPaletteCache, () => {
        it("forces re-read from localStorage on next call", () => {
            expect.assertions(2);

            localStorage.setItem("__v_dt__theme", "dark");
            resetPaletteCache();

            expect(isDarkTheme()).toBe(true);

            localStorage.setItem("__v_dt__theme", "light");
            resetPaletteCache();

            expect(isDarkTheme()).toBe(false);
        });
    });
});
