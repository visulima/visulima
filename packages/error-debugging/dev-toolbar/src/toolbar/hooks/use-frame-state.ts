import { useEffect, useState } from "preact/hooks";

/**
 * Frame state interface - matches Vue DevTools exactly
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
     * Whether this is first visit
     */
    isFirstVisit: boolean;

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
     * Panel width as viewport width percentage
     */
    width: number;
}

const STORAGE_KEY = "__VISULIMA_DEVTOOLS_FRAME_STATE__";

/**
 * Default frame state - matches Vue DevTools exactly
 */
const DEFAULT_STATE: DevToolsFrameState = {
    closeOnOutsideClick: false,
    height: 60,
    isFirstVisit: true,
    left: 50,
    minimizePanelInactive: 5000,
    open: false,
    position: "bottom",
    preferShowFloatingPanel: true,
    reduceMotion: false,
    route: "/",
    top: 0,
    width: 80,
};

/**
 * Load state from localStorage
 */
const loadState = (): DevToolsFrameState => {
    if (globalThis.window === undefined) {
        return { ...DEFAULT_STATE };
    }

    try {
        const stored = localStorage.getItem(STORAGE_KEY);

        if (stored) {
            const parsed = JSON.parse(stored) as Partial<DevToolsFrameState>;

            return {
                ...DEFAULT_STATE,
                ...parsed,
                // Never restore open state - panel always starts closed on page load
                // so the canvas doesn't appear unexpectedly.
                open: false,
            };
        }
    } catch {
        // Ignore errors
    }

    return { ...DEFAULT_STATE };
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
