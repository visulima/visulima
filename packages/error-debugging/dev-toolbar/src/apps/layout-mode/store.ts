/**
 * Layout-mode store — shared module-level state subscribed to by both the
 * in-toolbar palette UI and the in-page overlay (which live in different
 * Preact roots and cannot share React context).
 */

import type { ComponentType, DesignPlacement, RearrangeState } from "./types";

export interface LayoutModeState {
    activeComponent: ComponentType | null;
    blankCanvas: boolean;
    canvasOpacity: number;
    clearSignal: number;
    deselectSignal: number;
    detailLevel: "compact" | "standard" | "detailed" | "forensic";
    placements: DesignPlacement[];
    rearrange: RearrangeState;
    wireframePurpose: string;
}

const STORE_KEY = "__vdt_layout_mode_store";

const createInitial = (): LayoutModeState => ({
    activeComponent: null,
    blankCanvas: false,
    canvasOpacity: 1,
    clearSignal: 0,
    deselectSignal: 0,
    detailLevel: "standard",
    placements: [],
    rearrange: {
        detectedAt: 0,
        originalOrder: [],
        sections: [],
    },
    wireframePurpose: "",
});

const getStateContainer = (): { state: LayoutModeState; listeners: Set<(s: LayoutModeState) => void> } => {
    const w = globalThis as unknown as Record<string, unknown>;

    if (!w[STORE_KEY]) {
        w[STORE_KEY] = { listeners: new Set(), state: createInitial() };
    }

    return w[STORE_KEY] as { state: LayoutModeState; listeners: Set<(s: LayoutModeState) => void> };
};

export const getLayoutModeState = (): LayoutModeState => getStateContainer().state;

export const setLayoutModeState = (next: Partial<LayoutModeState> | ((previous: LayoutModeState) => Partial<LayoutModeState>)): void => {
    const container = getStateContainer();
    const patch = typeof next === "function" ? next(container.state) : next;

    container.state = { ...container.state, ...patch };

    for (const listener of container.listeners) {
        try {
            listener(container.state);
        } catch {
            /* ignore listener errors */
        }
    }
};

export const subscribeLayoutMode = (listener: (s: LayoutModeState) => void): (() => void) => {
    const container = getStateContainer();

    container.listeners.add(listener);

    return () => {
        container.listeners.delete(listener);
    };
};

export const resetLayoutMode = (): void => {
    setLayoutModeState(createInitial());
};
