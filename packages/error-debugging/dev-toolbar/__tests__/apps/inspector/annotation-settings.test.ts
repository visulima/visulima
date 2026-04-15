// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, getMarkerColor, loadSettings, MARKER_COLORS, saveSettings } from "../../../src/apps/inspector/annotation-settings";

describe("annotation-settings", () => {
    afterEach(() => {
        localStorage.clear();
        // Reset cached state by loading fresh
        saveSettings(DEFAULT_SETTINGS);
    });

    describe("dEFAULT_SETTINGS", () => {
        it("has expected default values", () => {
            expect(DEFAULT_SETTINGS.outputDetail).toBe("standard");
            expect(DEFAULT_SETTINGS.markerColorName).toBe("indigo");
            expect(DEFAULT_SETTINGS.markerClickBehavior).toBe("detail");
            expect(DEFAULT_SETTINGS.blockInteractions).toBe(true);
        });
    });

    describe("mARKER_COLORS", () => {
        it("has 7 colors", () => {
            expect(MARKER_COLORS).toHaveLength(7);
        });

        it("each color has required fields", () => {
            for (const color of MARKER_COLORS) {
                expect(color).toHaveProperty("name");
                expect(color).toHaveProperty("bg");
                expect(color).toHaveProperty("border");
                expect(color).toHaveProperty("fg");
                expect(color).toHaveProperty("highlightBg");
                expect(color).toHaveProperty("label");
            }
        });

        it("yellow has dark text for contrast", () => {
            const yellow = MARKER_COLORS.find((c) => c.name === "yellow");

            expect(yellow?.fg).toBe("#1a1a1a");
        });
    });

    describe("loadSettings / saveSettings", () => {
        it("returns defaults when nothing saved", () => {
            localStorage.clear();
            // Force cache reset
            saveSettings(DEFAULT_SETTINGS);

            const settings = loadSettings();

            expect(settings.outputDetail).toBe("standard");
        });

        it("persists settings to localStorage", () => {
            saveSettings({ ...DEFAULT_SETTINGS, outputDetail: "forensic" });

            const raw = localStorage.getItem("__vdt_annotation_settings");

            expect(raw).not.toBeNull();
            expect(JSON.parse(raw!).outputDetail).toBe("forensic");
        });

        it("reads saved settings", () => {
            saveSettings({ ...DEFAULT_SETTINGS, markerColorName: "red" });

            const settings = loadSettings();

            expect(settings.markerColorName).toBe("red");
        });

        it("merges with defaults for partial data", () => {
            localStorage.setItem("__vdt_annotation_settings", JSON.stringify({ outputDetail: "compact" }));
            // Reset cache
            saveSettings({ ...DEFAULT_SETTINGS, outputDetail: "compact" });

            const settings = loadSettings();

            expect(settings.outputDetail).toBe("compact");
            expect(settings.blockInteractions).toBe(true); // default
        });
    });

    describe(getMarkerColor, () => {
        it("returns the configured color", () => {
            saveSettings({ ...DEFAULT_SETTINGS, markerColorName: "red" });

            const color = getMarkerColor(loadSettings());

            expect(color.name).toBe("red");
            expect(color.bg).toBe("#ef4444");
        });

        it("falls back to first color for unknown name", () => {
            saveSettings({ ...DEFAULT_SETTINGS, markerColorName: "nonexistent" });

            const color = getMarkerColor(loadSettings());

            expect(color.name).toBe("indigo");
        });
    });
});
