import { useCallback } from "preact/hooks";

import { useToolbarContext } from "../context/index";
import type { ToolbarPlacement } from "../../types/index";

/**
 * Hook for toolbar visibility and placement
 */
export const useToolbar = (): {
    hide: () => void;
    isDragging: boolean;
    isVisible: boolean;
    placement: ToolbarPlacement;
    setDragging: (dragging: boolean) => void;
    setPlacement: (placement: ToolbarPlacement) => void;
    show: () => void;
    toggle: () => void;
} => {
    const context = useToolbarContext();

    const show = useCallback(() => {
        context.setVisible(true);
    }, [context]);

    const hide = useCallback(() => {
        context.setVisible(false);
    }, [context]);

    const toggle = useCallback(() => {
        context.setVisible(!context.isVisible);
    }, [context]);

    const setPlacement = useCallback(
        (placement: ToolbarPlacement) => {
            context.setPlacement(placement);
        },
        [context],
    );

    return {
        isDragging: context.isDragging,
        isVisible: context.isVisible,
        placement: context.placement,
        setDragging: context.setDragging,
        setPlacement,
        hide,
        show,
        toggle,
    };
};
