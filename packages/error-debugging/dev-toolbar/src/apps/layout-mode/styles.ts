/**
 * Layout-mode animation keyframes that Tailwind v4 + tw-animate-css don't
 * express directly. Everything else uses Tailwind utilities applied inside the
 * overlay shadow root (which adopts the shared toolbar stylesheet).
 */

const STYLE_ID = "__vdt_layout_mode_keyframes";

const KEYFRAMES = `
@keyframes vdt-lm-placement-enter {
  from { opacity: 0; transform: scale(0.85); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes vdt-lm-section-enter {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes vdt-lm-overlay-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes vdt-lm-ghost-enter {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 0.6; transform: scale(1); }
}
@keyframes vdt-lm-badge-slide-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes vdt-lm-popup-in {
  from { opacity: 0; transform: translateX(-50%) scale(0.97); }
  to { opacity: 1; transform: translateX(-50%) scale(1); }
}
`;

let cachedSheet: CSSStyleSheet | undefined;

export const getLayoutModeKeyframesSheet = (): CSSStyleSheet | undefined => {
    if (globalThis.CSSStyleSheet === undefined) {
        return undefined;
    }

    if (!cachedSheet) {
        cachedSheet = new CSSStyleSheet();
        cachedSheet.replaceSync(KEYFRAMES);
    }

    return cachedSheet;
};

/** Fallback for environments without constructable stylesheets. */
export const ensureLayoutModeStyleTag = (): void => {
    if (typeof document === "undefined" || document.getElementById(STYLE_ID)) {
        return;
    }

    const style = document.createElement("style");

    style.id = STYLE_ID;
    style.textContent = KEYFRAMES;
    document.head.append(style);
};
