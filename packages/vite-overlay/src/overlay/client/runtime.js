/* eslint-disable no-bitwise */
/* eslint-disable class-methods-use-this */
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

    static COPY_SUCCESS_DELAY = 2000;

    static DRAG_THRESHOLD = 5;

    // Constants
    static HISTORY_LIMIT = 50;

    static LOADING_DELAY = 100;

    static SCROLL_PADDING = 8;

    static WHEEL_TIMEOUT = 100;

    // Cached DOM elements for performance
    __elements = {};

    // Event listeners for cleanup
    __eventListeners = new Map();

    // Core state
    __v_oCurrentHistoryIndex = -1;

    __v_oHistoryEnabled = false;

    __v_oMode;

    __v_oPayload;

    __v_oScrollTimeout = undefined;

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
            if (typeof previous._cleanupEventListeners === "function") {
                previous._cleanupEventListeners();
            }

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
        this._initializeBalloon(this.__v_oPayload.errors.length);
        this._restoreBalloonState();
        this._initializeCopyError();
        this._initializePagination();
        this._initializeHistory();

        if (this.__v_oPayload.solution) {
            this._injectSolution(this.__v_oPayload.solution);
        }

        this._hideLoadingStates();

        const editorSelect = this.root.querySelector("#editor-selector");

        if (editorSelect) {
            const saved = localStorage.getItem("vo:editor");

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
            this._addEventListener(document, "keydown", (event) => {
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

        // Limit history to prevent memory issues
        if (this.__v_oHistory.length > ErrorOverlay.HISTORY_LIMIT) {
            this.__v_oHistory = this.__v_oHistory.slice(0, ErrorOverlay.HISTORY_LIMIT);
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
            historyLayerDepth: root.querySelector("#__v_o__history_layer_depth"),
            historyTimestamp: root.querySelector("#__v_o__history_timestamp"),
            historyToggle: root.querySelector("#__v_o__history_toggle"),
            message: root.querySelector(String.raw`.text-sm.text-\[var\(--ono-v-red-orange\)\].font-mono.bg-\[var\(--ono-v-surface-muted\)\]`),
            nextButton: root.querySelector("#__v_o__error-overlay-pagination-next"),
            overlay: root.querySelector("#__v_o__overlay"),
            paginationCurrent: root.querySelector("#__v_o__pagination_current"),
            paginationTotal: root.querySelector("#__v_o__pagination_total"),
            previousButton: root.querySelector("#__v_o__error-overlay-pagination-previous"),
            root: root.querySelector("#__v_o__root"),
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
            hash = ((hash << 5) - hash + key.codePointAt(index)) & 0xff_ff_ff_ff;
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
        const hideElement = (selector) => {
            const element = this.root.querySelector(selector);

            if (element) {
                element.style.display = "none";
            }
        };

        const showElement = (selector) => {
            const element = this.root.querySelector(selector);

            if (element) {
                element.classList.remove("hidden");
            }
        };

        setTimeout(() => {
            hideElement("#__v_o__header_loader");
            showElement("#__v_o__title");
            hideElement("#__v_o__message_loader");
            showElement("#__v_o__message");
            hideElement("#__v_o__body_loader");
            showElement("#__v_o__overlay");
        }, ErrorOverlay.LOADING_DELAY);
    }

    /**
     * Initializes the floating balloon button that shows the error count
     * and toggles the overlay open/close when clicked.
     * @private
     * @param {number} total - The total number of errors to display
     */
    _initializeBalloon(total) {
        const { balloon, balloonCount, balloonText, root } = this.__elements || {};

        if (!balloon || !balloonCount || !root) {
            return;
        }

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
                }, ErrorOverlay.COPY_SUCCESS_DELAY);
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
                }, ErrorOverlay.COPY_SUCCESS_DELAY);
            }
        });
    }

    /**
     * Initializes the layered error history functionality with Mac Time Machine-like scrolling.
     * @private
     */
    _initializeHistory() {
        this._addCurrentErrorToHistory();
        this._initializeHistoryToggle();
        this._initializeScrollNavigation();
        this._updateHistoryToggleVisibility();
    }

    /**
     * Initializes the history toggle button.
     * @private
     */
    _initializeHistoryToggle() {
        const toggleButton = this.__elements.historyToggle;

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
        const errors = Array.isArray(this.__v_oPayload.errors) && this.__v_oPayload.errors.length > 0 ? this.__v_oPayload.errors : [];
        const errorIds = errors.map((error) =>
            String(error.__id || [error.originalFilePath || "", error.originalFileLine || 0, error.name || "", error.message || ""].join("|")),
        );

        // Store current index on the instance so it can be reset when navigating history
        this.__v_oCurrentErrorIndex = 0;

        const updateOverlayContent = () => {
            const mount = this.root.querySelector("#__v_o__overlay");

            if (!mount) {
                return;
            }

            const currentError = this.__v_oPayload.errors[this.__v_oCurrentErrorIndex] || {
                compiledStack: this.__v_oPayload.compiledStack,
                message: this.__v_oPayload.message,
                name: this.__v_oPayload.name,
                originalStack: this.__v_oPayload.originalStack,
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

                        if (!isHttpLink && this.__v_oPayload.rootPath && fullPath.startsWith(this.__v_oPayload.rootPath)) {
                            displayPath = fullPath.slice(this.__v_oPayload.rootPath.length);

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
                    const stackText
                        = mode === "compiled"
                            ? String(currentError.compiledStack || this.__v_oPayload.compiledStack || currentError.stack || "")
                            : String(currentError.originalStack || currentError.stack || this.__v_oPayload.originalStack || this.__v_oPayload.stack || "");

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
                headingElement.dataset.errorId = errorIds[this.__v_oCurrentErrorIndex] || "";
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

                // Try current error's code frame first
                if (mode === "compiled" && currentError.compiledCodeFrameContent) {
                    codeFrame = currentError.compiledCodeFrameContent;
                } else if (currentError.originalCodeFrameContent) {
                    codeFrame = currentError.originalCodeFrameContent;
                } else {
                    // For cause errors that don't have their own code frames,
                    // fall back to the primary error's code frame
                    const primaryError = errors[0] || currentError;

                    if (mode === "compiled" && primaryError.compiledCodeFrameContent) {
                        codeFrame = primaryError.compiledCodeFrameContent;
                    } else if (primaryError.originalCodeFrameContent) {
                        codeFrame = primaryError.originalCodeFrameContent;
                    }
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

        const updatePagination = (index) => {
            // Update the current error index if provided
            if (typeof index === "number") {
                const maxIndex = (this.__v_oPayload?.errors?.length || 1) - 1;

                this.__v_oCurrentErrorIndex = Math.max(0, Math.min(index, maxIndex));
            }

            const currentTotalErrors = this.__v_oPayload?.errors?.length;
            const { nextButton, paginationCurrent, paginationTotal, previousButton } = this.__elements;

            if (paginationCurrent) {
                paginationCurrent.textContent = (this.__v_oCurrentErrorIndex + 1).toString();
            }

            if (paginationTotal) {
                paginationTotal.textContent = currentTotalErrors.toString();
            }

            if (previousButton) {
                previousButton.disabled = this.__v_oCurrentErrorIndex === 0;
                previousButton.setAttribute("aria-disabled", this.__v_oCurrentErrorIndex === 0);
            }

            if (nextButton) {
                nextButton.disabled = this.__v_oCurrentErrorIndex >= (currentTotalErrors || 0) - 1;
                nextButton.setAttribute("aria-disabled", this.__v_oCurrentErrorIndex >= (currentTotalErrors || 0) - 1);
            }

            updateOverlayContent();
        };

        // Store the updatePagination function for use by history navigation
        this._updatePagination = updatePagination;

        const { nextButton, previousButton } = this.__elements;

        if (previousButton) {
            previousButton.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();

                if (this.__v_oCurrentErrorIndex > 0) {
                    this.__v_oCurrentErrorIndex--;
                    updatePagination();
                }
            });
        }

        if (nextButton) {
            nextButton.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();

                if (this.__v_oCurrentErrorIndex < (this.__v_oPayload?.errors?.length || 0) - 1) {
                    this.__v_oCurrentErrorIndex++;
                    updatePagination();
                }
            });
        }

        const selectById = (id) => {
            const index = errorIds.indexOf(String(id || ""));

            if (index !== -1) {
                this.__v_oCurrentErrorIndex = index;
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
            if (Math.abs(event.deltaY) < ErrorOverlay.DRAG_THRESHOLD)
                return;

            const scrollDirection = event.deltaY > 0 ? 1 : -1;

            this._navigateHistoryByScroll(scrollDirection);
        };

        // Add wheel event listener - attach to the shadow root for better event capture
        this._addEventListener(this.root, "wheel", handleWheel, { passive: false });

        // Also add to the main overlay element
        this._addEventListener(rootElement, "wheel", handleWheel, { passive: false });

        // Also add to the backdrop for better coverage
        const backdrop = this.root.querySelector("#__v_o__backdrop");

        if (backdrop) {
            this._addEventListener(backdrop, "wheel", handleWheel, { passive: false });
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

        // Function to detect scrollbar visibility
        const hasScrollbar = () => {
            const hasVerticalScrollbar = document.body.scrollHeight > window.innerHeight;
            const hasHorizontalScrollbar = document.body.scrollWidth > window.innerWidth;

            return { horizontal: hasHorizontalScrollbar, vertical: hasVerticalScrollbar };
        };

        // Function to get viewport dimensions accounting for scrollbars
        const getViewportDimensions = () => {
            const scrollbarInfo = hasScrollbar();
            const scrollbarWidth = scrollbarInfo.vertical ? window.innerWidth - document.documentElement.clientWidth : 0;
            const scrollbarHeight = scrollbarInfo.horizontal ? window.innerHeight - document.documentElement.clientHeight : 0;

            return {
                height: window.innerHeight - scrollbarHeight,
                width: window.innerWidth - scrollbarWidth,
            };
        };

        const handleMouseMove = (event) => {
            if (!isDragging)
                return;

            const viewport = getViewportDimensions();
            const balloonWidth = balloonRect.width;
            const balloonHeight = balloonRect.height;

            const newX = event.clientX - startX;
            const newY = event.clientY - startY;

            const padding = ErrorOverlay.SCROLL_PADDING;
            const corners = [
                { name: "top-left", x: padding, y: padding },
                { name: "top-right", x: viewport.width - balloonWidth - padding, y: padding },
                { name: "bottom-left", x: padding, y: viewport.height - balloonHeight - padding },
                { name: "bottom-right", x: viewport.width - balloonWidth - padding, y: viewport.height - balloonHeight - padding },
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

            // Use inset for smooth dragging during movement
            balloon.style.inset = `${closestCorner.y}px auto auto ${closestCorner.x}px`;
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
            if (event.target.closest("#__v_o__balloon_count")) {
                return; // Don't drag when clicking count
            }

            isDragging = true;
            balloonRect = balloon.getBoundingClientRect();
            startX = event.clientX - balloonRect.left;
            startY = event.clientY - balloonRect.top;

            this._addEventListener(document, "mousemove", handleMouseMove);
            this._addEventListener(document, "mouseup", handleMouseUp);

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

        // Update payload to the history entry's data
        const historyEntry = this.__v_oHistory[index];

        this.__v_oPayload = historyEntry.payload;

        // Re-render the main overlay with the current error
        this._updateOverlayWithHistoryError();

        // Update the history indicator
        this._updateHistoryIndicator();

        // Update history toggle visibility
        this._updateHistoryToggleVisibility();

        // Update main overlay timestamp when in history mode
        if (this.__v_oHistoryEnabled) {
            this._updateMainOverlayTimestamp();
        }
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

                        const positionStyles = {
                            "bottom-left": { bottom: "8px", left: "8px" },
                            "bottom-right": { bottom: "8px", right: "8px" },
                            "top-left": { left: "8px", top: "8px" },
                            "top-right": { right: "8px", top: "8px" },
                        };

                        const styles = positionStyles[balloonStates.position];

                        if (styles) {
                            Object.assign(balloon.style, styles);
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

        const { historyIndicator, historyLayerDepth, historyToggle, root } = this.__elements || {};

        if (this.__v_oHistoryEnabled) {
            if (root && typeof root.classList?.add === "function")
                root.classList.add("scrolling-history");

            if (historyIndicator && typeof historyIndicator.classList?.add === "function") {
                historyIndicator.classList.remove("hidden");
            }

            if (historyToggle) {
                historyToggle.style.background = "var(--ono-v-red-orange)";
                historyToggle.style.color = "white";
            }

            if (historyLayerDepth && typeof historyLayerDepth.classList?.add === "function") {
                historyLayerDepth.classList.remove("opacity-0");
                historyLayerDepth.classList.add("opacity-100");
            }

            this._updateHistoryIndicator();
            this._updateMainOverlayTimestamp();
        } else {
            // Reset to newest error when disabling history mode
            this.__v_oCurrentHistoryIndex = 0;
            const newestError = this.__v_oHistory[0];

            if (newestError) {
                this.__v_oPayload = newestError.payload;
            }

            // Re-render the main overlay with the newest error
            this._updateOverlayWithHistoryError();

            if (root && typeof root.classList?.remove === "function")
                root.classList.remove("scrolling-history");

            if (historyIndicator && typeof historyIndicator.classList?.add === "function")
                historyIndicator.classList.add("hidden");

            if (historyToggle) {
                historyToggle.style.background = "";
                historyToggle.style.color = "";
            }

            if (historyLayerDepth && typeof historyLayerDepth.classList?.add === "function") {
                historyLayerDepth.classList.remove("opacity-100");
                historyLayerDepth.classList.add("opacity-0");
            }

            const timeElement = this.__elements.historyTimestamp;

            if (timeElement) {
                timeElement.classList.add("hidden");
            }
        }
    }

    /**
     * Updates the history indicator in the navigation.
     * @private
     */
    _updateHistoryIndicator() {
        const indicator = this.__elements?.historyIndicator;

        if (!indicator) {
            return;
        }

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
     * Updates the visibility of the history toggle button based on history length.
     * @private
     */
    _updateHistoryToggleVisibility() {
        const toggleButton = this.__elements?.historyToggle;

        if (!toggleButton) {
            return;
        }

        toggleButton.style.display = this.__v_oHistory.length <= 1 ? "none" : "";
    }

    /**
     * Updates the main overlay's timestamp on the right notch when in history mode.
     * @private
     */
    _updateMainOverlayTimestamp() {
        const historyEntry = this.__v_oHistory[this.__v_oCurrentHistoryIndex];

        // Update timestamp on right notch
        const timeElement = this.__elements.historyTimestamp;

        if (timeElement && historyEntry) {
            timeElement.classList.remove("hidden");
            // the span inside the time element
            const span = timeElement.querySelector("span");

            if (span) {
                span.textContent = new Date(historyEntry.timestamp).toLocaleString("en-US", {
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    month: "2-digit",
                    second: "2-digit",
                    timeZone: "UTC",
                    year: "numeric",
                });
            }
        }
    }

    /**
     * Updates the overlay content with a historical error.
     * @private
     */
    _updateOverlayWithHistoryError() {
        // Reset current error index to first error when switching to historical error
        this.__v_oCurrentErrorIndex = 0;

        // Trigger pagination update to refresh the overlay (reset to first cause error)
        // This will call updateOverlayContent() which updates all the UI elements
        if (typeof this._updatePagination === "function") {
            this._updatePagination(0);
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
        if (this.root && this.root.classList.contains("hidden")) {
            this.root.classList.remove("hidden");

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
            payload: { ...this.__v_oPayload }, // Preserve full payload including all cause errors
            stack: currentError.stack || currentError.originalStack || "",
            timestamp: Date.now(),
        };

        // Always add new error to history (no deduplication to show frequency)
        this.__v_oHistory.unshift(historyEntry);
        this.__v_oCurrentHistoryIndex = 0;

        // Update current payload to the newest error
        this.__v_oPayload = historyEntry.payload;

        // Limit history to prevent memory issues
        if (this.__v_oHistory.length > ErrorOverlay.HISTORY_LIMIT) {
            this.__v_oHistory.length = ErrorOverlay.HISTORY_LIMIT;
        }

        this._updateHistoryToggleVisibility();
    }
}
