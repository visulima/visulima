import type { ToolbarSettings } from "../types/toolbar";
import { DEFAULT_TOOLBAR_SETTINGS } from "../types/toolbar";

const SETTINGS_STORAGE_KEY = "__v_dt__settings";

/**
 * Loads settings from localStorage, merging with defaults.
 * @returns Toolbar settings.
 */
export const loadSettings = (): ToolbarSettings => {
    if (globalThis.window === undefined) {
        return { ...DEFAULT_TOOLBAR_SETTINGS };
    }

    try {
        const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);

        if (stored) {
            const parsed = JSON.parse(stored) as Partial<ToolbarSettings>;

            return {
                ...DEFAULT_TOOLBAR_SETTINGS,
                ...parsed,
            };
        }
    } catch (error) {
        console.warn("[dev-toolbar] Failed to load settings:", error);
    }

    return { ...DEFAULT_TOOLBAR_SETTINGS };
};

/**
 * Saves settings to localStorage.
 * @param settings Toolbar settings to save.
 */
export const saveSettings = (settings: ToolbarSettings): void => {
    if (globalThis.window === undefined) {
        return;
    }

    try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
        console.warn("[dev-toolbar] Failed to save settings:", error);
    }
};

/**
 * Merges partial updates into the current settings and persists them.
 * @param updates Partial settings to update.
 * @returns Updated settings.
 */
export const updateSettings = (updates: Partial<ToolbarSettings>): ToolbarSettings => {
    const current = loadSettings();
    const updated = { ...current, ...updates };

    saveSettings(updated);

    return updated;
};
