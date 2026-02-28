import { useEffect, useMemo } from "preact/hooks";

import { useFrameState } from "./use-frame-state";

/**
 * Check if a KeyboardEvent matches a binding string like "Alt+Shift+D" or "Escape"
 */
const matchesBinding = (e: KeyboardEvent, binding: string): boolean => {
    const parts = binding.split("+");
    const key = parts.at(-1) ?? "";
    const needsAlt = parts.includes("Alt");
    const needsShift = parts.includes("Shift");
    const needsCtrl = parts.includes("Control") || parts.includes("Ctrl");
    const needsMeta = parts.includes("Meta") || parts.includes("Cmd");

    const keyMatches = e.key === key || e.code === `Key${key.toUpperCase()}`;

    return (
        keyMatches &&
        e.altKey === needsAlt &&
        e.shiftKey === needsShift &&
        e.ctrlKey === needsCtrl &&
        e.metaKey === needsMeta
    );
};

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
        const willOpen = newState ?? !state.open;

        updateState({
            open: willOpen,
            // Exit fullscreen when closing so the panel re-opens in normal mode
            ...(willOpen ? {} : { viewMode: "default" }),
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
            viewMode: "default",
        });
    };

    // Keyboard shortcut: configurable toggle (default Alt+Shift+D)
    useEffect(() => {
        const binding = state.keybindings?.toggle ?? "Alt+Shift+D";

        const handleKeyDown = (e: KeyboardEvent): void => {
            if (matchesBinding(e, binding)) {
                togglePanelVisible();
            }
        };

        globalThis.window?.addEventListener("keydown", handleKeyDown);

        return () => {
            globalThis.window?.removeEventListener("keydown", handleKeyDown);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.open, state.keybindings?.toggle]);

    const panelVisibleValue: boolean = useMemo(() => state.open, [state.open]);

    const result: UsePanelVisibleReturn = {
        closePanel,
        panelVisible: panelVisibleValue,
        togglePanelVisible,
    };

    return result;
};
