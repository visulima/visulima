import { useEffect, useState } from "preact/hooks";

type Theme = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "__v_dt__theme";

/**
 * Returns the current OS/browser color scheme preference.
 */
const getSystemTheme = (): "light" | "dark" => {
    if (globalThis.window === undefined) {
        return "light";
    }

    return globalThis.window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

/**
 * Loads the theme preference from localStorage.
 */
const loadTheme = (): Theme => {
    if (globalThis.window === undefined) {
        return "system";
    }

    try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);

        if (stored === "light" || stored === "dark" || stored === "system") {
            return stored;
        }
    } catch (error) {
        console.warn("[dev-toolbar] Failed to load theme:", error);
    }

    return "system";
};

/**
 * Saves the theme preference to localStorage.
 */
const saveTheme = (theme: Theme): void => {
    if (globalThis.window === undefined) {
        return;
    }

    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
        console.warn("[dev-toolbar] Failed to save theme:", error);
    }
};

interface UseThemeReturn {
    resolvedTheme: "light" | "dark";
    setTheme: (newTheme: Theme) => void;
    theme: Theme;
    toggleTheme: () => void;
}

// ---------------------------------------------------------------------------
// Module-level singleton — same pattern as useFrameState so all callers
// (ToolbarContainer, SettingsApp, etc.) share one theme value.
// ---------------------------------------------------------------------------

let sharedTheme: Theme = loadTheme();
let sharedResolvedTheme: "light" | "dark" = sharedTheme === "system" ? getSystemTheme() : sharedTheme;
const themeListeners = new Set<() => void>();

const notifyThemeListeners = (): void => {
    for (const listener of themeListeners) {
        listener();
    }
};

/**
 * Syncs the resolved theme to vite-overlay so both UIs stay in lock-step.
 * Writes to localStorage and applies/removes the `dark` class on the live
 * overlay root element if the overlay is currently mounted.
 */
const syncViteOverlayTheme = (resolved: "light" | "dark"): void => {
    try {
        localStorage.setItem("__v-o__theme", resolved);
    } catch {
        // localStorage unavailable — skip
    }

    const overlay = (globalThis as any).__v_o__current as { shadowRoot?: ShadowRoot } | undefined;
    const rootElement = overlay?.shadowRoot?.querySelector("#__v_o__root");

    if (rootElement) {
        rootElement.classList.toggle("dark", resolved === "dark");
    }
};

const setSharedTheme = (newTheme: Theme): void => {
    sharedTheme = newTheme;
    sharedResolvedTheme = newTheme === "system" ? getSystemTheme() : newTheme;
    saveTheme(newTheme);
    syncViteOverlayTheme(sharedResolvedTheme);
    notifyThemeListeners();
};

// Keep resolved theme in sync with system preference
if (globalThis.window !== undefined) {
    const mediaQuery = globalThis.window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = (): void => {
        if (sharedTheme === "system") {
            sharedResolvedTheme = getSystemTheme();
            syncViteOverlayTheme(sharedResolvedTheme);
            notifyThemeListeners();
        }
    };

    if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", handleSystemChange);
    } else if (mediaQuery.addListener) {
        // Safari < 14
        mediaQuery.addListener(handleSystemChange);
    }
}

/**
 * Manages the shared light/dark/system theme preference.
 * All callers share the same module-level state so theme changes propagate
 * to every component (ToolbarContainer, SettingsApp, etc.) immediately.
 */
const useTheme = (): UseThemeReturn => {
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        const listener = (): void => {
            forceUpdate((n) => n + 1);
        };

        themeListeners.add(listener);

        return () => {
            themeListeners.delete(listener);
        };
    }, []);

    const toggleTheme = (): void => {
        setSharedTheme(sharedResolvedTheme === "dark" ? "light" : "dark");
    };

    return {
        resolvedTheme: sharedResolvedTheme,
        setTheme: setSharedTheme,
        theme: sharedTheme,
        toggleTheme,
    };
};

export type { Theme, UseThemeReturn };
export { useTheme };
