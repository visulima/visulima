/**
 * Shared theme palette for inspector and annotation overlay.
 * Both run in document.body (outside Shadow DOM) so CSS variables
 * from the toolbar's :host are not available. We resolve the theme
 * from the same localStorage key used by use-theme.ts.
 */

export interface BasePalette {
    bg: string;
    btnBg: string;
    btnBgHover: string;
    btnBorder: string;
    btnBorderHover: string;
    fg: string;
    muted: string;
    primary: string;
    shadow: string;
}

export interface InspectorPalette extends BasePalette {
    overlayBg: string;
    overlayBorder: string;
}

export interface AnnotationPalette extends BasePalette {
    danger: string;
    success: string;
}

const BASE_DARK: BasePalette = {
    bg: "#212121",
    btnBg: "rgba(196,181,253,0.08)",
    btnBgHover: "rgba(196,181,253,0.16)",
    btnBorder: "rgba(196,181,253,0.25)",
    btnBorderHover: "rgba(196,181,253,0.5)",
    fg: "#fafafa",
    muted: "#a1a1aa",
    primary: "#c4b5fd",
    shadow: "0 6px 24px rgba(0,0,0,.7),0 2px 8px rgba(0,0,0,.5)",
};

const BASE_LIGHT: BasePalette = {
    bg: "#f2f2f2",
    btnBg: "rgba(124,58,237,0.08)",
    btnBgHover: "rgba(124,58,237,0.16)",
    btnBorder: "rgba(124,58,237,0.25)",
    btnBorderHover: "rgba(124,58,237,0.5)",
    fg: "#18181b",
    muted: "#52525b",
    primary: "#7c3aed",
    shadow: "0 4px 20px rgba(0,0,0,.12),0 0 0 1px rgba(0,0,0,.08)",
};

export const INSPECTOR_DARK: InspectorPalette = {
    ...BASE_DARK,
    overlayBg: "rgba(196,181,253,0.06)",
    overlayBorder: "rgba(196,181,253,0.7)",
};

export const INSPECTOR_LIGHT: InspectorPalette = {
    ...BASE_LIGHT,
    overlayBg: "rgba(124,58,237,0.06)",
    overlayBorder: "rgba(124,58,237,0.7)",
};

export const ANNOTATION_DARK: AnnotationPalette = {
    ...BASE_DARK,
    danger: "#ef4444",
    success: "#22c55e",
};

export const ANNOTATION_LIGHT: AnnotationPalette = {
    ...BASE_LIGHT,
    danger: "#dc2626",
    success: "#16a34a",
};

/** Cached to avoid reading localStorage on every call. */
let cachedIsDark: boolean | undefined;

const resolveIsDark = (): boolean => {
    if (cachedIsDark !== undefined) {
        return cachedIsDark;
    }

    try {
        const stored = localStorage.getItem("__v_dt__theme");

        if (stored === "light") {
            cachedIsDark = false;

            return false;
        }

        if (stored === "dark") {
            cachedIsDark = true;

            return true;
        }
    } catch {
        /* noop */
    }

    cachedIsDark = globalThis.window?.matchMedia("(prefers-color-scheme: dark)").matches ?? true;

    return cachedIsDark;
};

export const isDarkTheme = (): boolean => resolveIsDark();

export const getInspectorPalette = (): InspectorPalette => (resolveIsDark() ? INSPECTOR_DARK : INSPECTOR_LIGHT);

export const getAnnotationPalette = (): AnnotationPalette => (resolveIsDark() ? ANNOTATION_DARK : ANNOTATION_LIGHT);

/** Reset cache (e.g. when theme changes). */
export const resetPaletteCache = (): void => {
    cachedIsDark = undefined;
};

// Auto-invalidate when theme changes in localStorage (same or other tab).
// Guarded to prevent duplicate listeners on HMR reloads.
const LISTENER_KEY = "__vdt_palette_listener";

if (globalThis.window !== undefined && !(globalThis as unknown as Record<string, unknown>)[LISTENER_KEY]) {
    (globalThis as unknown as Record<string, unknown>)[LISTENER_KEY] = true;
    globalThis.addEventListener("storage", (e) => {
        if (e.key === "__v_dt__theme") {
            cachedIsDark = undefined;
        }
    });
}
