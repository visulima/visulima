import styleCss from "./client/index.css";
import FlameErrorOverlay from "./client/runtime.js?raw";

// eslint-disable-next-line import/no-extraneous-dependencies
import moonStarIcon from "lucide-static/icons/moon-star.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import sunIcon from "lucide-static/icons/sun.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import infoIcon from "lucide-static/icons/info.svg?data-uri&encoding=css";
import Editors from "../../../../shared/utils/editors";

const editorOptions = (() => {
    try {
        const keys = Object.keys(Editors) as Array<keyof typeof Editors>;
        const opts = ['<option value="">Auto-detected Editor</option>']
            .concat(keys.map((k) => `<option value="${String(k)}">${String(Editors[k])}</option>`));
        return opts.join("");
    } catch {
        return '<option value="">Auto-detected Editor</option>';
    }
})();

const overlayTemplate = `<style>${styleCss}</style>
<div id="__flame__root" class="fixed inset-0 z-0 flex flex-col items-center pt-[10vh] px-[15px]">
    <div id="__flame__backdrop" class="fixed inset-0 -z-1 bg-black/60 backdrop-blur-sm md:backdrop-blur pointer-events-auto"></div>
    <div id="__flame__notch" class="relative z-[2] flex w-full max-w-[var(--flame-dialog-max-width)] items-center justify-between outline-none translate-x-[var(--flame-dialog-border-width)] translate-y-[var(--flame-dialog-border-width)]" style="--stroke-color: var(--flame-border); --background-color: var(--flame-surface);">
        <div class="error-overlay-notch relative translate-x-[calc(var(--flame-dialog-border-width)*-1)] h-[var(--flame-dialog-notch-height)] p-3 pr-0 bg-[var(--background-color)] border border-[var(--stroke-color)] border-b-0 rounded-tl-[var(--flame-dialog-radius)]" data-side="left">
            <nav class="error-overlay-pagination dialog-exclude-closing-from-outside-click flex justify-center items-center gap-2 w-fit">
            <button type="button" aria-disabled="true" data-flame-dialog-error-previous="true" class="error-overlay-pagination-button flex justify-center items-center w-6 h-6 bg-[var(--flame-chip-bg)] rounded-full disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-[var(--flame-red-orange)] hover:bg-[var(--flame-hover-overlay)] transition-colors" disabled>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="previous" class="error-overlay-pagination-button-icon">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M9.24996 12.0608L8.71963 11.5304L5.89641 8.70722C5.50588 8.3167 5.50588 7.68353 5.89641 7.29301L8.71963 4.46978L9.24996 3.93945L10.3106 5.00011L9.78029 5.53044L7.31062 8.00011L9.78029 10.4698L10.3106 11.0001L9.24996 12.0608Z" fill="currentColor"></path>
                </svg>
            </button>
            <div class="error-overlay-pagination-count inline-flex justify-center items-center min-w-8 h-5 gap-1 text-[var(--flame-text)] text-center text-[11px] font-medium leading-4 rounded-full px-1.5">
                <span data-flame-dialog-error-index="0">1</span>
                <span class="text-[var(--flame-text-muted)]">/</span>
                <span data-flame-dialog-header-total-count="true">1</span>
            </div>
            <button type="button" aria-disabled="true" data-flame-dialog-error-next="true" class="error-overlay-pagination-button flex justify-center items-center w-6 h-6 bg-[var(--flame-chip-bg)] rounded-full disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-[var(--flame-red-orange)] hover:bg-[var(--flame-hover-overlay)] transition-colors" disabled>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" class="error-overlay-pagination-button-icon" aria-label="next">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M6.75011 3.93945L7.28044 4.46978L10.1037 7.29301C10.4942 7.68353 10.4942 8.3167 10.1037 8.70722L7.28044 11.5304L6.75011 12.0608L5.68945 11.0001L6.21978 10.4698L8.68945 8.00011L6.21978 5.53044L5.68945 5.00011L6.75011 3.93945Z" fill="currentColor"></path>
                </svg>
            </button>
            </nav>
            <svg width="60" height="42" viewBox="0 0 60 42" fill="none" xmlns="http://www.w3.org/2000/svg" class="error-overlay-notch-tail absolute top-[calc(var(--flame-dialog-border-width)*-1)] -z-[1] h-[calc(100%+var(--flame-dialog-border-width))] right-[-54px] pointer-events-none" preserveAspectRatio="none">
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
            </svg>
        </div>
        <div class="error-overlay-notch flex relative translate-x-[calc(var(--flame-dialog-border-width)*-1)] h-[var(--flame-dialog-notch-height)] p-3 pl-0 bg-[var(--background-color)] border border-[var(--stroke-color)] border-b-0 rounded-tr-[var(--flame-dialog-radius)]" data-side="right">
            <div id="__flame__editor" class="hidden sm:flex items-center gap-1 mr-1">
                <label for="editor-selector" class="sr-only">Editor</label>
                <select id="editor-selector" class="py-1 cursor-pointer px-2 pe-6 block w-44 bg-[var(--flame-surface)] border border-[var(--flame-border)] rounded-[var(--flame-radius-md)] text-xs text-[var(--flame-text)] shadow-[var(--flame-elevation-1)] hover:bg-[var(--flame-hover-overlay)] focus:outline-hidden focus:ring-1 focus:ring-[var(--flame-red-orange)]">${editorOptions}</select>
            </div>
            
            <div id="hs-theme-switch" class="flex items-center gap-1">
                <div class="hs-tooltip inline-block">
                    <button type="button" aria-label="Switch to dark mode" aria-describedby="theme-tooltip-dark" class="hs-tooltip-toggle hs-dark-mode-active:hidden block hs-dark-mode font-medium rounded-full hover:bg-[var(--flame-hover-overlay)] focus:outline-hidden focus:bg-[var(--flame-hover-overlay)] text-[var(--flame-text)]" data-hs-theme-click-value="dark">
                        <span class="group inline-flex shrink-0 justify-center items-center size-8">
                            <span class="dui w-5 h-5" style="-webkit-mask-image: url('${moonStarIcon}'); mask-image: url('${moonStarIcon}')"></span>
                        </span>
                    </button>
                    <span id="theme-tooltip-dark" class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity hidden invisible z-10 py-1 px-2 text-xs font-medium rounded-[var(--flame-dialog-radius-md)] shadow-[var(--flame-elevation-1)] bg-[var(--flame-charcoal-black)] text-[var(--flame-white-smoke)]" role="tooltip">Dark</span>
                </div>
                <div class="hs-tooltip inline-block">
                    <button type="button" aria-label="Switch to light mode" aria-describedby="theme-tooltip-light" class="hs-tooltip-toggle hs-dark-mode-active:block hidden hs-dark-mode font-medium rounded-full hover:bg-[var(--flame-hover-overlay)] focus:outline-hidden focus:bg-[var(--flame-hover-overlay)] text-[var(--flame-text)]" data-hs-theme-click-value="light">
                        <span class="group inline-flex shrink-0 justify-center items-center size-8">
                            <span class="dui w-5 h-5" style="-webkit-mask-image: url('${sunIcon}'); mask-image: url('${sunIcon}')"></span>
                        </span>
                    </button>
                    <span id="theme-tooltip-light" class="hs-tooltip-content hs-tooltip-shown:opacity-100 hs-tooltip-shown:visible opacity-0 transition-opacity hidden invisible z-10 py-1 px-2 text-xs font-medium rounded-[var(--flame-dialog-radius-md)] shadow-[var(--flame-elevation-1)] bg-[var(--flame-charcoal-black)] text-[var(--flame-white-smoke)]" role="tooltip">Light</span>
                </div>
            </div>

            <svg width="60" height="42" viewBox="0 0 60 42" fill="none" xmlns="http://www.w3.org/2000/svg" class="error-overlay-notch-tail absolute top-[calc(var(--flame-dialog-border-width)*-1)] -z-[1] h-[calc(100%+var(--flame-dialog-border-width))] left-[-54px] pointer-events-none [transform:rotateY(180deg)]" preserveAspectRatio="none">
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
            </svg>
        </div>
    </div>

    <div id="__flame__panel" role="dialog" aria-modal="true" aria-label="Runtime Error Overlay" class="relative z-10 flex w-full max-w-[var(--flame-dialog-max-width)] max-h-[calc(100%-56px)] scale-100 opacity-100 flex-col overflow-hidden rounded-b-[var(--flame-dialog-radius)] bg-[var(--flame-surface)] text-[var(--flame-text)] shadow-[var(--flame-elevation-1)] border-b border-[var(--flame-border)] ">
        <div id="__flame__header" class="flex items-center justify-between border-b border-[var(--flame-border)] bg-[var(--flame-surface)] px-4 pt-2 pb-3">
            <div id="__flame__title" class="flex items-center gap-2 font-bold text-[var(--flame-text)]">
                <span id="__flame__heading" class="leading-none">Runtime Error</span>
                <a id="__flame__filelink" class="ml-2 text-xs font-normal underline text-[var(--flame-text-muted)] hover:text-[var(--flame-text)]" href="#" target="_blank" rel="noreferrer noopener"></a>
            </div>
            <div class="flex items-center gap-2">
                <div id="__flame__mode" class="hidden sm:flex items-center gap-1 mr-1">
                    <button type="button" data-flame-mode="original" class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[var(--flame-text)] bg-[var(--flame-chip-bg)] rounded-full hover:bg-[var(--flame-hover-overlay)] focus:outline-hidden focus:bg-[var(--flame-hover-overlay)]">Original</button>
                    <button type="button" data-flame-mode="compiled" class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[var(--flame-text)] bg-[var(--flame-chip-bg)] rounded-full hover:bg-[var(--flame-hover-overlay)] focus:outline-hidden focus:bg-[var(--flame-hover-overlay)]">Compiled</button>
                </div>
            </div>
        </div>

        <div id="__flame__solutions" class="p-4 hidden"></div>
        <div id="__flame__body" class="relative flex min-h-0 p-4 bg-[var(--flame-surface)]">
            <div id="__flame__overlay" class="overflow-auto"></div>
        </div>
    </div>

    <div id="__flame__stacktrace" class="relative -mt-5 py-5 w-full max-w-[var(--flame-dialog-max-width)] max-h-[200px] rounded-b-[var(--flame-dialog-radius)] border border-[var(--flame-border)] bg-[var(--flame-surface-muted)] shadow-[var(--flame-elevation-2)]">
        <div class="px-4 py-2 border-b border-[var(--flame-border)] text-xs text-[var(--flame-text-muted)]">Raw stack trace</div>
        <div class="px-4 py-2 text-[var(--flame-text)] text-xs font-mono leading-5 overflow-auto space-y-0.5 max-h-[140px]"></div>
    </div>
</div>`;

export const patchOverlay = (code: string): string => {
    // Use JSON.stringify to properly escape the template string and avoid octal escape issues
    const templateString = `const overlayTemplate = ${JSON.stringify(overlayTemplate)};`;

    let patched = code.replace("class ErrorOverlay", `${templateString}\n${FlameErrorOverlay}\nclass ViteErrorOverlay`);
    patched = patched.replace("var ErrorOverlay = ", `${templateString}\n${FlameErrorOverlay}\nvar ViteErrorOverlay = `);

    // Make our ErrorOverlay available globally AFTER it's defined
    patched = `${patched}\n\nwindow.ErrorOverlay = ErrorOverlay;`;

    return patched;
};

export default patchOverlay;
