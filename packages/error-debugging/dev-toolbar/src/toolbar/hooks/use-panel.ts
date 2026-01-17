import type { Dispatch } from "preact/hooks";
import type { StateUpdater } from "preact/hooks";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

const PANEL_STORAGE_KEY = "__VISULIMA_DEVTOOLS_PANEL__";

/**
 * Panel state
 */
export interface PanelState {
    /**
     * Whether panel is expanded
     */
    isExpanded: boolean;

    /**
     * Panel width (when expanded)
     */
    width: number;

    /**
     * Panel height (when expanded)
     */
    height: number;
}

const DEFAULT_PANEL_STATE: PanelState = {
    height: 600,
    isExpanded: false,
    width: 800,
};

/**
 * Load panel state from localStorage
 */
const loadPanelState = (): PanelState => {
    if (globalThis.window === undefined) {
        return { ...DEFAULT_PANEL_STATE };
    }

    try {
        const stored = localStorage.getItem(PANEL_STORAGE_KEY);

        if (stored) {
            const parsed = JSON.parse(stored) as Partial<PanelState>;

            return {
                ...DEFAULT_PANEL_STATE,
                ...parsed,
            };
        }
    } catch (error) {
        console.warn("[dev-toolbar] Failed to load panel state:", error);
    }

    return { ...DEFAULT_PANEL_STATE };
};

/**
 * Save panel state to localStorage
 */
const savePanelState = (state: PanelState): void => {
    if (globalThis.window === undefined) {
        return;
    }

    try {
        localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        console.warn("[dev-toolbar] Failed to save panel state:", error);
    }
};

/**
 * Return type for usePanel hook
 */
export interface UsePanelReturn {
    handleResizeEnd: () => void;
    handleResizeMove: (event: MouseEvent | TouchEvent) => void;
    handleResizeStart: (event: MouseEvent | TouchEvent) => void;
    panelState: PanelState;
    setExpanded: (expanded: boolean) => void;
    setPanelState: Dispatch<StateUpdater<PanelState>>;
    toggleExpanded: () => void;
}

/**
 * Hook for panel expand/collapse/resize state
 */
export const usePanel = (): UsePanelReturn => {
    const [panelState, setPanelState] = useState<PanelState>(loadPanelState);
    const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

    // Save panel state when it changes
    useEffect(() => {
        savePanelState(panelState);
    }, [panelState]);

    // Toggle expand/collapse
    const toggleExpanded = useCallback(() => {
        setPanelState((prev) => ({
            ...prev,
            isExpanded: !prev.isExpanded,
        }));
    }, []);

    // Set expanded state
    const setExpanded = useCallback((expanded: boolean) => {
        setPanelState((prev) => ({
            ...prev,
            isExpanded: expanded,
        }));
    }, []);

    // Handle resize start
    const handleResizeStart = useCallback(
        (event: MouseEvent | TouchEvent) => {
            const clientX = "touches" in event ? (event.touches[0]?.clientX ?? 0) : event.clientX;
            const clientY = "touches" in event ? (event.touches[0]?.clientY ?? 0) : event.clientY;

            resizeStartRef.current = {
                height: panelState.height,
                width: panelState.width,
                x: clientX,
                y: clientY,
            };
        },
        [panelState.height, panelState.width],
    );

    // Handle resize move
    const handleResizeMove = useCallback((event: MouseEvent | TouchEvent) => {
        if (!resizeStartRef.current) {
            return;
        }

        const clientX = "touches" in event ? (event.touches[0]?.clientX ?? 0) : event.clientX;
        const clientY = "touches" in event ? (event.touches[0]?.clientY ?? 0) : event.clientY;

        const deltaX = clientX - resizeStartRef.current.x;
        const deltaY = clientY - resizeStartRef.current.y;

        const minWidth = 300;
        const minHeight = 200;
        const maxWidth = globalThis.window?.innerWidth ?? 1920;
        const maxHeight = globalThis.window?.innerHeight ?? 1080;

        const newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStartRef.current.width + deltaX));
        const newHeight = Math.max(minHeight, Math.min(maxHeight, resizeStartRef.current.height + deltaY));

        setPanelState((prev) => ({
            ...prev,
            height: newHeight,
            width: newWidth,
        }));

        // Update resize start for next move
        resizeStartRef.current = {
            height: newHeight,
            width: newWidth,
            x: clientX,
            y: clientY,
        };
    }, []);

    // Handle resize end
    const handleResizeEnd = useCallback(() => {
        resizeStartRef.current = null;
    }, []);

    return {
        handleResizeEnd: handleResizeEnd,
        handleResizeMove: handleResizeMove,
        handleResizeStart: handleResizeStart,
        panelState: panelState,
        setExpanded: setExpanded,
        setPanelState: setPanelState,
        toggleExpanded: toggleExpanded,
    };
};
