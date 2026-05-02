/**
 * Feature detection for the platform-native overlay primitives.
 *
 * Popover API: top-layer placement, browser-controlled focus / dismiss.
 * Supported in Chrome 114+, Safari 17+, Firefox 125+ as of writing.
 *
 * CSS Anchor Positioning: lets the popover position itself relative to a
 * named anchor without JS bookkeeping. Currently behind a flag in Safari and
 * Firefox; only Chromium ships it stable. We feature-detect so we can fall
 * back to Floating UI on browsers that don't have it yet.
 */

const detectPopoverSupport = (): boolean => {
    if (typeof HTMLElement === "undefined") {
        return false;
    }

    // popover attribute support also implies showPopover/hidePopover prototypes
    return "showPopover" in HTMLElement.prototype && "popover" in HTMLElement.prototype;
};

const detectAnchorSupport = (): boolean => {
    if (typeof CSS === "undefined" || !CSS.supports) {
        return false;
    }

    return CSS.supports("anchor-name: --x") && CSS.supports("position-anchor: --x");
};

export const SUPPORTS_POPOVER = detectPopoverSupport();
export const SUPPORTS_CSS_ANCHOR = detectAnchorSupport();
