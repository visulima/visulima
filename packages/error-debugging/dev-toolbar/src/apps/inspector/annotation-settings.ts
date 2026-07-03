/**
 * Annotation-specific settings — output detail level, marker appearance,
 * interaction behavior. Persisted in localStorage.
 */

const STORAGE_KEY = "__vdt_annotation_settings";

// ─── Types ───────────────────────────────────────────────────────────────────

export type OutputDetailLevel = "compact" | "detailed" | "forensic" | "standard";
export type MarkerClickBehavior = "delete" | "detail" | "edit";

export interface MarkerColor {
    /** Solid background for the marker */
    bg: string;
    /** Slightly darker ring / shadow tint */
    border: string;
    /** Text color inside the marker (white or dark for contrast) */
    fg: string;
    /** Translucent version for hover highlight overlay on elements */
    highlightBg: string;
    label: string;
    name: string;
}

export const MARKER_COLORS: MarkerColor[] = [
    { bg: "#6366f1", border: "#4f46e5", fg: "#fff", highlightBg: "rgba(99,102,241,0.12)", label: "Indigo", name: "indigo" },
    { bg: "#3b82f6", border: "#2563eb", fg: "#fff", highlightBg: "rgba(59,130,246,0.12)", label: "Blue", name: "blue" },
    { bg: "#06b6d4", border: "#0891b2", fg: "#fff", highlightBg: "rgba(6,182,212,0.12)", label: "Cyan", name: "cyan" },
    { bg: "#22c55e", border: "#16a34a", fg: "#fff", highlightBg: "rgba(34,197,94,0.12)", label: "Green", name: "green" },
    { bg: "#eab308", border: "#ca8a04", fg: "#1a1a1a", highlightBg: "rgba(234,179,8,0.12)", label: "Yellow", name: "yellow" },
    { bg: "#f97316", border: "#ea580c", fg: "#fff", highlightBg: "rgba(249,115,22,0.12)", label: "Orange", name: "orange" },
    { bg: "#ef4444", border: "#dc2626", fg: "#fff", highlightBg: "rgba(239,68,68,0.12)", label: "Red", name: "red" },
];

export interface AnnotationSettings {
    /** Block clicks on interactive elements (buttons, links, inputs) while active */
    blockInteractions: boolean;

    /** What happens when you click a marker */
    markerClickBehavior: MarkerClickBehavior;

    /** Marker color name (from MARKER_COLORS) */
    markerColorName: string;

    /** Output detail level for markdown export */
    outputDetail: OutputDetailLevel;
}

export const DEFAULT_SETTINGS: AnnotationSettings = {
    blockInteractions: true,
    markerClickBehavior: "detail",
    markerColorName: "indigo",
    outputDetail: "standard",
};

// ─── Persistence (cached — avoids localStorage reads on every call) ──────────

let cachedSettings: AnnotationSettings | undefined;

export const loadSettings = (): AnnotationSettings => {
    if (cachedSettings) {
        return cachedSettings;
    }

    try {
        const raw = localStorage.getItem(STORAGE_KEY);

        if (raw) {
            const parsed = JSON.parse(raw) as Partial<AnnotationSettings>;

            cachedSettings = { ...DEFAULT_SETTINGS, ...parsed };

            return cachedSettings;
        }
    } catch {
        /* ignore */
    }

    cachedSettings = { ...DEFAULT_SETTINGS };

    return cachedSettings;
};

export const saveSettings = (settings: AnnotationSettings): void => {
    cachedSettings = settings;

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
        /* ignore */
    }
};

export const getMarkerColor = (settings?: AnnotationSettings): MarkerColor => {
    const s = settings ?? loadSettings();

    return MARKER_COLORS.find((c) => c.name === s.markerColorName) ?? MARKER_COLORS[0]!;
};
