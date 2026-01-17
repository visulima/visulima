import { useEffect, useMemo } from "preact/hooks";

import { useFrameState } from "./use-frame-state";

/**
 * Return type for usePanelVisible hook
 */
export interface UsePanelVisibleReturn {
    /**
     * Close panel
     */
    closePanel: () => void;

    /**
     * Whether panel is visible
     */
    panelVisible: boolean;

    /**
     * Toggle panel visibility
     */
    togglePanelVisible: (_?: unknown, newState?: boolean) => void;
}

/**
 * Hook for panel visibility management - converted from Vue DevTools usePanelVisible
 */
export const usePanelVisible = (): UsePanelVisibleReturn => {
    const { state, updateState } = useFrameState();

    /**
     * Toggle panel visibility
     */
    const togglePanelVisible = (_?: unknown, newState?: boolean): void => {
        updateState({
            open: newState ?? !state.open,
        });
    };

    /**
     * Close panel
     */
    const closePanel = (): void => {
        if (!state.open) {
            return;
        }

        updateState({
            open: false,
        });
    };

    // Keyboard shortcut: Alt+Shift+D to toggle
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent): void => {
            // cmd + shift + D in <macOS>
            // alt + shift + D in <Windows>
            if (e.code === "KeyD" && e.altKey && e.shiftKey) {
                togglePanelVisible();
            }
        };

        globalThis.window?.addEventListener("keydown", handleKeyDown);

        return () => {
            globalThis.window?.removeEventListener("keydown", handleKeyDown);
        };
    }, [state.open]);

    const panelVisibleValue: boolean = useMemo(() => state.open, [state.open]);

    const result: UsePanelVisibleReturn = {
        closePanel,
        panelVisible: panelVisibleValue,
        togglePanelVisible,
    };

    return result;
};
