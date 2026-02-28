import { useToolbarContext } from "../context/index";
import type { ToolbarPlacement } from "../../types/index";

/**
 * Hook for toolbar visibility and placement - exposes context methods directly
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

    return {
        hide: () => context.setVisible(false),
        isDragging: context.isDragging,
        isVisible: context.isVisible,
        placement: context.placement,
        setDragging: context.setDragging,
        setPlacement: context.setPlacement,
        show: () => context.setVisible(true),
        toggle: () => context.setVisible(!context.isVisible),
    };
};
