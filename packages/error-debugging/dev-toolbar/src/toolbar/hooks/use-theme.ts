import { useEffect, useState } from "preact/hooks";

export type Theme = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "__VISULIMA_DEVTOOLS_THEME__";

/**
 * Get the system color scheme preference
 */
const getSystemTheme = (): "light" | "dark" => {
    if (globalThis.window === undefined) {
        return "light";
    }

    return globalThis.window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

/**
 * Load theme preference from localStorage
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
 * Save theme preference to localStorage
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

export interface UseThemeReturn {
    resolvedTheme: "light" | "dark";
    setTheme: (newTheme: Theme) => void;
    theme: Theme;
    toggleTheme: () => void;
}

/**
 * Hook for managing theme (light/dark mode)
 */
export const useTheme = (): UseThemeReturn => {
    const [theme, setThemeState] = useState<Theme>(loadTheme);
    const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => {
        const initial = loadTheme();
        return initial === "system" ? getSystemTheme() : initial;
    });

    // Update resolved theme when theme changes or system preference changes
    useEffect(() => {
        const updateResolvedTheme = (): void => {
            const resolved = theme === "system" ? getSystemTheme() : theme;
            setResolvedTheme(resolved);
        };

        updateResolvedTheme();

        // Listen for system theme changes
        if (globalThis.window !== undefined) {
            const mediaQuery = globalThis.window.matchMedia("(prefers-color-scheme: dark)");
            const handleChange = (): void => {
                if (theme === "system") {
                    updateResolvedTheme();
                }
            };

            // Modern browsers
            if (mediaQuery.addEventListener) {
                mediaQuery.addEventListener("change", handleChange);
                return () => {
                    mediaQuery.removeEventListener("change", handleChange);
                };
            }
            // Safari < 14
            if (mediaQuery.addListener) {
                mediaQuery.addListener(handleChange);
                return () => {
                    mediaQuery.removeListener(handleChange);
                };
            }
        }

        return undefined;
    }, [theme]);

    const setTheme = (newTheme: Theme): void => {
        setThemeState(newTheme);
        saveTheme(newTheme);
    };

    const toggleTheme = (): void => {
        // Toggle between light and dark (system stays as system)
        if (theme === "system") {
            setTheme(resolvedTheme === "dark" ? "light" : "dark");
        } else {
            setTheme(resolvedTheme === "dark" ? "light" : "dark");
        }
    };

    return {
        resolvedTheme,
        setTheme,
        theme,
        toggleTheme,
    };
};
