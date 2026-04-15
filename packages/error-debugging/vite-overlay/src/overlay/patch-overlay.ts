/* eslint-disable @typescript-eslint/no-unnecessary-type-conversion, no-secrets/no-secrets, @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/no-unnecessary-condition */
import type { Properties as CSSProperties } from "csstype";
// eslint-disable-next-line import/no-extraneous-dependencies
import chevronLeftIcon from "lucide-static/icons/chevron-left.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import chevronRightIcon from "lucide-static/icons/chevron-right.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import clockIcon from "lucide-static/icons/clock.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import copyIcon from "lucide-static/icons/copy.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import infoIcon from "lucide-static/icons/info.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import moonStarIcon from "lucide-static/icons/moon-star.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import sunIcon from "lucide-static/icons/sun.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import closeIcon from "lucide-static/icons/x.svg?data-uri&encoding=css";

import Editors from "../../../../../shared/utils/editors";
import type { BalloonConfig, BalloonPosition } from "../types";
import styleCss from "./client/index.css";
import FlameErrorOverlay from "./client/runtime.js?raw";

const CAMEL_CASE_UPPER_RE = /([A-Z])/g;

const AUTO_DETECT_EDITOR_OPTION = "<option value=\"\">Auto-detected Editor</option>";
const VITE_CLIENT_CLASS = "class ErrorOverlay";
const VITE_ERROR_OVERLAY_CLASS = "var ErrorOverlay = ";
const WINDOW_ERROR_OVERLAY_GLOBAL = "window.ErrorOverlay = ErrorOverlay;";

/**
 * Generates editor selector options from available editors.
 */
const generateEditorOptions = (): string => {
    try {
        const keys = Object.keys(Editors) as (keyof typeof Editors)[];
        const options = [AUTO_DETECT_EDITOR_OPTION, ...keys.map((k) => `<option value="${String(k)}">${String(Editors[k])}</option>`)];

        return options.join("");
    } catch {
        return AUTO_DETECT_EDITOR_OPTION;
    }
};

// rootElement generates the dev-toolbar-aligned panel HTML for the error overlay shadow root
const rootElement = (
    rootId: string,
    editorOptions: string,
    hideRightNavigation: boolean = false,
) => `<div id="${rootId}" class="fixed inset-0 z-[2147483646] flex flex-col items-center pt-[8vh] px-4 pb-4 hidden">
    <div id="__v_o__backdrop" class="fixed inset-0 -z-1 bg-black/65 pointer-events-auto"></div>
    <div class="relative z-1 w-full max-w-(--ono-v-dialog-max-width) mx-auto flex flex-col">

        <div id="__v_o__panel" role="dialog" aria-modal="true" aria-label="Runtime Error Overlay"
             class="w-full max-h-[80vh] flex flex-col bg-(--ono-v-surface) border border-(--ono-v-border) overflow-hidden">

            <!-- ── Header bar ── replaces old SVG notch tabs ─────────────────────── -->
            <div id="__v_o__notch"
                 class="dialog-exclude-closing-from-outside-click relative flex items-center gap-2 min-h-12 shrink-0 border-b border-(--ono-v-border) bg-(--ono-v-surface-muted)">

                <!-- Left: error dot · label · pagination -->
                <div class="flex items-center gap-2 px-3 flex-1 min-w-0">
                    <span class="size-1.5 rounded-full bg-(--ono-v-red-orange) shrink-0"></span>
                    <span class="v-o-label text-xs text-(--ono-v-text-muted) shrink-0 whitespace-nowrap">RUNTIME ERROR</span>

                    <nav class="error-overlay-pagination dialog-exclude-closing-from-outside-click flex items-center gap-1 ml-1">
                        <button id="__v_o__error-overlay-pagination-previous" type="button" aria-disabled="true"
                                class="error-overlay-pagination-button inline-flex items-center justify-center size-7 hover:bg-(--ono-v-hover-overlay) active:opacity-80 transition-opacity duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-1 focus-visible:outline-(--ono-v-text)" disabled>
                            <span class="dui size-4" style="-webkit-mask-image: url('${chevronLeftIcon}'); mask-image: url('${chevronLeftIcon}')" aria-label="previous"></span>
                        </button>
                        <div id="__v_o__error-overlay_pagination_count"
                             class="inline-flex justify-center items-center min-w-8 gap-1 text-(--ono-v-text-muted) text-center text-xs font-medium px-1">
                            <span id="__v_o__pagination_current">1</span>
                            <span>/</span>
                            <span id="__v_o__pagination_total">1</span>
                        </div>
                        <button id="__v_o__error-overlay-pagination-next" type="button" aria-disabled="true"
                                class="error-overlay-pagination-button inline-flex items-center justify-center size-7 hover:bg-(--ono-v-hover-overlay) active:opacity-80 transition-opacity duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-1 focus-visible:outline-(--ono-v-text)" disabled>
                            <span class="dui size-4" style="-webkit-mask-image: url('${chevronRightIcon}'); mask-image: url('${chevronRightIcon}')" aria-label="next"></span>
                        </button>
                        <button id="__v_o__history_toggle" type="button" title="Toggle Error History" aria-label="Toggle Error History"
                                class="error-overlay-history-button inline-flex items-center justify-center size-7 hover:bg-(--ono-v-hover-overlay) active:opacity-80 transition-opacity duration-150 focus-visible:outline-1 focus-visible:outline-(--ono-v-text)">
                            <span class="dui size-4" style="-webkit-mask-image: url('${clockIcon}'); mask-image: url('${clockIcon}')"></span>
                        </button>
                        <div id="__v_o__history_indicator" class="flex items-center gap-1 text-xs text-(--ono-v-text-muted) hidden">
                            <span id="__v_o__history_count">0</span>
                            <span>/</span>
                            <span id="__v_o__history_total">0</span>
                        </div>
                    </nav>
                </div>

                <!-- Center: history timestamp (absolutely centered) -->
                <div id="__v_o__history_timestamp"
                     class="absolute left-1/2 -translate-x-1/2 text-xs text-(--ono-v-text-muted) pointer-events-none hidden">
                    <span></span>
                </div>

                <!-- Right: editor select · theme · copy · close -->
                ${
                    hideRightNavigation
                        ? ""
                        : `<div class="flex items-center gap-0.5 pr-1 shrink-0">
                    <div id="__v_o__editor" class="hidden sm:flex items-center">
                        <label for="editor-selector" class="sr-only">Editor</label>
                        <select id="editor-selector"
                                class="py-1 cursor-pointer px-2 pe-6 w-44 bg-(--ono-v-surface) border border-(--ono-v-border) text-xs text-(--ono-v-text) hover:bg-(--ono-v-hover-overlay) focus:outline-hidden focus:ring-1 focus:ring-(--ono-v-primary)">${editorOptions}</select>
                    </div>
                    <div id="v-o-theme-switch" class="flex items-center">
                        <button type="button" title="Switch to dark mode" aria-label="Switch to dark mode"
                                class="hover:bg-(--ono-v-hover-overlay) active:opacity-80 transition-opacity duration-150 text-(--ono-v-text)" data-v-o-theme-click-value="dark">
                            <span class="inline-flex items-center justify-center size-8">
                                <span class="dui size-4" style="-webkit-mask-image: url('${moonStarIcon}'); mask-image: url('${moonStarIcon}')"></span>
                            </span>
                        </button>
                        <button type="button" title="Switch to light mode" aria-label="Switch to light mode"
                                class="hidden hover:bg-(--ono-v-hover-overlay) active:opacity-80 transition-opacity duration-150 text-(--ono-v-text)" data-v-o-theme-click-value="light">
                            <span class="inline-flex items-center justify-center size-8">
                                <span class="dui size-4" style="-webkit-mask-image: url('${sunIcon}'); mask-image: url('${sunIcon}')"></span>
                            </span>
                        </button>
                    </div>
                    <button type="button" id="__v_o__copy_error" title="Copy Error Info" aria-label="Copy Error Info"
                            class="inline-flex items-center justify-center size-8 hover:bg-(--ono-v-hover-overlay) active:opacity-80 transition-opacity duration-150 text-(--ono-v-text)">
                        <span class="dui size-4" style="-webkit-mask-image: url('${copyIcon}'); mask-image: url('${copyIcon}')"></span>
                    </button>
                    <button type="button" id="__v_o__close" aria-label="Close error overlay"
                            class="inline-flex items-center justify-center size-8 hover:bg-(--ono-v-hover-overlay) active:opacity-80 transition-opacity duration-150 text-(--ono-v-text)">
                        <span class="dui size-4" style="-webkit-mask-image: url('${closeIcon}'); mask-image: url('${closeIcon}')"></span>
                    </button>
                </div>`
                }
            </div>

            <!-- ── File / error title ──────────────────────────────────────────────── -->
            <div id="__v_o__header" class="flex items-center gap-2 justify-between border-b border-(--ono-v-border) bg-(--ono-v-surface) px-4 py-2 min-h-10">
                <div id="__v_o__header_loader"><span class="v-o-loading-text">[LOADING...]</span></div>
                <div id="__v_o__title" class="flex items-center gap-2 w-full hidden">
                    <span id="__v_o__heading" class="leading-none text-(--ono-v-red-orange) font-mono text-sm font-semibold"></span>
                    <button type="button" id="__v_o__filelink"
                            class="ml-1 text-xs font-normal font-mono underline text-(--ono-v-text-muted) hover:text-(--ono-v-text) bg-transparent border-none cursor-pointer transition-colors"></button>
                </div>
                <div id="__v_o__mode" class="flex items-center gap-1 shrink-0">
                    <button type="button" data-flame-mode="original"
                            class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-(--ono-v-text) bg-(--ono-v-chip-bg) hover:bg-(--ono-v-hover-overlay) focus:outline-hidden" style="display:none">Original</button>
                    <button type="button" data-flame-mode="compiled"
                            class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-(--ono-v-text) bg-(--ono-v-chip-bg) hover:bg-(--ono-v-hover-overlay) focus:outline-hidden" style="display:none">Compiled</button>
                </div>
            </div>

            <!-- ── Scrollable content ─────────────────────────────────────────────── -->
            <div class="flex-1 min-h-0 overflow-y-auto devtools-content-scroll">
                <div id="__v_o__message_loader" class="px-4 py-2 bg-(--ono-v-surface-muted) border-b border-(--ono-v-border)">
                    <span class="v-o-loading-text">[LOADING...]</span>
                </div>
                <!-- CRITICAL: class selector used by runtime.js querySelector — do not change -->
                <div id="__v_o__message" class="px-4 py-2 text-sm text-[var(--ono-v-red-orange)] font-mono bg-[var(--ono-v-surface-muted)] border-b border-(--ono-v-border) font-medium hidden"></div>

                <div id="__v_o__solutions" class="relative hidden">
                    <div title="Possible Solution" class="absolute top-4 right-6 z-10 size-6 flex items-center justify-center" style="background-color: var(--ono-v-success);">
                        <span class="dui size-4" style="-webkit-mask-image: url('${infoIcon}'); mask-image: url('${infoIcon}')"></span>
                    </div>
                    <div id="__v_o__solutions_container" class="max-h-50 overflow-y-auto px-4 py-2 bg-(--ono-v-success-bg) m-1 mb-0 prose prose-sm max-w-full dark:prose-invert"></div>
                </div>

                <div id="__v_o__body" class="relative flex min-h-0 bg-(--ono-v-surface)">
                    <div id="__v_o__body_loader" class="w-full p-4">
                        <span class="v-o-loading-text">[LOADING...]</span>
                    </div>
                    <div id="__v_o__overlay" class="overflow-auto w-full hidden"></div>
                </div>
            </div>

            <!-- ── Stack trace footer (collapsible) ──────────────────────────────── -->
            <details id="__v_o__stacktrace" class="shrink-0 border-t border-(--ono-v-border) bg-(--ono-v-surface-muted)">
                <summary class="cursor-pointer px-4 py-3 list-none flex items-center gap-2 v-o-label text-xs text-(--ono-v-text-muted) hover:text-(--ono-v-text) transition-colors duration-150">
                    <span class="dui size-3" style="-webkit-mask-image: url('${chevronRightIcon}'); mask-image: url('${chevronRightIcon}')"></span>
                    STACK TRACE
                </summary>
                <!-- CRITICAL: class selector used by runtime.js querySelector — do not change -->
                <div class="px-4 py-3 text-xs font-mono text-[var(--ono-v-text-muted)] whitespace-pre-wrap leading-5 overflow-auto max-h-[160px] bg-(--ono-v-surface) border-t border-(--ono-v-border)"></div>
            </details>
        </div>

        <!-- ── History depth visual layers ───────────────────────────────────────── -->
        <div id="__v_o__history_layer_depth"
             class="relative flex items-center flex-col -z-1 w-[calc(100%-24px)] mx-auto h-10 opacity-0 transition-opacity duration-200 pointer-events-none">
            <div id="__v_o__history_layer_depth_1" class="relative w-full h-5 bg-(--ono-v-surface-muted) border border-(--ono-v-border) border-t-0 -mt-3"></div>
            <div id="__v_o__history_layer_depth_2" class="relative w-[calc(100%-24px)] h-5 bg-(--ono-v-surface-muted) border border-(--ono-v-border) border-t-0 -mt-3 -z-1"></div>
        </div>
    </div>
</div>`;

/**
 * Gets the default position styles for a balloon position.
 */
const getPositionStyles = (position: BalloonPosition = "bottom-right"): string => {
    const positions: Record<BalloonPosition, string> = {
        "bottom-left": "bottom: 8px; left: 8px;",
        "bottom-right": "bottom: 8px; right: 8px;",
        "top-left": "top: 8px; left: 8px;",
        "top-right": "top: 8px; right: 8px;",
    };

    return positions[position];
};

/**
 * Converts CSS.Properties object to CSS string.
 */
const cssPropertiesToString = (properties: CSSProperties): string => {
    const styles: string[] = [];

    Object.entries(properties).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            // Convert camelCase to kebab-case for CSS properties
            const cssKey = key.replaceAll(CAMEL_CASE_UPPER_RE, "-$1").toLowerCase();

            styles.push(`${cssKey}: ${String(value)};`);
        }
    });

    return styles.join(" ");
};

/**
 * Generates inline styles from balloon style configuration.
 * Supports both string and CSS.Properties object.
 */
const generateStyles = (style?: BalloonConfig["style"]): string => {
    if (!style) {
        return "";
    }

    // If it's already a string, return it as-is
    if (typeof style === "string") {
        return style;
    }

    // Convert CSS.Properties object to string
    return cssPropertiesToString(style);
};

/**
 * Generates the balloon button HTML with custom configuration.
 */
const generateBalloonButton = (balloonConfig?: BalloonConfig): string => {
    if (balloonConfig?.enabled === false) {
        return "";
    }

    const position = balloonConfig?.position || "bottom-right";
    const customStyle = generateStyles(balloonConfig?.style);
    const positionStyle = position ? getPositionStyles(position) : getPositionStyles("bottom-right");
    const iconHtml = balloonConfig?.icon ? `<img src="${balloonConfig.icon}" alt="" class="size-4" />` : "";

    return `<div id="__v_o__balloon_group" class="fixed z-2147483646 inline-flex" data-balloon-position="${position}" style="${customStyle} ${positionStyle}">
    <!-- Toggle button: count + label -->
    <button type="button" id="__v_o__balloon" title="Toggle error overlay" aria-label="Toggle error overlay"
            class="flex items-center gap-1.5 px-3 py-2 text-white cursor-pointer hover:opacity-90 active:opacity-80 transition-opacity duration-150" style="background: var(--ono-v-red-orange);">
        ${iconHtml ? `<img src="${iconHtml}" alt="" class="size-3.5 opacity-90 shrink-0" />` : ""}
        <span id="__v_o__balloon_count" style="--num: 0"></span>
        <span id="__v_o__balloon_text" class="v-o-label text-xs leading-none" style="color: rgba(255,255,255,0.7)">ERRORS</span>
    </button>
    <!-- Dismiss button -->
    <button type="button" id="__v_o__balloon_close" title="Dismiss balloon" aria-label="Dismiss balloon"
            class="flex items-center justify-center w-7 shrink-0 text-white cursor-pointer hover:opacity-90 active:opacity-80 transition-opacity duration-150" style="background: var(--ono-v-red-orange); border-left: 1px solid rgba(255,255,255,0.15);">
        <span class="dui size-3" style="-webkit-mask-image: url('${closeIcon}'); mask-image: url('${closeIcon}')"></span>
    </button>
</div>`;
};

/**
 * Converts customCSS to CSS string.
 * Supports both string and CSS.Properties object.
 */
const customCSSToString = (customCSS?: string | CSSProperties): string => {
    if (!customCSS) {
        return "";
    }

    // If it's already a string, return it as-is
    if (typeof customCSS === "string") {
        return customCSS;
    }

    // Convert CSS.Properties object to string
    return cssPropertiesToString(customCSS);
};

/**
 * Generates the overlay template with dynamic editor options.
 */
const generateOverlayTemplate = (showBalloonButton: boolean, balloonConfig?: BalloonConfig, customCSS?: string | CSSProperties): string => {
    const editorOptions = generateEditorOptions();
    const cssString = customCSSToString(customCSS);
    const customStyleTag = cssString ? `<style>${cssString}</style>` : "";

    return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>${styleCss}</style>
${customStyleTag}
${rootElement("__v_o__root", editorOptions)}

${showBalloonButton ? generateBalloonButton(balloonConfig) : ""}`;
};

/**
 * Patches Vite's client code to replace the default error overlay with our custom overlay.
 * @param code The Vite client code to patch
 * @param showBalloonButton Whether to show the balloon button
 * @param balloonConfig Optional balloon configuration
 * @param customCSS Optional custom CSS to inject into the overlay (string or CSSProperties)
 */
export const patchOverlay = (code: string, showBalloonButton: boolean, balloonConfig?: BalloonConfig, customCSS?: string | CSSProperties): string => {
    const overlayTemplate = generateOverlayTemplate(showBalloonButton, balloonConfig, customCSS);

    const templateString = `const overlayTemplate = ${JSON.stringify(overlayTemplate)};`;

    let patched = code.replace(VITE_CLIENT_CLASS, `${templateString}\n${FlameErrorOverlay}\nclass ViteErrorOverlay`);

    patched = patched.replace(VITE_ERROR_OVERLAY_CLASS, `${templateString}\n${FlameErrorOverlay}\nvar ViteErrorOverlay = `);

    patched = `${patched}\n\n${WINDOW_ERROR_OVERLAY_GLOBAL};`;

    return patched;
};

export default patchOverlay;
