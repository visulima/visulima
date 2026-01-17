import { useEffect, useRef } from "preact/hooks";

const HOVER_DELAY = 2000; // 2 seconds (matching Vue DevTools)

/**
 * Hook for delayed hide functionality
 * Matches Vue DevTools behavior: hide only when mouse leaves entire toolbar area
 * @param isVisible Current visibility state
 * @param shouldHide Whether hide should be triggered
 * @param onHide Callback when hide should occur
 */
export const useDelayedHide = (isVisible: boolean, shouldHide: boolean, onHide: () => void): void => {
    const timeoutRef = useRef<number | undefined>();

    useEffect(() => {
        if (!isVisible || !shouldHide) {
            // Clear timeout if toolbar is hidden or shouldn't hide
            if (timeoutRef.current !== undefined) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = undefined;
            }

            return;
        }

        // Set timeout to hide (matches Vue DevTools timing)
        timeoutRef.current = window.setTimeout(() => {
            onHide();
            timeoutRef.current = undefined;
        }, HOVER_DELAY);

        return () => {
            if (timeoutRef.current !== undefined) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = undefined;
            }
        };
    }, [isVisible, shouldHide, onHide]);
};
