import { useEffect, useMemo } from "preact/hooks";

import { useFrameState } from "./use-frame-state";

/**
 * Returns true if the keyboard event matches the given binding string (e.g. "Alt+Shift+D" or "Escape").
 */
const matchesBinding = (event: KeyboardEvent, binding: string): boolean => {
    const parts = binding.split("+");
    const key = parts.at(-1) ?? "";
    const needsAlt = parts.includes("Alt");
    const needsShift = parts.includes("Shift");
    const needsCtrl = parts.includes("Control") || parts.includes("Ctrl");
    const needsMeta = parts.includes("Meta") || parts.includes("Cmd");

    const keyMatches = event.key === key || event.code === `Key${key.toUpperCase()}`;

    return keyMatches && event.altKey === needsAlt && event.shiftKey === needsShift && event.ctrlKey === needsCtrl && event.metaKey === needsMeta;
};

/**
 * Return type for the usePanelVisible hook.
 */
interface UsePanelVisibleReturn {
    /**
     * Closes the panel.
     */
    closePanel: () => void;

    /**
     * Whether the panel is currently visible.
     */
    panelVisible: boolean;

    /**
     * Toggles panel visibility, optionally forcing a specific state.
     */
    togglePanelVisible: (_?: unknown, newState?: boolean) => void;
}

/**
 * Manages panel visibility with keyboard shortcut support.
 */
const usePanelVisible = (): UsePanelVisibleReturn => {
    const { state, updateState } = useFrameState();

    /**
     * Toggles panel visibility, optionally forcing a specific open/close state.
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
     * Closes the panel and resets the view mode to default.
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

        const handleKeyDown = (event: KeyboardEvent): void => {
            if (matchesBinding(event, binding)) {
                togglePanelVisible();
            }
        };

        globalThis.window?.addEventListener("keydown", handleKeyDown);

        return () => {
            globalThis.window?.removeEventListener("keydown", handleKeyDown);
        };
    }, [state.open, state.keybindings?.toggle]);

    const panelVisibleValue: boolean = useMemo(() => state.open, [state.open]);

    const result: UsePanelVisibleReturn = {
        closePanel,
        panelVisible: panelVisibleValue,
        togglePanelVisible,
    };

    return result;
};

export type { UsePanelVisibleReturn };
export { usePanelVisible };
