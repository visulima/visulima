import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadSettings, saveSettings, updateSettings } from "../../src/toolbar/settings";
import type { ToolbarSettings } from "../../src/types/toolbar";
import { DEFAULT_TOOLBAR_SETTINGS } from "../../src/types/toolbar";

const SETTINGS_KEY = "__v_dt__settings";

/**
 * Minimal localStorage stub compatible with the settings module.
 */
const makeLocalStorageMock = () => {
    const store: Record<string, string> = {};

    return {
        clear: vi.fn(() => {
            for (const key of Object.keys(store)) {
                delete store[key];
            }
        }),
        getItem: vi.fn((key: string): string | null => store[key] ?? null),
        removeItem: vi.fn((key: string) => {
            delete store[key];
        }),
        setItem: vi.fn((key: string, value: string) => {
            store[key] = value;
        }),
    };
};

describe("settings (browser environment)", () => {
    let storageMock: ReturnType<typeof makeLocalStorageMock>;

    beforeEach(() => {
        storageMock = makeLocalStorageMock();
        // Make globalThis.window defined so the guards inside settings.ts are satisfied
        vi.stubGlobal("window", {});
        vi.stubGlobal("localStorage", storageMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe(loadSettings, () => {
        it("returns default settings when localStorage is empty", () => {
            expect.hasAssertions();

            expect(loadSettings()).toStrictEqual(DEFAULT_TOOLBAR_SETTINGS);
        });

        it("merges stored partial settings with defaults", () => {
            expect.hasAssertions();

            const partial: Partial<ToolbarSettings> = { placement: "top-right" };

            storageMock.setItem(SETTINGS_KEY, JSON.stringify(partial));

            const loaded = loadSettings();

            expect(loaded.placement).toBe("top-right");
            expect(loaded.defaultVisible).toBe(DEFAULT_TOOLBAR_SETTINGS.defaultVisible);
            expect(loaded.showNotifications).toBe(DEFAULT_TOOLBAR_SETTINGS.showNotifications);
        });

        it("returns default settings when stored JSON is malformed", () => {
            expect.hasAssertions();

            storageMock.setItem(SETTINGS_KEY, "not-valid-json{");

            const loaded = loadSettings();

            expect(loaded).toStrictEqual(DEFAULT_TOOLBAR_SETTINGS);
        });

        it("does not mutate DEFAULT_TOOLBAR_SETTINGS", () => {
            expect.hasAssertions();

            const before = { ...DEFAULT_TOOLBAR_SETTINGS };
            const loaded = loadSettings();

            // Mutate returned value
            (loaded as any).placement = "top-left";

            expect(DEFAULT_TOOLBAR_SETTINGS.placement).toBe(before.placement);
        });

        it("reads from localStorage using the correct key", () => {
            expect.hasAssertions();

            loadSettings();

            expect(storageMock.getItem).toHaveBeenCalledWith(SETTINGS_KEY);
        });
    });

    describe(saveSettings, () => {
        it("stores settings as JSON in localStorage", () => {
            expect.hasAssertions();

            const settings: ToolbarSettings = {
                defaultVisible: false,
                placement: "top-left",
                showNotifications: false,
            };

            saveSettings(settings);

            expect(storageMock.setItem).toHaveBeenCalledWith(SETTINGS_KEY, JSON.stringify(settings));
        });

        it("persisted value can be reloaded correctly", () => {
            expect.hasAssertions();

            const settings: ToolbarSettings = {
                defaultVisible: false,
                placement: "top-left",
                showNotifications: false,
            };

            saveSettings(settings);

            const loaded = loadSettings();

            expect(loaded).toStrictEqual(settings);
        });

        it("overwrites previously stored settings", () => {
            expect.hasAssertions();

            saveSettings({ ...DEFAULT_TOOLBAR_SETTINGS, placement: "top-right" });
            saveSettings({ ...DEFAULT_TOOLBAR_SETTINGS, placement: "bottom-left" });

            const loaded = loadSettings();

            expect(loaded.placement).toBe("bottom-left");
        });
    });

    describe(updateSettings, () => {
        it("merges partial updates with existing settings", () => {
            expect.hasAssertions();

            const updated = updateSettings({ placement: "top-center" });

            expect(updated.placement).toBe("top-center");
            expect(updated.defaultVisible).toBe(DEFAULT_TOOLBAR_SETTINGS.defaultVisible);
        });

        it("saves the merged settings to localStorage", () => {
            expect.hasAssertions();

            updateSettings({ placement: "top-center" });

            expect(storageMock.setItem).toHaveBeenCalledWith(SETTINGS_KEY, expect.any(String));
        });

        it("returns the complete updated settings object", () => {
            expect.hasAssertions();

            const result = updateSettings({ defaultVisible: false });

            expect(result).toStrictEqual({
                ...DEFAULT_TOOLBAR_SETTINGS,
                defaultVisible: false,
            });
        });

        it("accumulates multiple updates correctly", () => {
            expect.hasAssertions();

            updateSettings({ placement: "top-right" });
            const final = updateSettings({ showNotifications: false });

            expect(final.placement).toBe("top-right");
            expect(final.showNotifications).toBe(false);
        });
    });
});

describe("settings (no browser / SSR environment)", () => {
    beforeEach(() => {
        // Ensure window is undefined (Node.js / SSR)
        vi.stubGlobal("window", undefined);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("loadSettings returns defaults without touching localStorage", () => {
        expect.hasAssertions();

        expect(loadSettings()).toStrictEqual(DEFAULT_TOOLBAR_SETTINGS);
    });

    it("saveSettings is a no-op and does not throw", () => {
        expect.hasAssertions();

        expect(() => {
            saveSettings(DEFAULT_TOOLBAR_SETTINGS);
        }).not.toThrow();
    });

    it("updateSettings returns defaults without persisting", () => {
        expect.hasAssertions();

        const result = updateSettings({ placement: "top-left" });

        // In SSR there is no previous state so it merges with defaults
        expect(result).toStrictEqual({
            ...DEFAULT_TOOLBAR_SETTINGS,
            placement: "top-left",
        });
    });
});
