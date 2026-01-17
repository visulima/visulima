import { createContext } from "preact";
import { useContext } from "preact/hooks";

import type { DevToolbarAppState, ToolbarPlacement } from "../../types/index";

/**
 * Toolbar context state
 */
export interface ToolbarContextState {
    /**
     * All registered apps
     */
    apps: DevToolbarAppState[];

    /**
     * Currently active app ID
     */
    activeAppId: string | null;

    /**
     * Whether toolbar is visible
     */
    isVisible: boolean;

    /**
     * Toolbar placement on screen
     */
    placement: ToolbarPlacement;

    /**
     * Whether toolbar is being dragged
     */
    isDragging: boolean;

    /**
     * Set toolbar visibility
     */
    setVisible: (visible: boolean) => void;

    /**
     * Set toolbar placement
     */
    setPlacement: (placement: ToolbarPlacement) => void;

    /**
     * Set dragging state
     */
    setDragging: (dragging: boolean) => void;

    /**
     * Register an app
     */
    registerApp: (app: DevToolbarAppState) => void;

    /**
     * Unregister an app
     */
    unregisterApp: (appId: string) => void;

    /**
     * Toggle an app
     */
    toggleApp: (appId: string) => Promise<void>;

    /**
     * Set app notification
     */
    setNotification: (appId: string, state: boolean, level?: "info" | "warning" | "error") => void;

    /**
     * Clear app notification
     */
    clearNotification: (appId: string) => void;
}

/**
 * Toolbar context
 */
export const ToolbarContext: ReturnType<typeof createContext<ToolbarContextState | null>> = createContext<ToolbarContextState | null>(null);

/**
 * Hook to access toolbar context
 * @throws Error if used outside ToolbarContext provider
 */
export const useToolbarContext = (): ToolbarContextState => {
    const context: ToolbarContextState | null = useContext(ToolbarContext);

    if (!context) {
        throw new Error("useToolbarContext must be used within ToolbarContext provider");
    }

    return context;
};
