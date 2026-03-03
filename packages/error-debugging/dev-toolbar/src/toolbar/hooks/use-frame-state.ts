import { useEffect, useState } from "preact/hooks";

/**
 * Keyboard shortcut bindings
 */
export interface KeyBindings {
    /** Close active app / panel */
    close: string;
    /** Toggle toolbar panel open/closed */
    toggle: string;
}

export const DEFAULT_KEYBINDINGS: KeyBindings = {
    close: "Escape",
    toggle: "Alt+Shift+D",
};

/**
 * Frame state interface
 */
export interface DevToolsFrameState {
    /**
     * Close panel on outside click
     */
    closeOnOutsideClick: boolean;

    /**
     * Panel height as viewport height percentage
     */
    height: number;

    /**
     * Whether this is the first visit (used to show onboarding hint)
     */
    isFirstVisit: boolean;

    /**
     * Whether DevTools panel is open in a Picture-in-Picture window
     */
    isPip: boolean;

    /**
     * Keyboard shortcut bindings
     */
    keybindings: KeyBindings;

    /**
     * Horizontal position as percentage (0-100)
     */
    left: number;

    /**
     * Auto-hide timeout in milliseconds (-1 = never hide, 0 = always hide when inactive)
     */
    minimizePanelInactive: number;

    /**
     * Whether panel is open
     */
    open: boolean;

    /**
     * Position anchor
     */
    position: "top" | "bottom" | "left" | "right";

    /**
     * Prefer showing floating panel
     */
    preferShowFloatingPanel: boolean;

    /**
     * Reduce motion for accessibility
     */
    reduceMotion: boolean;

    /**
     * Current route
     */
    route: string;

    /**
     * Vertical position as percentage (0-100)
     */
    top: number;

    /**
     * Panel view mode
     */
    viewMode: "default" | "fullscreen" | "wide";

    /**
     * Panel width as viewport width percentage
     */
    width: number;
}

const STORAGE_KEY = "__v_dt__frame_state";

/**
 * Default frame state - matches Vue DevTools exactly
 */
const DEFAULT_STATE: DevToolsFrameState = {
    closeOnOutsideClick: true,
    height: 60,
    isFirstVisit: true,
    isPip: false,
    keybindings: DEFAULT_KEYBINDINGS,
    left: 50,
    minimizePanelInactive: 5000,
    open: false,
    position: "bottom",
    preferShowFloatingPanel: true,
    reduceMotion: false,
    route: "/",
    top: 0,
    viewMode: "default",
    width: 80,
};

/**
 * Build effective defaults by layering plugin options on top of hardcoded defaults.
 * Plugin options act as project-level defaults; localStorage values override them.
 */
const buildEffectiveDefaults = (): DevToolsFrameState => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pluginOptions = (globalThis as any).__VISULIMA_DEV_TOOLBAR_OPTIONS__ as Record<string, any> | undefined;

    if (!pluginOptions) {
        return { ...DEFAULT_STATE };
    }

    return {
        ...DEFAULT_STATE,
        closeOnOutsideClick: pluginOptions["closeOnOutsideClick"] ?? DEFAULT_STATE.closeOnOutsideClick,
        height: pluginOptions["height"] ?? DEFAULT_STATE.height,
        keybindings: {
            ...DEFAULT_KEYBINDINGS,
            ...pluginOptions["keybindings"],
        },
        minimizePanelInactive: pluginOptions["minimizePanelInactive"] ?? DEFAULT_STATE.minimizePanelInactive,
        position: pluginOptions["position"] ?? DEFAULT_STATE.position,
        reduceMotion: pluginOptions["reduceMotion"] ?? DEFAULT_STATE.reduceMotion,
        width: pluginOptions["width"] ?? DEFAULT_STATE.width,
    };
};

/**
 * Load state from localStorage
 */
const loadState = (): DevToolsFrameState => {
    const effectiveDefaults = buildEffectiveDefaults();

    if (globalThis.window === undefined) {
        return effectiveDefaults;
    }

    try {
        const stored = localStorage.getItem(STORAGE_KEY);

        if (stored) {
            const parsed = JSON.parse(stored) as Partial<DevToolsFrameState>;

            return {
                ...effectiveDefaults,
                ...parsed,
                // Merge keybindings with defaults so new bindings added later still have defaults
                keybindings: { ...effectiveDefaults.keybindings, ...parsed.keybindings },
                // Never restore open state - panel always starts closed on page load
                // so the canvas doesn't appear unexpectedly.
                open: false,
            };
        }
    } catch {
        // Ignore errors
    }

    return effectiveDefaults;
};

/**
 * Save state to localStorage
 */
const saveState = (state: DevToolsFrameState): void => {
    if (globalThis.window === undefined) {
        return;
    }

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Ignore errors
    }
};

// ---------------------------------------------------------------------------
// Module-level singleton store
//
// Multiple hooks (usePosition, usePanelVisible, toolbar-container) all call
// useFrameState(). Without shared state, each gets its own useState copy.
// When one instance updates (e.g. position during drag), others keep stale
// values and can overwrite localStorage with the old data when THEY update.
// A singleton store ensures every caller always reads/writes the same state.
// ---------------------------------------------------------------------------

let sharedState: DevToolsFrameState = loadState();
const listeners = new Set<() => void>();

const notifyListeners = (): void => {
    for (const listener of listeners) {
        listener();
    }
};

/**
 * Return type for useFrameState hook
 */
export interface UseFrameStateReturn {
    /**
     * Current frame state
     */
    state: DevToolsFrameState;

    /**
     * Update state with partial values
     */
    updateState: (value: Partial<DevToolsFrameState>) => void;
}

/**
 * Singleton shared state update - writes to localStorage and notifies all subscribers
 */
const updateSharedState = (value: Partial<DevToolsFrameState>): void => {
    sharedState = { ...sharedState, ...value };
    saveState(sharedState);
    notifyListeners();
};

/**
 * Hook for frame state management.
 * All callers share the same module-level state so position, open, and other
 * fields stay in sync regardless of how many times the hook is called.
 */
export const useFrameState = (): UseFrameStateReturn => {
    // Local counter used only to trigger re-renders when shared state changes
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        const listener = (): void => {
            forceUpdate((n) => n + 1);
        };

        listeners.add(listener);

        return () => {
            listeners.delete(listener);
        };
    }, []);

    return {
        state: sharedState,
        updateState: updateSharedState,
    };
};
