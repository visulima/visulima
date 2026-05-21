import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "vis-dashboard-theme";

const readStored = (): Theme | undefined => {
    try {
        const value = localStorage.getItem(STORAGE_KEY);

        return value === "light" || value === "dark" ? value : undefined;
    } catch {
        return undefined;
    }
};

const systemTheme = (): Theme =>
    (globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

export const useTheme = () => {
    const [theme, setTheme] = useState<Theme>(() => readStored() ?? systemTheme());

    useEffect(() => {
        document.documentElement.dataset.theme = theme;

        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch {}
    }, [theme]);

    const toggle = useCallback(() => {
        setTheme((current) => (current === "dark" ? "light" : "dark"));
    }, []);

    return { theme, toggle };
};
