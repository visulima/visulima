import { useEffect, useMemo, useState } from "preact/hooks";

/**
 * Frame state interface - matches Vue DevTools exactly
 */
export interface DevToolsFrameState {
    /**
     * Panel width as viewport width percentage
     */
    width: number;

    /**
     * Panel height as viewport height percentage
     */
    height: number;

    /**
     * Vertical position as percentage (0-100)
     */
    top: number;

    /**
     * Horizontal position as percentage (0-100)
     */
    left: number;

    /**
     * Whether panel is open
     */
    open: boolean;

    /**
     * Current route
     */
    route: string;

    /**
     * Position anchor
     */
    position: "top" | "bottom" | "left" | "right";

    /**
     * Whether this is first visit
     */
    isFirstVisit: boolean;

    /**
     * Close panel on outside click
     */
    closeOnOutsideClick: boolean;

    /**
     * Auto-hide timeout in milliseconds (-1 = never hide, 0 = always hide when inactive)
     */
    minimizePanelInactive: number;

    /**
     * Prefer showing floating panel
     */
    preferShowFloatingPanel: boolean;

    /**
     * Reduce motion for accessibility
     */
    reduceMotion: boolean;
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
 * Hook for frame state management - matches Vue DevTools useFrameState
 */
export const useFrameState = (): UseFrameStateReturn => {
    const [state, setState] = useState<DevToolsFrameState>(() => loadState());

    // Save state when it changes
    useEffect(() => {
        saveState(state);
    }, [state]);

    /**
     * Update state with partial values
     */
    const updateState = (value: Partial<DevToolsFrameState>): void => {
        setState((previous) => ({
            ...previous,
            ...value,
        }));
    };

    // Return readonly state and update function
    const memoizedState: DevToolsFrameState = useMemo(() => state, [state]);

    const result: UseFrameStateReturn = {
        state: memoizedState,
        updateState,
    };

    return result;
};
