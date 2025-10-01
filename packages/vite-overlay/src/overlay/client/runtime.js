/* eslint-disable no-secrets/no-secrets */
/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable no-param-reassign */
/* eslint-disable n/no-unsupported-features/node-builtins */
/* eslint-disable no-unsanitized/property */
/* eslint-disable no-underscore-dangle */
/* eslint-disable func-names */
/* eslint-disable no-plusplus */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

/**
 * Custom HTML element that displays error overlays in the browser.
 * Provides interactive error display with theme switching, code frames, and navigation.
 * @augments HTMLElement
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class ErrorOverlay extends HTMLElement {
    /**
     * @typedef {import('../types').VisulimaViteOverlayErrorPayload} VisulimaViteOverlayErrorPayload
     */

    // Cached DOM elements for performance
    __elements = {};

    // Event listeners for cleanup
    __eventListeners = new Map();

    // Core state
    __v_oCurrentHistoryIndex = -1;

    __v_oHistoryEnabled = false;

    __v_oMode;

    __v_oPayload;

    __v_oScrollTimeout = null;

    /**
     * Gets the global error history, creating it if it doesn't exist.
     * @returns {Array} The global error history array
     */
    get __v_oHistory() {
        if (!globalThis.__v_o_error_history) {
            globalThis.__v_o_error_history = [];
        }

        return globalThis.__v_o_error_history;
    }

    /**
     * Sets the global error history.
     * @param {Array} value - The history array to set
     */
    set __v_oHistory(value) {
        globalThis.__v_o_error_history = value;
    }

    /**
     * Creates a new ErrorOverlay instance.
     * @param {VisulimaViteOverlayErrorPayload} error - The error payload to display
     */
    constructor(error) {
        super();

        // Remove previous instance
        const previous = globalThis.__v_o__current;

        if (previous && previous !== this) {
            if (previous.parentNode) {
                previous.remove();
            } else if (typeof previous.close === "function") {
                previous.close();
            }
        }

        this.root = this.attachShadow({ mode: "open" });
        // eslint-disable-next-line no-undef
        this.root.innerHTML = overlayTemplate;
        this.dir = "ltr";

        this.element = this;
        this.root.host._errorOverlay = this;
        globalThis.__v_o__current = this;

        if (error && (error.errors === undefined || !Array.isArray(error.errors))) {
            return;
        }

        const payload = {
            errors: error.errors,
            errorType: error.errorType || "server",
            rootPath: error.rootPath || "",
        };

        this.__v_oPayload = payload;
        this.__v_oMode = "original";

        // Cache DOM elements for performance
        this._cacheElements();

        this._initializeThemeToggle();
        this._initializeBalloon(payload.errors.length);
        this._restoreBalloonState();
        this._initializeCopyError();
        this._initializePagination();
        this._initializeHistory();

        if (error.solution) {
            this._injectSolution(error.solution);
        }

        this._hideLoadingStates();

        const editorSelect = this.root.querySelector("#editor-selector");

        if (editorSelect) {
            let saved;

            saved = localStorage.getItem("vo:editor");

            if (saved && editorSelect.value !== saved) {
                editorSelect.value = saved;
            }

            editorSelect.addEventListener("change", function () {
                localStorage.setItem("vo:editor", this.value || "");
            });
        }

        const closeButton = this.root.querySelector("#__v_o__close");

        if (closeButton) {
            if (this.__v_oPayload.errorType === "client") {
                closeButton.addEventListener("click", () => {
                    this.close();
                });
            } else {
                closeButton.style.display = "none";
            }
        }

        if (this.__v_oPayload.errorType === "client") {
            document.addEventListener("keydown", (event) => {
                if (event.key === "Escape" && this.parentNode) {
                    this.close();
                }

                // History mode keyboard navigation
                if (this.__v_oHistoryEnabled && this.__v_oHistory.length > 1) {
                    // eslint-disable-next-line default-case
                    switch (event.key) {
                        case "ArrowDown":
                        case "ArrowRight": {
                            event.preventDefault();
                            this._navigateHistoryByScroll(1);

                            break;
                        }
                        case "ArrowLeft":
                        case "ArrowUp": {
                            event.preventDefault();
                            this._navigateHistoryByScroll(-1);

                            break;
                        }
                        case "End": {
                            event.preventDefault();
                            this._navigateToHistoryItem(this.__v_oHistory.length - 1);

                            break;
                        }
                        case "h":
                        case "H": {
                            event.preventDefault();
                            this._toggleHistoryMode();

                            break;
                        }
                        case "Home": {
                            event.preventDefault();
                            this._navigateToHistoryItem(0);

                            break;
                        }
                        // No default
                    }
                }
            });
        }
    }

    /**
     * Adds the current error to the history.
     * @private
     */
    _addCurrentErrorToHistory() {
        if (!this.__v_oPayload || !this.__v_oPayload.errors || this.__v_oPayload.errors.length === 0) {
            return;
        }

        const currentError = this.__v_oPayload.errors[0];
        const historyEntry = {
            column: currentError.originalFileColumn || 0,
            errorType: this.__v_oPayload.errorType || "client",
            file: currentError.originalFilePath || "",
            id: this._generateErrorId(currentError),
            line: currentError.originalFileLine || 0,
            message: currentError.message || "",
            name: currentError.name || "Error",
            payload: this.__v_oPayload,
            timestamp: Date.now(),
        };

        // Always add error to history (no deduplication to show frequency)
        this.__v_oHistory.unshift(historyEntry);
        this.__v_oCurrentHistoryIndex = 0;

        // Limit history to 50 entries to prevent memory issues
        if (this.__v_oHistory.length > 50) {
            this.__v_oHistory = this.__v_oHistory.slice(0, 50);
        }
    }

    /**
     * Adds an event listener with cleanup tracking.
     * @private
     * @param {Element} element - The element to add the listener to
     * @param {string} event - The event type
     * @param {Function} handler - The event handler
     * @param {object} options - Event listener options
     */
    _addEventListener(element, event, handler, options = {}) {
        if (!element)
            return;

        element.addEventListener(event, handler, options);
        const key = `${element.id || element.className || "unknown"}_${event}`;

        if (!this.__eventListeners.has(key)) {
            this.__eventListeners.set(key, []);
        }

        this.__eventListeners.get(key).push({ element, event, handler, options });
    }

    /**
     * Initializes cached DOM element references for performance.
     * @private
     */
    _cacheElements() {
        const { root } = this;

        if (!root) {
            return;
        }

        this.__elements = {
            balloon: root.querySelector("#__v_o__balloon"),
            balloonCount: root.querySelector("#__v_o__balloon_count"),
            balloonText: root.querySelector("#__v_o__balloon_text"),
            fileButton: root.querySelector("button[class*=\"underline\"]"),
            heading: root.querySelector("#__v_o__heading"),
            historyIndicator: root.querySelector("#__v_o__history_indicator"),
            historyLayers: this.__v_oHistoryLayers,
            historyToggle: root.querySelector("#__v_o__history_toggle"),
            message: root.querySelector(String.raw`.text-sm.text-\[var\(--ono-v-red-orange\)\].font-mono.bg-\[var\(--ono-v-surface-muted\)\]`),
            overlay: root.querySelector("#__v_o__overlay"),
            root: this.root.querySelector("#__v_o__root"),
            stackElement: root.querySelector(String.raw`.text-xs.font-mono.text-\[var\(--ono-v-text-muted\)\].whitespace-pre-wrap`),
        };
    }

    /**
     * Cleans up all event listeners.
     * @private
     */
    _cleanupEventListeners() {
        for (const listeners of this.__eventListeners.values()) {
            for (const { element, event, handler, options } of listeners) {
                element.removeEventListener(event, handler, options);
            }
        }

        this.__eventListeners.clear();
    }

    /**
     * Creates a single history layer element.
     * @private
     * @param {object} entry - The history entry
     * @param {number} index - The index in history
     * @returns {HTMLElement} The layer element
     */
    _createHistoryLayer(entry, index) {
        // Create the template element if it doesn't exist
        let templateElement = document.querySelector("#__v_o__history_layer");

        if (!templateElement) {
            templateElement = document.createElement("div");
            templateElement.id = "__v_o__history_layer";
            templateElement.className = "fixed inset-0 z-[2147483647] flex flex-col items-center pt-[10vh] px-[15px] hidden";
            templateElement.innerHTML = `
                <div id="__v_o__backdrop" class="fixed inset-0 -z-1 bg-black/60 backdrop-blur-sm md:backdrop-blur pointer-events-none"></div>
                <div id="__v_o__notch" class="relative z-[2] flex w-full max-w-[var(--ono-v-dialog-max-width)] items-center justify-between outline-none translate-x-[var(--ono-v-dialog-border-width)] translate-y-[var(--ono-v-dialog-border-width)]" style="--stroke-color: var(--ono-v-border); --background-color: var(--ono-v-surface);">
                    <div class="error-overlay-notch relative translate-x-[calc(var(--ono-v-dialog-border-width)*-1)] h-[var(--ono-v-dialog-notch-height)] p-3 pr-0 bg-[var(--background-color)] border border-[var(--stroke-color)] border-b-0 rounded-tl-[var(--ono-v-dialog-radius)]" data-side="left">
                        <nav class="error-overlay-pagination dialog-exclude-closing-from-outside-click flex justify-center items-center gap-2 w-fit">
                            <div class="error-overlay-pagination-count inline-flex justify-center items-center min-w-8 h-5 gap-1 text-[var(--ono-v-text)] text-center text-[11px] font-medium leading-4 rounded-full px-1.5">
                                <span>1</span>
                                <span class="text-[var(--ono-v-text-muted)]">/</span>
                                <span>1</span>
                            </div>
                        </nav>
                        <svg width="60" height="42" viewBox="0 0 60 42" fill="none" xmlns="http://www.w3.org/2000/svg" class="error-overlay-notch-tail absolute top-[calc(var(--ono-v-dialog-border-width)*-1)] -z-[1] h-[calc(100%+var(--ono-v-dialog-border-width))] right-[-54px] pointer-events-none" preserveAspectRatio="none">
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
                    <div class="error-overlay-notch flex gap-1 relative translate-x-[calc(var(--ono-v-dialog-border-width)*-1)] h-[var(--ono-v-dialog-notch-height)] p-3 pl-0 bg-[var(--background-color)] border border-[var(--stroke-color)] border-b-0 rounded-tr-[var(--ono-v-dialog-radius)]" data-side="right">
                        <div class="flex items-center gap-1 text-xs text-[var(--ono-v-text-muted)]">
                            <span>Just now</span>
                        </div>
                        <svg width="60" height="42" viewBox="0 0 60 42" fill="none" xmlns="http://www.w3.org/2000/svg" class="error-overlay-notch-tail absolute top-[calc(var(--ono-v-dialog-border-width)*-1)] -z-[1] h-[calc(100%+var(--ono-v-dialog-border-width))] left-[-54px] pointer-events-none [transform:rotateY(180deg)]" preserveAspectRatio="none">
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

                <div role="dialog" aria-modal="true" aria-label="Runtime Error Overlay" class="relative z-10 flex w-full max-w-[var(--ono-v-dialog-max-width)] max-h-[calc(100%-56px)] scale-100 opacity-100 flex-col overflow-hidden rounded-b-[var(--ono-v-dialog-radius)] bg-[var(--ono-v-surface)] text-[var(--ono-v-text)] shadow-[var(--ono-v-elevation-1)] border-b border-[var(--ono-v-border)]">
                    <div class="flex items-center gap-1 justify-between border-b border-[var(--ono-v-border)] bg-[var(--ono-v-surface)] px-4 py-2">
                        <div class="flex items-center gap-2 w-full font-bold text-[var(--ono-v-text)]">
                            <span class="leading-none rounded-md text-[var(--ono-v-red-orange)] font-mono text-sm">error</span>
                            <button type="button" class="ml-2 text-xs font-normal font-mono underline text-[var(--ono-v-text-muted)] hover:text-[var(--ono-v-text)] bg-transparent border-none cursor-pointer">Unknown file</button>
                        </div>
                    </div>
                    <div class="px-4 py-2 text-sm text-[var(--ono-v-red-orange)] font-mono bg-[var(--ono-v-surface-muted)] border-b border-[var(--ono-v-border)] font-medium">Unknown error</div>
                    <div class="relative flex min-h-0 mx-1 py-2 bg-[var(--ono-v-surface)]">
                        <div class="overflow-auto w-full">
                            <div class="text-xs font-mono text-[var(--ono-v-text-muted)] whitespace-pre-wrap">No stack trace available</div>
                    </div>
                </div>
            </div>
        `;
            this.__v_oHistoryLayers.append(templateElement);
        }

        // Clone the template element
        const layer = templateElement.cloneNode(true);

        // Update the ID to be unique
        layer.id = `__v_o__history_layer_${index + 1}`;

        // Set classes and data attributes
        layer.className = "history-overlay-layer";
        layer.dataset.historyIndex = index;
        layer.dataset.errorId = entry.id;

        // Update content with history entry data
        const timeAgo = this._formatTimeAgo(entry.timestamp);
        const relativePath = this._getRelativePath(entry.file);
        const errorType = entry.errorType || "error";
        const errorMessage = this._escapeHtml(entry.message || "Unknown error");
        const errorFile = entry.file ? this._escapeHtml(relativePath) : "Unknown file";
        const errorLine = entry.line ? `:${entry.line}` : "";

        // Update pagination count
        const paginationCount = layer.querySelector(".error-overlay-pagination-count span:first-child");

        if (paginationCount) {
            paginationCount.textContent = (index + 1).toString();
        }

        const totalCount = layer.querySelector(".error-overlay-pagination-count span:last-child");

        if (totalCount) {
            totalCount.textContent = this.__v_oHistory.length.toString();
        }

        // Update timestamp
        const timeElement = layer.querySelector(".error-overlay-notch[data-side=\"right\"] span");

        if (timeElement) {
            timeElement.textContent = timeAgo;
        }

        // Update error type
        const errorTypeElement = layer.querySelector(String.raw`.text-\[var\(--ono-v-red-orange\)\]`);

        if (errorTypeElement) {
            errorTypeElement.textContent = errorType;
        }

        // Update file link
        const fileButton = layer.querySelector("button[class*=\"underline\"]");

        if (fileButton) {
            fileButton.textContent = `${errorFile}${errorLine}`;
        }

        // Update error message
        const messageElement = layer.querySelector(String.raw`.text-sm.text-\[var\(--ono-v-red-orange\)\].font-mono.bg-\[var\(--ono-v-surface-muted\)\]`);

        if (messageElement) {
            messageElement.textContent = errorMessage;
        }

        // Update stack trace
        const stackElement = layer.querySelector(String.raw`.text-xs.font-mono.text-\[var\(--ono-v-text-muted\)\].whitespace-pre-wrap`);

        if (stackElement) {
            stackElement.textContent = this._escapeHtml(entry.stack || "No stack trace available");
        }

        // Remove the original template element if this is the first layer
        if (index === 0) {
            templateElement.remove();
        }

        return layer;
    }

    /**
     * Escapes HTML special characters.
     * @private
     * @param {string} text - The text to escape
     * @returns {string} Escaped text
     */
    _escapeHtml(text) {
        if (!text)
            return "";

        return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#39;");
    }

    /**
     * Formats a timestamp as a human-readable "time ago" string.
     * @private
     * @param {number} timestamp - The timestamp to format
     * @returns {string} Formatted time string
     */
    _formatTimeAgo(timestamp) {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60_000);
        const hours = Math.floor(diff / 3_600_000);
        const days = Math.floor(diff / 86_400_000);

        if (days > 0)
            return `${days}d ago`;

        if (hours > 0)
            return `${hours}h ago`;

        if (minutes > 0)
            return `${minutes}m ago`;

        return "Just now";
    }

    /**
     * Generates a unique ID for an error based on its properties.
     * @private
     * @param {object} error - The error object
     * @returns {string} A unique identifier for the error
     */
    _generateErrorId(error) {
        const key = `${error.name || ""}|${error.message || ""}|${error.originalFilePath || ""}|${error.originalFileLine || 0}|${error.originalFileColumn || 0}`;

        // Simple hash function
        let hash = 0;

        for (let index = 0; index < key.length; index++) {
            hash = ((hash << 5) - hash + key.charCodeAt(index)) & 0xff_ff_ff_ff;
        }

        return Math.abs(hash).toString(36);
    }

    /**
     * Gets a relative path from a full file path.
     * @private
     * @param {string} filePath - The full file path
     * @returns {string} Relative path
     */
    _getRelativePath(filePath) {
        if (!filePath)
            return "";

        const rootPath = this.__v_oPayload?.rootPath || "";

        if (rootPath && filePath.startsWith(rootPath)) {
            return filePath.slice(rootPath.length).replace(/^\//, "");
        }

        return filePath;
    }

    /**
     * Hides loading skeleton states and shows the actual content after a brief delay.
     * @private
     */
    _hideLoadingStates() {
        setTimeout(() => {
            const headerSkeleton = this.root.querySelector("#__v_o__header_loader");
            const headerContent = this.root.querySelector("#__v_o__title");

            if (headerSkeleton) {
                headerSkeleton.style.display = "none";
            }

            if (headerContent) {
                headerContent.classList.remove("hidden");
            }

            const messageSkeleton = this.root.querySelector("#__v_o__message_loader");
            const messageContent = this.root.querySelector("#__v_o__message");

            if (messageSkeleton) {
                messageSkeleton.style.display = "none";
            }

            if (messageContent) {
                messageContent.classList.remove("hidden");
            }

            const bodySkeleton = this.root.querySelector("#__v_o__body_loader");
            const bodyContent = this.root.querySelector("#__v_o__overlay");

            if (bodySkeleton) {
                bodySkeleton.style.display = "none";
            }

            if (bodyContent) {
                bodyContent.classList.remove("hidden");
            }
        }, 100);
    }

    /**
     * Initializes the floating balloon button that shows the error count
     * and toggles the overlay open/close when clicked.
     * @private
     * @param {number} total - The total number of errors to display
     */
    _initializeBalloon(total) {
        const { balloon, balloonCount, balloonText, root } = this.__elements || {};

        if (!balloon || !balloonCount || !root)
            return;

        try {
            balloonCount.textContent = total.toString();

            if (balloonText) {
                balloonText.textContent = total === 1 ? "Error" : "Errors";
            }

            this._restoreBalloonState();
            balloon.classList.toggle("hidden", total <= 0);

            const clickHandler = (event) => {
                event.preventDefault();
                const isHidden = root.classList.contains("hidden");

                root.classList.toggle("hidden");
                this._saveBalloonState("overlay", isHidden ? "open" : "closed");
            };

            this._makeBalloonDraggable(balloon);
            balloon.addEventListener("click", clickHandler);
        } catch {
            // Fail silently if DOM is not available
        }
    }

    /**
     * Initializes the copy error functionality that copies error details to clipboard.
     * @private
     */
    _initializeCopyError() {
        const copyButton = this.root.querySelector("#__v_o__copy_error");

        if (!copyButton) {
            return;
        }

        copyButton.addEventListener("click", async (event) => {
            event.preventDefault();

            try {
                const payload = this.__v_oPayload;
                const currentError = payload && payload.errors && payload.errors[0];

                if (!currentError) {
                    console.warn("[v-o] No error data available to copy");

                    return;
                }

                const codeFrame = (currentError && currentError.originalSnippet) || "";

                const formattedText = [
                    "## Error Type",
                    currentError.name || "Unknown Error",
                    "",
                    "## Error Message",
                    currentError.message || "No error message available",
                    "",
                    "## Build Output",
                    currentError.originalFilePath
                        ? `${currentError.originalFilePath}:${currentError.originalFileLine}:${currentError.originalFileColumn}`
                        : "Unknown location",
                    currentError.message || "No error message available",
                    ...codeFrame ? ["", codeFrame] : [],
                    "",
                    "## Stack Trace",
                    currentError.stack || "No stack trace available",
                ].join("\n");

                await navigator.clipboard.writeText(formattedText);

                const originalText = copyButton.innerHTML;

                copyButton.innerHTML = `
                    <span class="inline-flex shrink-0 justify-center items-center size-8">
                        <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <polyline points="20,6 9,17 4,12"></polyline>
                        </svg>
                    </span>
                `;

                setTimeout(() => {
                    copyButton.innerHTML = originalText;
                }, 2000);
            } catch (error) {
                console.error("[v-o] Failed to copy error info:", error);

                const originalText = copyButton.innerHTML;

                copyButton.innerHTML = `
                    <span class="inline-flex shrink-0 justify-center items-center size-8">
                        <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </span>
                `;

                setTimeout(() => {
                    copyButton.innerHTML = originalText;
                }, 2000);
            }
        });
    }

    /**
     * Initializes the layered error history functionality with Mac Time Machine-like scrolling.
     * @private
     */
    _initializeHistory() {
        this._addCurrentErrorToHistory();
        this._initializeHistoryLayers();
        this._initializeHistoryToggle();
        this._initializeScrollNavigation();
        this._updateHistoryToggleVisibility();
    }

    /**
     * Initializes the layered history system.
     * @private
     */
    _initializeHistoryLayers() {
        // Create the history layers container if it doesn't exist
        if (!this.__v_oHistoryLayers) {
            this.__v_oHistoryLayers = document.querySelector("#__v_o__history_layers");

            if (!this.__v_oHistoryLayers) {
                this.__v_oHistoryLayers = document.createElement("div");
                this.__v_oHistoryLayers.id = "__v_o__history_layers";
                this.__v_oHistoryLayers.className = "fixed inset-0 z-[2147483645] pointer-events-none";
                document.body.append(this.__v_oHistoryLayers);
            }
        }

        this._renderHistoryLayers();
    }

    /**
     * Initializes the history toggle button.
     * @private
     */
    _initializeHistoryToggle() {
        const toggleButton = this.root.querySelector("#__v_o__history_toggle");

        if (!toggleButton) {
            return;
        }

        toggleButton.addEventListener("click", (event) => {
            event.preventDefault();
            this._toggleHistoryMode();
        });
    }

    /**
     * Initializes pagination functionality for navigating between multiple errors.
     * @private
     */
    _initializePagination() {
        const payload = this.__v_oPayload;
        const errors = Array.isArray(payload.errors) && payload.errors.length > 0 ? payload.errors : [];
        const errorIds = errors.map((error) =>
            String(error.__id || [error.originalFilePath || "", error.originalFileLine || 0, error.name || "", error.message || ""].join("|")),
        );

        const totalErrors = errors.length;

        let currentIndex = 0;

        const updateOverlayContent = () => {
            const mount = this.root.querySelector("#__v_o__overlay");

            if (!mount) {
                return;
            }

            const currentError = errors[currentIndex] || {
                compiledStack: payload.compiledStack,
                message: payload.message,
                name: payload.name,
                originalStack: payload.originalStack,
            };

            const updateFileLink = () => {
                const fileElement = this.root.querySelector("#__v_o__filelink");

                if (fileElement) {
                    const fullPath = (currentError && currentError.originalFilePath) || "";
                    const line = currentError && currentError.originalFileLine;
                    const column = currentError && currentError.originalFileColumn;

                    if (fullPath) {
                        const isHttpLink = /^https?:\/\//i.test(fullPath);
                        let displayPath = fullPath;

                        if (!isHttpLink && payload.rootPath && fullPath.startsWith(payload.rootPath)) {
                            displayPath = fullPath.slice(payload.rootPath.length);

                            if (!displayPath.startsWith("/")) {
                                displayPath = `/${displayPath}`;
                            }
                        }

                        fileElement.textContent = isHttpLink ? fullPath : `.${displayPath}${line ? `:${line}` : ""}`;
                        const editor = localStorage.getItem("vo:editor");

                        // Remove any existing event listeners
                        const newFileElement = fileElement.cloneNode(true);

                        fileElement.parentNode.replaceChild(newFileElement, fileElement);

                        newFileElement.addEventListener("click", (event) => {
                            event.preventDefault();

                            if (isHttpLink) {
                                globalThis.open(fullPath, "_blank");
                            } else {
                                // injected by the hmr plugin when served
                                // eslint-disable-next-line no-undef
                                const url = `${base}__open-in-editor?file=${encodeURIComponent(fullPath)}${
                                    line ? `&line=${line}` : ""
                                }${column ? `&column=${column}` : ""}${editor ? `&editor=${editor}` : ""}`;

                                fetch(url);
                            }
                        });

                        newFileElement.classList.remove("hidden");
                    } else {
                        fileElement.textContent = "";
                        fileElement.classList.add("hidden");
                    }
                }
            };

            const updateRawStack = (mode) => {
                const stackHost = this.root.querySelector("#__v_o__stacktrace");
                const stackElement = stackHost && stackHost.querySelector("div:last-child");

                if (stackHost && stackElement) {
                    const rootPayload = this.__v_oPayload || {};

                    const stackText
                        = mode === "compiled"
                            ? String(currentError.compiledStack || rootPayload.compiledStack || "")
                            : String(currentError.originalStack || currentError.stack || rootPayload.originalStack || "");

                    const escape = (s) =>
                        String(s || "")
                            .replaceAll("&", "&amp;")
                            .replaceAll("<", "&lt;")
                            .replaceAll(">", "&gt;");

                    const normalizePath = (path) => {
                        if (/^https?:\/\//i.test(path)) {
                            const u = new URL(path);

                            path = u.pathname || "";
                        }

                        path = decodeURIComponent(path);
                        path = String(path || "").replace(/^\/@fs\//, "/");

                        return path;
                    };

                    const fmt = (line) => {
                        const m = /\s*at\s+(?:(.+?)\s+\()?(.*?):(\d+):(\d+)\)?/.exec(line);

                        if (!m) {
                            return `<div class="frame">${escape(line)}</div>`;
                        }

                        const function_ = m[1] ? escape(m[1]) : "";
                        const file = m[2];
                        const ln = m[3];
                        const col = m[4];
                        const displayPath = normalizePath(file);
                        const display = `${displayPath}:${ln}:${col}`;
                        const functionHtml = function_ ? `<span class="fn">${function_}</span> ` : "";

                        return `<div class="frame"><span class="muted">at</span> ${functionHtml}<button type="button" class="stack-link text-left underline bg-transparent border-none cursor-pointer text-[var(--ono-v-text)] hover:text-[var(--ono-v-text-muted)]" data-file="${escape(displayPath)}" data-line="${ln}" data-column="${col}">${escape(display)}</button></div>`;
                    };
                    const html = stackText.split("\n").map(fmt).join("");

                    stackElement.innerHTML = html;
                    stackElement.querySelectorAll(".stack-link").forEach((button) => {
                        button.addEventListener("click", (event_) => {
                            event_.preventDefault();

                            const filePath = button.dataset.file || "";
                            const line = button.dataset.line || "";
                            const column = button.dataset.column || "";
                            let resolved = filePath;

                            const abs = currentError.originalFilePath || currentError.compiledFilePath || "";

                            if (abs && abs.endsWith(filePath)) {
                                resolved = abs;
                            }

                            const editor = localStorage.getItem("vo:editor");

                            // injected by the hmr plugin when served
                            // eslint-disable-next-line no-undef
                            const url = `${base}__open-in-editor?file=${encodeURIComponent(resolved)}${
                                line ? `&line=${line}` : ""
                            }${column ? `&column=${column}` : ""}${editor ? `&editor=${editor}` : ""}`;

                            fetch(url);
                        });
                    });
                }
            };

            const flameOverlay = this.root.querySelector("#__v_o__overlay");
            const headingElement = this.root.querySelector("#__v_o__heading");
            const messageElement = this.root.querySelector("#__v_o__message");
            const modeSwitch = this.root.querySelector("#__v_o__mode");

            if (headingElement) {
                headingElement.textContent = currentError.name || "";
                headingElement.dataset.errorId = errorIds[currentIndex] || "";
            }

            if (messageElement) {
                messageElement.textContent = currentError.message || "";
            }

            const hasOriginal = !!currentError.originalCodeFrameContent;
            const hasCompiled = !!currentError.compiledCodeFrameContent;

            if (hasOriginal && hasCompiled && modeSwitch) {
                modeSwitch.classList.remove("hidden");
            } else if (modeSwitch) {
                modeSwitch.classList.add("hidden");
            }

            const originalButton = this.root.querySelector("[data-flame-mode=\"original\"]");
            const compiledButton = this.root.querySelector("[data-flame-mode=\"compiled\"]");

            if (originalButton) {
                originalButton.style.display = hasOriginal ? "" : "none";
            }

            if (compiledButton) {
                compiledButton.style.display = hasCompiled ? "" : "none";
            }

            const renderCode = (mode) => {
                if (!flameOverlay) {
                    return;
                }

                let codeFrame = "<div class=\"no-code-frame font-mono\">No code frame could be generated.</div>";

                if (mode === "compiled" && currentError.compiledCodeFrameContent) {
                    codeFrame = currentError.compiledCodeFrameContent;
                } else if (currentError.originalCodeFrameContent) {
                    codeFrame = currentError.originalCodeFrameContent;
                }

                flameOverlay.innerHTML = codeFrame;
            };

            const activeMode = this.__v_oMode || "original";

            renderCode(activeMode);
            updateFileLink();
            updateRawStack(activeMode);

            if (originalButton && compiledButton) {
                if (activeMode === "original") {
                    originalButton.classList.add("active");
                    compiledButton.classList.remove("active");
                } else {
                    compiledButton.classList.add("active");
                    originalButton.classList.remove("active");
                }
            }

            if (originalButton) {
                originalButton.addEventListener("click", (event) => {
                    event.preventDefault();

                    this.__v_oMode = "original";

                    renderCode("original");
                    updateRawStack("original");

                    if (originalButton)
                        originalButton.classList.add("active");

                    if (compiledButton)
                        compiledButton.classList.remove("active");
                });
            }

            if (compiledButton) {
                compiledButton.addEventListener("click", (event) => {
                    event.preventDefault();

                    this.__v_oMode = "compiled";

                    renderCode("compiled");
                    updateRawStack("compiled");

                    if (compiledButton)
                        compiledButton.classList.add("active");

                    if (originalButton)
                        originalButton.classList.remove("active");
                });
            }
        };

        const updatePagination = () => {
            const indexElement = this.root.querySelector("[data-flame-dialog-error-index]");
            const totalElement = this.root.querySelector("[data-flame-dialog-header-total-count]");
            const previousButton = this.root.querySelector("[data-flame-dialog-error-previous]");
            const nextButton = this.root.querySelector("[data-flame-dialog-error-next]");

            if (indexElement) {
                indexElement.textContent = (currentIndex + 1).toString();
            }

            if (totalElement) {
                totalElement.textContent = totalErrors.toString();
            }

            if (previousButton) {
                previousButton.disabled = currentIndex === 0;
                previousButton.setAttribute("aria-disabled", currentIndex === 0);
            }

            if (nextButton) {
                nextButton.disabled = currentIndex >= totalErrors - 1;
                nextButton.setAttribute("aria-disabled", currentIndex >= totalErrors - 1);
            }

            updateOverlayContent();
        };

        // Store the updatePagination function for use by history navigation
        this._updatePagination = updatePagination;

        const previousButton = this.root.querySelector("[data-flame-dialog-error-previous]");
        const nextButton = this.root.querySelector("[data-flame-dialog-error-next]");

        if (previousButton) {
            previousButton.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();

                if (currentIndex > 0) {
                    currentIndex--;
                    updatePagination();
                }
            });
        }

        if (nextButton) {
            nextButton.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();

                if (currentIndex < totalErrors - 1) {
                    currentIndex++;
                    updatePagination();
                }
            });
        }

        const selectById = (id) => {
            const index = errorIds.indexOf(String(id || ""));

            if (index !== -1) {
                currentIndex = index;

                updatePagination();
            }
        };

        globalThis.__v_oSelectError = selectById;

        globalThis.addEventListener("v-o:select-error", (event_) => {
            selectById(event_ && event_.detail && event_.detail.id);
        });

        updatePagination();
    }

    /**
     * Initializes scroll-based navigation for the layered history system.
     * @private
     */
    _initializeScrollNavigation() {
        const rootElement = this.__elements?.root;

        if (!rootElement)
            return;

        const handleWheel = (event) => {
            // Only handle scroll events when history is enabled and we have multiple errors
            if (!this.__v_oHistoryEnabled || this.__v_oHistory.length <= 1)
                return;

            // Prevent default scrolling behavior
            event.preventDefault();
            event.stopPropagation();

            // Ignore very small scroll movements
            if (Math.abs(event.deltaY) < 5)
                return;

            const scrollDirection = event.deltaY > 0 ? 1 : -1;

            this._navigateHistoryByScroll(scrollDirection);
        };

        // Add wheel event listener with proper options
        const options = { capture: true, passive: false };

        this._addEventListener(rootElement, "wheel", handleWheel, options);

        // Also add to the backdrop for better coverage
        const backdrop = this.root.querySelector("#__v_o__backdrop");

        if (backdrop) {
            this._addEventListener(backdrop, "wheel", handleWheel, options);
        }
    }

    /**
     * Initializes the theme toggle functionality for switching between light and dark modes.
     * @private
     */
    _initializeThemeToggle() {
        const savedTheme = localStorage.getItem("__v-o__theme");
        const systemPrefersDark = globalThis.matchMedia && globalThis.matchMedia("(prefers-color-scheme: dark)").matches;
        const currentTheme = savedTheme || (systemPrefersDark ? "dark" : "light");

        const isDark = currentTheme === "dark";

        const rootElement = this.__elements.root;
        const darkButton = this.root.querySelector("[data-v-o-theme-click-value=\"dark\"]");
        const lightButton = this.root.querySelector("[data-v-o-theme-click-value=\"light\"]");

        if (isDark) {
            if (darkButton) {
                darkButton.classList.add("hidden");
                darkButton.classList.remove("block");
            }

            if (lightButton) {
                lightButton.classList.remove("hidden");
                lightButton.classList.add("block");
            }

            if (rootElement)
                rootElement.classList.add("dark");
        } else {
            if (darkButton) {
                darkButton.classList.remove("hidden");
                darkButton.classList.add("block");
            }

            if (lightButton) {
                lightButton.classList.add("hidden");
                lightButton.classList.remove("block");
            }

            if (rootElement)
                rootElement.classList.remove("dark");
        }

        if (rootElement)
            rootElement.classList.remove("hidden");

        const themeButtons = this.root.querySelectorAll("[data-v-o-theme-click-value]");

        themeButtons.forEach((button) => {
            button.addEventListener("click", (event) => {
                event.preventDefault();

                const theme = event.currentTarget.dataset.vOThemeClickValue;

                if (theme === "dark") {
                    if (rootElement)
                        rootElement.classList.add("dark");

                    localStorage.setItem("__v-o__theme", "dark");

                    if (darkButton) {
                        darkButton.classList.add("hidden");
                        darkButton.classList.remove("block");
                    }

                    if (lightButton) {
                        lightButton.classList.remove("hidden");
                        lightButton.classList.add("block");
                    }
                } else {
                    if (rootElement)
                        rootElement.classList.remove("dark");

                    localStorage.setItem("__v-o__theme", "light");

                    if (darkButton) {
                        darkButton.classList.remove("hidden");
                        darkButton.classList.add("block");
                    }

                    if (lightButton) {
                        lightButton.classList.add("hidden");
                        lightButton.classList.remove("block");
                    }
                }
            });
        });
    }

    /**
     * Injects solution content into the overlay for display.
     * @param {object} solution - The solution object containing header and body
     * @private
     */
    _injectSolution(solution) {
        const solutions = this.root.querySelector("#__v_o__solutions");
        const solutionsContainer = this.root.querySelector("#__v_o__solutions_container");

        if (solutionsContainer && solution) {
            let html = "";

            if (solution.header) {
                html += solution.header;
            }

            if (solution.body) {
                html += solution.body;
            }

            solutionsContainer.innerHTML = html;
            solutions.classList.remove("hidden");
        }
    }

    /**
     * Makes the balloon draggable with corner constraints
     * @private
     * @param {HTMLElement} balloon - The balloon element
     */
    _makeBalloonDraggable(balloon) {
        let isDragging = false;
        let startX;
        let startY;
        let balloonRect;

        const handleMouseMove = (event) => {
            if (!isDragging)
                return;

            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            const balloonWidth = balloonRect.width;
            const balloonHeight = balloonRect.height;

            let newX = event.clientX - startX;
            let newY = event.clientY - startY;

            const padding = 8;
            const corners = [
                { name: "top-left", x: padding, y: padding },
                { name: "top-right", x: windowWidth - balloonWidth - padding, y: padding },
                { name: "bottom-left", x: padding, y: windowHeight - balloonHeight - padding },
                { name: "bottom-right", x: windowWidth - balloonWidth - padding, y: windowHeight - balloonHeight - padding },
            ];

            let closestCorner = corners[0];
            let minDistance = Infinity;

            corners.forEach((corner) => {
                const distance = Math.hypot(newX - corner.x, newY - corner.y);

                if (distance < minDistance) {
                    minDistance = distance;
                    closestCorner = corner;
                }
            });

            balloon.style.left = `${closestCorner.x}px`;
            balloon.style.top = `${closestCorner.y}px`;
            balloon.style.right = "auto";
            balloon.style.bottom = "auto";
            balloon.style.transform = "none";

            this._saveBalloonState("position", closestCorner.name);
        };

        const handleMouseUp = () => {
            if (!isDragging)
                return;

            isDragging = false;
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            balloon.style.cursor = "pointer";
        };

        const handleMouseDown = (event) => {
            if (event.target.closest("#__v_o__balloon_count"))
                return; // Don't drag when clicking count

            isDragging = true;
            balloonRect = balloon.getBoundingClientRect();
            startX = event.clientX - balloonRect.left;
            startY = event.clientY - balloonRect.top;

            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
            balloon.style.cursor = "grabbing";
        };

        balloon.addEventListener("mousedown", handleMouseDown);
    }

    /**
     * Navigates through history using scroll direction.
     * @private
     * @param {number} direction - 1 for forward, -1 for backward
     */
    _navigateHistoryByScroll(direction) {
        if (this.__v_oHistory.length <= 1) {
            return;
        }

        let newIndex = this.__v_oCurrentHistoryIndex + direction;

        // Loop around
        if (newIndex < 0) {
            newIndex = this.__v_oHistory.length - 1;
        } else if (newIndex >= this.__v_oHistory.length) {
            newIndex = 0;
        }

        this._navigateToHistoryItem(newIndex);
    }

    /**
     * Navigates to a specific history item.
     * @private
     * @param {number} index - The index of the history item
     */
    _navigateToHistoryItem(index) {
        if (index < 0 || index >= this.__v_oHistory.length) {
            return;
        }

        // Update the current history index
        this.__v_oCurrentHistoryIndex = index;

        // Update the main overlay to show the current error
        const historyEntry = this.__v_oHistory[index];

        this.__v_oPayload = historyEntry.payload;

        // Re-render the main overlay with the current error
        this._updateOverlayWithHistoryError();

        // Update the layered history display (background layers)
        this._updateHistoryLayersVisibility();

        // Update the history indicator
        this._updateHistoryIndicator();

        // Update history toggle visibility
        this._updateHistoryToggleVisibility();
    }

    /**
     * Renders the layered history overlays behind the current one.
     * @private
     */
    _renderHistoryLayers() {
        if (!this.__v_oHistoryLayers) {
            return;
        }

        // Clear existing layers
        this.__v_oHistoryLayers.innerHTML = "";

        if (this.__v_oHistory.length === 0) {
            return;
        }

        // Create layers for ALL historical errors (including current for positioning)
        this.__v_oHistory.forEach((entry, index) => {
            const layer = this._createHistoryLayer(entry, index);

            if (layer) {
                this.__v_oHistoryLayers.append(layer);
            } else {
                console.warn(`[v-o] Failed to create layer for history index ${index}`);
            }
        });

        this._updateHistoryLayersVisibility();
    }

    /**
     * Restores balloon state and position from localStorage
     * @private
     */
    _restoreBalloonState() {
        try {
            const balloonStates = JSON.parse(localStorage.getItem("v-o-balloon") || "{}");
            const balloon = this.root.querySelector("#__v_o__balloon");
            const rootElement = this.__elements.root;

            if (balloon && rootElement) {
                if (balloonStates.overlay === "open") {
                    rootElement.classList.remove("hidden");
                } else if (balloonStates.overlay === "closed") {
                    rootElement.classList.add("hidden");
                }

                if (balloonStates.position) {
                    const positions = ["top-left", "top-right", "bottom-left", "bottom-right"];

                    if (positions.includes(balloonStates.position)) {
                        balloon.style.top = "";
                        balloon.style.bottom = "";
                        balloon.style.left = "";
                        balloon.style.right = "";
                        balloon.style.transform = "";

                        switch (balloonStates.position) {
                            case "bottom-left": {
                                balloon.style.bottom = "8px";
                                balloon.style.left = "8px";
                                break;
                            }
                            case "bottom-right": {
                                balloon.style.bottom = "8px";
                                balloon.style.right = "8px";
                                break;
                            }
                            case "top-left": {
                                balloon.style.top = "8px";
                                balloon.style.left = "8px";
                                break;
                            }
                            case "top-right": {
                                balloon.style.top = "8px";
                                balloon.style.right = "8px";
                                break;
                            }
                            default: {
                                break;
                            }
                        }
                    }
                }
            }
        } catch {
            // Fail silently if localStorage is not available
        }
    }

    /**
     * Saves balloon state and position to localStorage
     * @private
     * @param {string} key - The state key ('overlay' or 'position')
     * @param {string} value - The state value
     */
    // eslint-disable-next-line class-methods-use-this
    _saveBalloonState(key, value) {
        try {
            const item = localStorage.getItem("v-o-balloon");
            const balloonStates = item ? JSON.parse(item) : {};

            balloonStates[key] = value;

            localStorage.setItem("v-o-balloon", JSON.stringify(balloonStates));
        } catch {
            // Fail silently if localStorage is not available
        }
    }

    /**
     * Toggles the history mode on/off.
     * @private
     */
    _toggleHistoryMode() {
        this.__v_oHistoryEnabled = !this.__v_oHistoryEnabled;
        const { historyIndicator, historyToggle, root } = this.__elements || {};

        if (this.__v_oHistoryEnabled) {
            if (root && typeof root.classList?.add === "function")
                root.classList.add("scrolling-history");

            if (historyIndicator && typeof historyIndicator.classList?.add === "function")
                historyIndicator.classList.add("visible");

            if (historyToggle) {
                historyToggle.style.background = "var(--ono-v-red-orange)";
                historyToggle.style.color = "white";
            }

            this._renderHistoryLayers();
        } else {
            // Jump back to the newest/most recent error when disabling history mode
            if (this.__v_oCurrentHistoryIndex !== 0) {
                this._navigateToHistoryItem(0);
            }

            if (root && typeof root.classList?.remove === "function")
                root.classList.remove("scrolling-history");

            if (historyIndicator && typeof historyIndicator.classList?.add === "function")
                historyIndicator.classList.add("hidden");

            if (historyToggle) {
                historyToggle.style.background = "";
                historyToggle.style.color = "";
            }

            if (this.__v_oHistoryLayers) {
                this.__v_oHistoryLayers.innerHTML = "";
            }
        }
    }

    /**
     * Updates the history indicator in the navigation.
     * @private
     */
    _updateHistoryIndicator() {
        const indicator = this.__elements?.historyIndicator;

        if (!indicator)
            return;

        const countElement = indicator.querySelector("#__v_o__history_count");
        const totalElement = indicator.querySelector("#__v_o__history_total");

        if (!countElement || !totalElement)
            return;

        if (this.__v_oHistory.length <= 1) {
            indicator.classList.add("hidden");

            return;
        }

        countElement.textContent = (this.__v_oCurrentHistoryIndex + 1).toString();
        totalElement.textContent = this.__v_oHistory.length.toString();
        indicator.classList.remove("hidden");
    }

    /**
     * Updates the visibility and positioning of history layers.
     * @private
     */
    _updateHistoryLayersVisibility() {
        if (!this.__v_oHistoryLayers) {
            return;
        }

        const layers = this.__v_oHistoryLayers.querySelectorAll(".history-overlay-layer");
        const currentIndex = this.__v_oCurrentHistoryIndex;

        layers.forEach((layer) => {
            const historyIndex = Number.parseInt(layer.dataset.historyIndex);
            const relativePosition = historyIndex - currentIndex;

            // Remove all position classes
            layer.classList.remove("active", "behind", "in-front", "far-behind", "far-in-front", "very-far-behind", "very-far-in-front", "hidden");

            // Apply appropriate class based on relative position
            switch (relativePosition) {
                case -3: {
                    // Three steps in front
                    layer.classList.add("very-far-in-front");

                    break;
                }
                case -2: {
                    // Two steps in front
                    layer.classList.add("far-in-front");

                    break;
                }
                case -1: {
                    // Previous error in history (in front of current)
                    layer.classList.add("in-front");

                    break;
                }
                case 0: {
                    // Current error - hide this layer as it's shown in main overlay
                    layer.classList.add("hidden");

                    break;
                }
                case 1: {
                    // Next error in history (behind current)
                    layer.classList.add("behind");

                    break;
                }
                case 2: {
                    // Two steps behind
                    layer.classList.add("far-behind");

                    break;
                }
                case 3: {
                    // Three steps behind
                    layer.classList.add("very-far-behind");

                    break;
                }
                default: {
                    // Too far away
                    layer.classList.add("hidden");
                }
            }
        });

        this._updateHistoryIndicator();
        this._updateHistoryToggleVisibility();
    }

    /**
     * Updates the visibility of the history toggle button based on history length.
     * @private
     */
    _updateHistoryToggleVisibility() {
        const toggleButton = this.__elements?.historyToggle;

        if (!toggleButton)
            return;

        toggleButton.style.display = this.__v_oHistory.length <= 1 ? "none" : "";
    }

    /**
     * Updates the overlay content with a historical error.
     * @private
     */
    _updateOverlayWithHistoryError() {
        // Trigger pagination update to refresh the overlay
        if (typeof this._updatePagination === "function") {
            this._updatePagination();
        }

        // Update all overlay content with the current historical error
        if (this.__v_oPayload && this.__v_oPayload.errors && this.__v_oPayload.errors.length > 0) {
            const currentError = this.__v_oPayload.errors[0];

            // Update heading
            if (this.__elements.heading) {
                this.__elements.heading.textContent = currentError.name || "Error";
            }

            // Update file link
            if (this.__elements.fileButton) {
                const relativePath = this._getRelativePath(currentError.originalFilePath || "");
                const errorLine = currentError.originalFileLine ? `:${currentError.originalFileLine}` : "";

                this.__elements.fileButton.textContent = `${relativePath}${errorLine}`;
            }

            // Update error message
            if (this.__elements.message) {
                this.__elements.message.textContent = currentError.message || "Unknown error";
            }

            // Update stack trace
            if (this.__elements.stackElement) {
                this.__elements.stackElement.textContent = this._escapeHtml(currentError.stack || "No stack trace available");
            }

            // Update code frame
            if (this.__elements.overlay) {
                const codeFrame
                    = currentError.originalCodeFrameContent
                        || currentError.compiledCodeFrameContent
                        || "<div class=\"no-code-frame font-mono\">No code frame could be generated.</div>";

                this.__elements.overlay.innerHTML = codeFrame;
            }
        }
    }

    /**
     * Closes the error overlay dialog (hides it).
     */
    close() {
        if (this.parentNode) {
            const root = this.__elements?.root;

            if (root && typeof root.classList?.add === "function") {
                root.classList.add("hidden");

                this._saveBalloonState("overlay", "closed");
            }

            // Don't remove the overlay - just hide it so it can be reopened
        }
    }

    /**
     * Updates the overlay content with the current error's code frame.
     */
    updateOverlay() {
        const currentError = this.__v_oPayload?.errors?.[0];

        if (!currentError)
            return;

        // Reopen overlay if it's hidden when new errors occur
        const root = this.__elements?.root;

        if (root && root.classList.contains("hidden")) {
            root.classList.remove("hidden");

            this._saveBalloonState("overlay", "open");
        }

        // Update code frame
        const overlay = this.__elements?.overlay;

        if (overlay) {
            overlay.innerHTML = currentError.originalCodeFrameContent || currentError.compiledCodeFrameContent || "";
        }

        // Always add errors to history (no deduplication) to show error frequency
        const currentErrorId = this._generateErrorId(currentError);
        const historyEntry = {
            column: currentError.originalFileColumn || 0,
            errorType: this.__v_oPayload.errorType || "client",
            file: currentError.originalFilePath || "",
            id: currentErrorId,
            line: currentError.originalFileLine || 0,
            message: currentError.message || "",
            name: currentError.name || "Error",
            payload: { ...this.__v_oPayload, errors: [currentError] },
            timestamp: Date.now(),
        };

        // Always add new error to history (no deduplication to show frequency)
        this.__v_oHistory.unshift(historyEntry);
        this.__v_oCurrentHistoryIndex = 0;

        // Limit history to 50 entries
        if (this.__v_oHistory.length > 50) {
            this.__v_oHistory.length = 50;
        }

        this._renderHistoryLayers();
        this._updateHistoryToggleVisibility();
    }
}
