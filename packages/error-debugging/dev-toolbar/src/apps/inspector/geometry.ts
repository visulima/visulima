/**
 * Coordinate conversion and popup placement for the annotation overlay.
 *
 * Kept apart from the overlay itself because it is the only part of it that
 * is pure arithmetic over the viewport, and so the only part that can be
 * tested without building the overlay's DOM.
 */

/** Gap kept between a popup and both the anchor and the viewport edge. */
const POPUP_MARGIN = 8;

/**
 * Convert viewport click coords to page-absolute coords for storage.
 * x = percentage of viewport width, y = absolute page Y (scrollY + clientY).
 * For fixed elements, y stays as viewport-relative (no scrollY offset).
 */
export const toPageCoords = (clientX: number, clientY: number, fixed = false): { x: number; y: number } => {
    return {
        x: (clientX / window.innerWidth) * 100,
        y: fixed ? clientY : clientY + window.scrollY,
    };
};

/**
 * Convert stored page coords back to viewport position for rendering.
 * Fixed elements use viewport-relative Y directly.
 */
export const toViewportCoords = (x: number, y: number, fixed = false): { left: number; top: number } => {
    return {
        left: (x / 100) * window.innerWidth,
        top: fixed ? y : y - window.scrollY,
    };
};

/**
 * Best position for a popup of `formRect`'s size near an anchor point.
 *
 * Tries below the anchor, then above it, then clamps to the viewport; the
 * same three-way choice runs horizontally, preferring the anchor's right.
 */
export const computePopupPosition = (formRect: { height: number; width: number }, anchorX: number, anchorY: number): { left: number; top: number } => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top: number;

    if (anchorY + POPUP_MARGIN + formRect.height <= viewportHeight - POPUP_MARGIN) {
        top = anchorY + POPUP_MARGIN;
    } else if (anchorY - POPUP_MARGIN - formRect.height >= POPUP_MARGIN) {
        top = anchorY - POPUP_MARGIN - formRect.height;
    } else {
        top = Math.max(POPUP_MARGIN, viewportHeight - formRect.height - POPUP_MARGIN);
    }

    let left: number;

    if (anchorX + formRect.width <= viewportWidth - POPUP_MARGIN) {
        left = anchorX;
    } else if (anchorX - formRect.width >= POPUP_MARGIN) {
        left = anchorX - formRect.width;
    } else {
        left = Math.max(POPUP_MARGIN, viewportWidth - formRect.width - POPUP_MARGIN);
    }

    return { left, top };
};
