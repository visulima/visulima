// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

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

describe("theme-palette", () => {
    afterEach(() => {
        localStorage.clear();
        resetPaletteCache();
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
