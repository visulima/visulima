/* eslint-disable no-secrets/no-secrets */

import type { Properties as CSSProperties } from "csstype";
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
// eslint-disable-next-line import/no-extraneous-dependencies
import clockIcon from "lucide-static/icons/clock.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import chevronLeftIcon from "lucide-static/icons/chevron-left.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import chevronRightIcon from "lucide-static/icons/chevron-right.svg?data-uri&encoding=css";

import Editors from "../../../../shared/utils/editors";
import type { BalloonConfig, BalloonPosition } from "../types";
import styleCss from "./client/index.css";
import FlameErrorOverlay from "./client/runtime.js?raw";

const AUTO_DETECT_EDITOR_OPTION = "<option value=\"\">Auto-detected Editor</option>";
const VITE_CLIENT_CLASS = "class ErrorOverlay";
const VITE_ERROR_OVERLAY_CLASS = "var ErrorOverlay = ";
const WINDOW_ERROR_OVERLAY_GLOBAL = "window.ErrorOverlay = ErrorOverlay;";

/**
 * Generates editor selector options from available editors
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

const notchTailLeft = `<svg width="60" height="42" viewBox="0 0 60 42" fill="none" xmlns="http://www.w3.org/2000/svg" class="error-overlay-notch-tail absolute top-[calc(var(--ono-v-dialog-border-width)*-1)] -z-1 h-[calc(100%+var(--ono-v-dialog-border-width))] right-[-54px] pointer-events-none" preserveAspectRatio="none">
    <mask id="error_overlay_nav_mask0_2667_14687" maskUnits="userSpaceOnUse" x="0" y="-1" width="60" height="43" style="mask-type: alpha;">
        <mask id="error_overlay_nav_path_1_outside_1_2667_14687" maskUnits="userSpaceOnUse" x="0" y="-1" width="60" height="43" fill="black">
        <rect fill="white" y="-1" width="60" height="43"></rect>
        <path d="M1 0L8.0783 0C15.772 0 22.7836 4.41324 26.111 11.3501L34.8889 29.6498C38.2164 36.5868 45.228 41 52.9217 41H60H1L1 0Z"></path>
        </mask>
        <path d="M1 0L8.0783 0C15.772 0 22.7836 4.41324 26.111 11.3501L34.8889 29.6498C38.2164 36.5868 45.228 41 52.9217 41H60H1L1 0Z" fill="white"></path>
        <path d="M1 0V-1H0V0L1 0ZM1 41H0V42H1V41ZM34.8889 29.6498L33.9873 30.0823L34.8889 29.6498ZM26.111 11.3501L27.0127 10.9177L26.111 11.3501ZM1 1H8.0783V-1H1V1ZM60 40H1V42H60V40ZM2 41V0L0 0L0 41H2ZM25.2094 11.7826L33.9873 30.0823L35.7906 29.2174L27.0127 10.9177L25.2094 11.7826ZM52.9217 42H60V40H52.9217V42ZM33.9873 30.0823C37.4811 37.3661 44.8433 42 52.9217 42V40C45.6127 40 38.9517 35.8074 35.7906 29.2174L33.9873 30.0823ZM8.0783 1C15.3873 1 22.0483 5.19257 25.2094 11.7826L27.0127 10.9177C23.5188 3.6339 16.1567 -1 8.0783 -1V1Z" fill="black" mask="url(#error_overlay_nav_path_1_outside_1_2667_14687)"></path>
    </mask>
    <g mask="url(#error_overlay_nav_mask0_2667_14687)">
        <mask id="error_overlay_nav_path_3_outside_2_2667_14687" maskUnits="userSpaceOnUse" x="-1" y="0.0244141" width="60" height="43" fill="black">
        <rect fill="white" x="-1" y="0.0244141" width="60" height="43"></rect>
        <path d="M0 1.02441H7.0783C14.772 1.02441 21.7836 5.43765 25.111 12.3746L33.8889 30.6743C37.2164 37.6112 44.228 42.0244 51.9217 42.0244H59H0L0 1.02441Z"></path>
        </mask>
        <path d="M0 1.02441H7.0783C14.772 1.02441 21.7836 5.43765 25.111 12.3746L33.8889 30.6743C37.2164 37.6112 44.228 42.0244 51.9217 42.0244H59H0L0 1.02441Z" fill="var(--background-color)"></path>
        <path d="M0 1.02441L0 0.0244141H-1V1.02441H0ZM0 42.0244H-1V43.0244H0L0 42.0244ZM33.8889 30.6743L32.9873 31.1068L33.8889 30.6743ZM25.111 12.3746L26.0127 11.9421L25.111 12.3746ZM0 2.02441H7.0783V0.0244141H0L0 2.02441ZM59 41.0244H0L0 43.0244H59V41.0244ZM1 42.0244L1 1.02441H-1L-1 42.0244H1ZM24.2094 12.8071L32.9873 31.1068L34.7906 30.2418L26.0127 11.9421L24.2094 12.8071ZM51.9217 43.0244H59V41.0244H51.9217V43.0244ZM32.9873 31.1068C36.4811 38.3905 43.8433 43.0244 51.9217 43.0244V41.0244C44.6127 41.0244 37.9517 36.8318 34.7906 30.2418L32.9873 31.1068ZM7.0783 2.02441C14.3873 2.02441 21.0483 6.21699 24.2094 12.8071L26.0127 11.9421C22.5188 4.65831 15.1567 0.0244141 7.0783 0.0244141V2.02441Z" fill="var(--stroke-color)" mask="url(#error_overlay_nav_path_3_outside_2_2667_14687)"></path>
    </g>
</svg>`;

const notchTailRight = `<svg width="60" height="42" viewBox="0 0 60 42" fill="none" xmlns="http://www.w3.org/2000/svg" class="error-overlay-notch-tail absolute top-[calc(var(--ono-v-dialog-border-width)*-1)] -z-1 h-[calc(100%+var(--ono-v-dialog-border-width))] left-[-54px] pointer-events-none [transform:rotateY(180deg)]" preserveAspectRatio="none">
    <mask id="error_overlay_nav_mask0_2667_14687" maskUnits="userSpaceOnUse" x="0" y="-1" width="60" height="43" style="mask-type: alpha;">
        <mask id="error_overlay_nav_path_1_outside_1_2667_14687" maskUnits="userSpaceOnUse" x="0" y="-1" width="60" height="43" fill="black">
        <rect fill="white" y="-1" width="60" height="43"></rect>
        <path d="M1 0L8.0783 0C15.772 0 22.7836 4.41324 26.111 11.3501L34.8889 29.6498C38.2164 36.5868 45.228 41 52.9217 41H60H1L1 0Z"></path>
        </mask>
        <path d="M1 0L8.0783 0C15.772 0 22.7836 4.41324 26.111 11.3501L34.8889 29.6498C38.2164 36.5868 45.228 41 52.9217 41H60H1L1 0Z" fill="white"></path>
        <path d="M1 0V-1H0V0L1 0ZM1 41H0V42H1V41ZM34.8889 29.6498L33.9873 30.0823L34.8889 29.6498ZM26.111 11.3501L27.0127 10.9177L26.111 11.3501ZM1 1H8.0783V-1H1V1ZM60 40H1V42H60V40ZM2 41V0L0 0L0 41H2ZM25.2094 11.7826L33.9873 30.0823L35.7906 29.2174L27.0127 10.9177L25.2094 11.7826ZM52.9217 42H60V40H52.9217V42ZM33.9873 30.0823C37.4811 37.3661 44.8433 42 52.9217 42V40C45.6127 40 38.9517 35.8074 35.7906 29.2174L33.9873 30.0823ZM8.0783 1C15.3873 1 22.0483 5.19257 25.2094 11.7826L27.0127 10.9177C23.5188 3.6339 16.1567 -1 8.0783 -1V1Z" fill="black" mask="url(#error_overlay_nav_path_1_outside_1_2667_14687)"></path>
    </mask>
    <g mask="url(#error_overlay_nav_mask0_2667_14687)">
        <mask id="error_overlay_nav_path_3_outside_2_2667_14687" maskUnits="userSpaceOnUse" x="-1" y="0.0244141" width="60" height="43" fill="black">
        <rect fill="white" x="-1" y="0.0244141" width="60" height="43"></rect>
        <path d="M0 1.02441H7.0783C14.772 1.02441 21.7836 5.43765 25.111 12.3746L33.8889 30.6743C37.2164 37.6112 44.228 42.0244 51.9217 42.0244H59H0L0 1.02441Z"></path>
        </mask>
        <path d="M0 1.02441H7.0783C14.772 1.02441 21.7836 5.43765 25.111 12.3746L33.8889 30.6743C37.2164 37.6112 44.228 42.0244 51.9217 42.0244H59H0L0 1.02441Z" fill="var(--background-color)"></path>
        <path d="M0 1.02441L0 0.0244141H-1V1.02441H0ZM0 42.0244H-1V43.0244H0L0 42.0244ZM33.8889 30.6743L32.9873 31.1068L33.8889 30.6743ZM25.111 12.3746L26.0127 11.9421L25.111 12.3746ZM0 2.02441H7.0783V0.0244141H0L0 2.02441ZM59 41.0244H0L0 43.0244H59V41.0244ZM1 42.0244L1 1.02441H-1L-1 42.0244H1ZM24.2094 12.8071L32.9873 31.1068L34.7906 30.2418L26.0127 11.9421L24.2094 12.8071ZM51.9217 43.0244H59V41.0244H51.9217V43.0244ZM32.9873 31.1068C36.4811 38.3905 43.8433 43.0244 51.9217 43.0244V41.0244C44.6127 41.0244 37.9517 36.8318 34.7906 30.2418L32.9873 31.1068ZM7.0783 2.02441C14.3873 2.02441 21.0483 6.21699 24.2094 12.8071L26.0127 11.9421C22.5188 4.65831 15.1567 0.0244141 7.0783 0.0244141V2.02441Z" fill="var(--stroke-color)" mask="url(#error_overlay_nav_path_3_outside_2_2667_14687)"></path>
    </g>
</svg>`;

const rootElement = (
    rootId: string,
    editorOptions: string,
    hideRightNavigation: boolean = false,
) => `<div id="${rootId}" class="fixed inset-0 z-[2147483647] flex flex-col items-center pt-[10vh] px-[15px] shadow-[--ono-v-elevation-2] hidden">
    <div id="__v_o__backdrop" class="fixed inset-0 -z-1 bg-black/60 backdrop-blur-sm md:backdrop-blur pointer-events-auto"></div>
    <div id="__v_o__notch" class="relative z-2 flex w-full max-w-(--ono-v-dialog-max-width) items-end justify-between outline-none translate-x-(--ono-v-dialog-border-width) translate-y-(--ono-v-dialog-border-width)" style="--stroke-color: var(--ono-v-border); --background-color: var(--ono-v-surface);">
        <div class="error-overlay-notch relative text-(--ono-v-text) translate-x-[calc(var(--ono-v-dialog-border-width)*-1)] h-(--ono-v-dialog-notch-height) p-3 pr-0 bg-(--background-color) border border-(--stroke-color) border-b-0 rounded-tl-(--ono-v-dialog-radius)" data-side="left">
            <nav class="error-overlay-pagination dialog-exclude-closing-from-outside-click flex justify-center items-center gap-2 w-fit">
            <button id="__v_o__error-overlay-pagination-previous" type="button" aria-disabled="true" class="error-overlay-pagination-button flex justify-center items-center w-6 h-6 bg-(--ono-v-chip-bg) rounded-full disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-(--ono-v-red-orange) hover:bg-(--ono-v-hover-overlay) transition-colors" disabled>
                <span class="dui size-4" style="-webkit-mask-image: url('${chevronLeftIcon}'); mask-image: url('${chevronLeftIcon}')" aria-label="previous"></span>
            </button>
            <div id="__v_o__error-overlay_pagination_count" class="inline-flex justify-center items-center min-w-8 h-5 gap-1 text-(--ono-v-text) text-center text-[11px] font-medium leading-4 rounded-full px-1.5">
                <span id="__v_o__pagination_current">1</span>
                <span class="text-(--ono-v-text-muted)">/</span>
                <span id="__v_o__pagination_total">1</span>
            </div>
            <button type="button" id="__v_o__error-overlay-pagination-next" aria-disabled="true" class="error-overlay-pagination-button flex justify-center items-center w-6 h-6 bg-(--ono-v-chip-bg) rounded-full disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-(--ono-v-red-orange) hover:bg-(--ono-v-hover-overlay) transition-colors" disabled>
                <span class="dui size-4" style="-webkit-mask-image: url('${chevronRightIcon}'); mask-image: url('${chevronRightIcon}')" aria-label="next"></span>
            </button>
            <div class="flex items-center gap-1">
                <button type="button" id="__v_o__history_toggle" title="Toggle Error History" aria-label="Toggle Error History" class="error-overlay-history-button flex justify-center items-center w-6 h-6 bg-(--ono-v-chip-bg) rounded-full hover:bg-(--ono-v-hover-overlay) focus-visible:outline focus-visible:outline-(--ono-v-red-orange) transition-colors">
                    <span class="dui size-4" style="-webkit-mask-image: url('${clockIcon}'); mask-image: url('${clockIcon}')"></span>
                </button>
                <div id="__v_o__history_indicator" class="flex items-center gap-1 text-xs text-(--ono-v-text-muted) hidden">
                    <span id="__v_o__history_count">0</span>
                    <span>/</span>
                    <span id="__v_o__history_total">0</span>
                    <span class="text-[10px]">scroll to navigate</span>
                </div>
            </div>
            </nav>
            ${notchTailLeft}
        </div>
        <div class="grow flex justify-center items-end">
            <div id="__v_o__history_timestamp" class="bg-(--ono-v-surface) text-sm text-(--ono-v-text-muted) flex items-end justify-center relative w-42 border-t border-(--stroke-color) hidden">
                ${notchTailRight}
                <span></span>
                ${notchTailLeft}
            </div>
        </div>
        <div class="error-overlay-notch flex gap-1 relative translate-x-[calc(var(--ono-v-dialog-border-width)*-1)] h-(--ono-v-dialog-notch-height) p-3 pl-0 bg-(--background-color) border border-(--stroke-color) border-b-0 rounded-tr-(--ono-v-dialog-radius)" data-side="right">
            ${
                hideRightNavigation
                    ? ""
                    : `<div id="__v_o__editor" class="hidden sm:flex items-center gap-1">
                <label for="editor-selector" class="sr-only">Editor</label>
                <select id="editor-selector" class="py-1 cursor-pointer px-2 pe-6 block w-44 bg-(--ono-v-surface) border border-(--ono-v-border) rounded-(--ono-v-radius-md) text-xs text-(--ono-v-text) shadow-(--ono-v-elevation-1) hover:bg-(--ono-v-hover-overlay) focus:outline-hidden focus:ring-1 focus:ring-(--ono-v-red-orange)">${editorOptions}</select>
            </div>

            <div id="v-o-theme-switch" class="flex items-center gap-1">
                <button type="button" title="Switch to dark mode" aria-label="Switch to dark mode" class="font-medium rounded-full hover:bg-(--ono-v-hover-overlay) focus:outline-hidden focus:bg-(--ono-v-hover-overlay) text-(--ono-v-text)" data-v-o-theme-click-value="dark">
                    <span class="inline-flex shrink-0 justify-center items-center size-8">
                        <span class="dui size-5" style="-webkit-mask-image: url('${moonStarIcon}'); mask-image: url('${moonStarIcon}')"></span>
                    </span>
                </button>
                <button type="button" title="Switch to light mode" aria-label="Switch to light mode" class="hidden font-medium rounded-full hover:bg-(--ono-v-hover-overlay) focus:outline-hidden focus:bg-(--ono-v-hover-overlay) text-(--ono-v-text)" data-v-o-theme-click-value="light">
                    <span class="inline-flex shrink-0 justify-center items-center size-8">
                        <span class="dui size-5" style="-webkit-mask-image: url('${sunIcon}'); mask-image: url('${sunIcon}')"></span>
                    </span>
                </button>
            </div>

            <div class="flex items-center">
                <button type="button" id="__v_o__close" aria-label="Close error overlay" class="font-medium rounded-full hover:bg-(--ono-v-hover-overlay) focus:outline-hidden focus:bg-(--ono-v-hover-overlay) text-(--ono-v-text)">
                    <span class="inline-flex shrink-0 justify-center items-center size-8">
                        <span class="dui size-5" style="-webkit-mask-image: url('${closeIcon}'); mask-image: url('${closeIcon}')"></span>
                    </span>
                </button>
            </div>`
            }
            ${notchTailRight}
        </div>
    </div>

    <div id="__v_o__panel" role="dialog" aria-modal="true" aria-label="Runtime Error Overlay" class="relative z-10 flex w-full max-w-(--ono-v-dialog-max-width) max-h-[calc(100%-56px)] scale-100 opacity-100 flex-col overflow-hidden rounded-b-(--ono-v-dialog-radius) bg-(--ono-v-surface) text-(--ono-v-text) shadow-(--ono-v-elevation-1) border-b border-(--ono-v-border) ">
        <div id="__v_o__header" class="flex items-center gap-1 justify-between border-b border-(--ono-v-border) bg-(--ono-v-surface) px-4 py-2">
            <div id="__v_o__header_loader" class="v-o-skeleton h-6 w-3/5 rounded animate-pulse"></div>
            <div id="__v_o__title" class="flex items-center gap-2 w-full font-bold text-(--ono-v-text) hidden">
                <span id="__v_o__heading" class="leading-none rounded-md text-(--ono-v-red-orange) font-mono text-sm"></span>
                <button type="button" id="__v_o__filelink" class="ml-2 text-xs font-normal font-mono underline text-(--ono-v-text-muted) hover:text-(--ono-v-text) bg-transparent border-none cursor-pointer"></button>
            </div>
            <div id="__v_o__mode" class="sm:flex items-center gap-1">
                <button type="button" data-flame-mode="original" class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-(--ono-v-text) bg-(--ono-v-chip-bg) rounded-full hover:bg-(--ono-v-hover-overlay) focus:outline-hidden focus:bg-(--ono-v-hover-overlay)" style="display:none">Original</button>
                <button type="button" data-flame-mode="compiled" class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-(--ono-v-text) bg-(--ono-v-chip-bg) rounded-full hover:bg-(--ono-v-hover-overlay) focus:outline-hidden focus:bg-(--ono-v-hover-overlay)" style="display:none">Compiled</button>
            </div>
            <button type="button" id="__v_o__copy_error" title="Copy Error Info" aria-label="Copy Error Info" class="font-medium rounded-full hover:bg-(--ono-v-hover-overlay) focus:outline-hidden focus:bg-(--ono-v-hover-overlay) text-(--ono-v-text)">
                <span class="inline-flex shrink-0 justify-center items-center size-8">
                    <span class="dui size-5" style="-webkit-mask-image: url('${copyIcon}'); mask-image: url('${copyIcon}')"></span>
                </span>
            </button>
        </div>

        <div id="__v_o__message_loader" class="px-4 py-2 bg-(--ono-v-surface-muted) border-b border-(--ono-v-border)">
            <div class="v-o-skeleton h-4 w-full rounded animate-pulse"></div>
        </div>
        <div id="__v_o__message" class="px-4 py-2 text-sm text-(--ono-v-red-orange) font-mono bg-(--ono-v-surface-muted) border-b border-(--ono-v-border) font-medium hidden"></div>
        <div id="__v_o__solutions" class="relative hidden">
            <div title="Possible Solution" class="bg-[#b0c8aa] dark:bg-lime-800 rounded-(--ono-v-radius-md) absolute top-4 right-6 z-10 size-6.5 flex items-center justify-center shadow-(--ono-v-elevation-1)">
                <span class="dui size-5" style="-webkit-mask-image: url('${infoIcon}'); mask-image: url('${infoIcon}')"></span>
            </div>
            <div id="__v_o__solutions_container" class="max-h-50 overflow-y-auto px-4 py-2 bg-(--ono-v-success-bg) m-1 mb-0 prose prose-sm max-w-full prose-headings:text-white prose-ul:list-none prose-hr:my-6 prose-hr:border dark:prose-invert"></div>
        </div>
        <div id="__v_o__body" class="relative flex min-h-0 mx-1 py-2 bg-(--ono-v-surface)">
            <div id="__v_o__body_loader" class="w-full space-y-1.5">
                <div class="v-o-skeleton h-4 w-full rounded animate-pulse"></div>
                <div class="v-o-skeleton h-4 w-3/4 rounded animate-pulse"></div>
                <div class="v-o-skeleton h-4 w-1/2 rounded animate-pulse"></div>
                <div class="v-o-skeleton h-4 w-2/3 rounded animate-pulse"></div>
                <div class="v-o-skeleton h-4 w-4/5 rounded animate-pulse"></div>
                <div class="v-o-skeleton h-4 w-1/3 rounded animate-pulse"></div>
                <div class="v-o-skeleton h-4 w-2/5 rounded animate-pulse"></div>
                <div class="v-o-skeleton h-4 w-3/5 rounded animate-pulse"></div>
            </div>
            <div id="__v_o__overlay" class="overflow-auto w-full hidden"></div>
        </div>
    </div>

    <details id="__v_o__stacktrace" class="relative -mt-5 pt-5 w-full max-w-(--ono-v-dialog-max-width) rounded-b-(--ono-v-dialog-radius) bg-(--ono-v-surface-muted) shadow-(--ono-v-elevation-2)">
        <summary class="cursor-pointer px-4 py-3 text-xs font-mono text-(--ono-v-text-muted) hover:text-(--ono-v-text) transition-colors duration-200 list-none flex items-center gap-2 font-medium">
            <span class="dui w-4 h-4" style="-webkit-mask-image: url('${chevronRightIcon}'); mask-image: url('${chevronRightIcon}')"></span>
            Raw stack trace
        </summary>
        <div class="px-4 py-3 text-(--ono-v-text) text-xs rounded-b-(--ono-v-dialog-radius) font-mono leading-5 overflow-auto space-y-0.5 max-h-[140px] bg-(--ono-v-surface) border-t border-(--ono-v-border)"></div>
    </details>
    <div id="__v_o__history_layer_depth" class="relative flex items-center flex-col -z-1 w-full max-w-[calc(var(--ono-v-dialog-max-width)-24px)] h-10 opacity-0 transition-opacity duration-200 pointer-events-none">
        <div id="__v_o__history_layer_depth_1" class="relative w-full rounded-b-(--ono-v-dialog-radius) h-5 bg-(--ono-v-surface-muted) inset-shadow-(--ono-v-elevation-2) -mt-3 shadow-md"></div>
        <div id="__v_o__history_layer_depth_2" class="relative w-[calc(100%-24px)] rounded-b-(--ono-v-dialog-radius) h-5 bg-(--ono-v-surface-muted) inset-shadow-(--ono-v-elevation-2) -mt-3 -z-1"></div>
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
            const cssKey = key.replaceAll(/([A-Z])/g, "-$1").toLowerCase();

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
    const iconHtml = balloonConfig?.icon ? `<img src="${balloonConfig.icon}" alt="" class="w-4 h-4" />` : "";

    // Build the button HTML with optional icon
    const buttonContent = iconHtml
        ? `${iconHtml}\n    <span id="__v_o__balloon_count" class="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-white/20 text-white font-bold">0</span>\n    <span id="__v_o__balloon_text">Errors</span>`
        : `<span id="__v_o__balloon_count" class="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-white/20 text-white font-bold">0</span>\n    <span id="__v_o__balloon_text">Errors</span>`;

    return `<div id="__v_o__balloon_group" class="fixed z-2147483647 inline-flex items-center px-2.5 py-1.5 rounded-full bg-(--ono-v-red-orange) text-white font-sans text-xs leading-none shadow-lg cursor-pointer transition-all duration-200 hover:brightness-105" data-balloon-position="${position}" style="${customStyle} ${positionStyle}">
    <button type="button" id="__v_o__balloon" title="Toggle error overlay" aria-label="Toggle error overlay" class="w-full flex items-center gap-2">
        ${buttonContent}
    </button>
    <button type="button" id="__v_o__balloon_close" title="Dismiss balloon" aria-label="Dismiss balloon" class="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-white/20 transition-colors border">
        <span class="dui" style="-webkit-mask-image: url('${closeIcon}'); mask-image: url('${closeIcon}')"></span>
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

    return `<style>${styleCss}</style>
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
