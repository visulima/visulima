/**
 * User-configurable clipboard format for annotation/inspector copy actions.
 *
 * The base detail level (compact / standard / detailed / forensic) acts as a
 * preset; an optional per-field override lets users include or exclude specific
 * fields without writing their own format from scratch. Preferences persist to
 * localStorage under the same namespace as the rest of the dev-toolbar.
 */

export type ClipboardDetail = "compact" | "detailed" | "forensic" | "standard";

export type ClipboardField
    = | "accessibility"
        | "classes"
        | "componentStack"
        | "componentSource"
        | "computedStyles"
        | "domPath"
        | "frameworkComponent"
        | "nearbyElements"
        | "nearbyText"
        | "selectedText"
        | "selector"
        | "source"
        | "status"
        | "url";

export interface ClipboardProfile {
    detail: ClipboardDetail;
    /** Per-field opt-in/out overrides. Omitted fields fall back to detail-level defaults. */
    fields?: Partial<Record<ClipboardField, boolean>>;
    /** Profile name shown in the UI; built-in profiles use reserved names. */
    name: string;
}

const STORAGE_KEY = "__v_dt__clipboard_profile";

export const BUILT_IN_PROFILES: Record<string, ClipboardProfile> = {
    "ai-agent": {
        detail: "detailed",
        name: "For AI agent",
    },
    forensic: {
        detail: "forensic",
        name: "Forensic dump",
    },
    ide: {
        detail: "compact",
        fields: {
            componentSource: true,
            selector: true,
            source: true,
        },
        name: "For IDE paste",
    },
    minimal: {
        detail: "compact",
        name: "Minimal",
    },
    standard: {
        detail: "standard",
        name: "Standard",
    },
};

const DEFAULT_PROFILE_KEY = "ai-agent";

/**
 * Field defaults per detail level. A field renders when the active profile
 * has it explicitly toggled on, OR when its detail level says so AND the
 * profile hasn't explicitly toggled it off.
 */
export const DETAIL_DEFAULTS: Record<ClipboardDetail, Set<ClipboardField>> = {
    compact: new Set(["selectedText"]),
    detailed: new Set([
        "classes",
        "componentSource",
        "componentStack",
        "domPath",
        "frameworkComponent",
        "nearbyText",
        "selectedText",
        "selector",
        "source",
        "status",
        "url",
    ]),
    forensic: new Set([
        "accessibility",
        "classes",
        "componentSource",
        "componentStack",
        "computedStyles",
        "domPath",
        "frameworkComponent",
        "nearbyElements",
        "nearbyText",
        "selectedText",
        "selector",
        "source",
        "status",
        "url",
    ]),
    standard: new Set([
        "componentSource",
        "componentStack",
        "frameworkComponent",
        "selectedText",
        "selector",
        "source",
        "status",
        "url",
    ]),
};

export const isFieldEnabled = (profile: ClipboardProfile, field: ClipboardField): boolean => {
    const override = profile.fields?.[field];

    if (override !== undefined) {
        return override;
    }

    return DETAIL_DEFAULTS[profile.detail].has(field);
};

export const loadClipboardProfile = (): ClipboardProfile => {
    if (globalThis.localStorage === undefined) {
        return BUILT_IN_PROFILES[DEFAULT_PROFILE_KEY]!;
    }

    try {
        const raw = globalThis.localStorage.getItem(STORAGE_KEY);

        if (!raw) {
            return BUILT_IN_PROFILES[DEFAULT_PROFILE_KEY]!;
        }

        const parsed = JSON.parse(raw) as ClipboardProfile;

        // Defensive: ensure detail is a valid value
        if (!parsed || !["compact", "detailed", "forensic", "standard"].includes(parsed.detail)) {
            return BUILT_IN_PROFILES[DEFAULT_PROFILE_KEY]!;
        }

        return parsed;
    } catch {
        return BUILT_IN_PROFILES[DEFAULT_PROFILE_KEY]!;
    }
};

export const saveClipboardProfile = (profile: ClipboardProfile): void => {
    try {
        globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
        /* ignore quota / disabled storage */
    }
};

export const resetClipboardProfile = (): void => {
    try {
        globalThis.localStorage?.removeItem(STORAGE_KEY);
    } catch {
        /* ignore */
    }
};
