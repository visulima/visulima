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

    __v_oMode;

    __v_oPayload;

    __v_oHistory = [];

    __v_oHistoryLayers = null;

    __v_oCurrentHistoryIndex = -1;

    __v_oHistoryEnabled = false;

    __v_oScrollTimeout = null;

    /**
     * Creates a new ErrorOverlay instance.
     * @param {VisulimaViteOverlayErrorPayload} error - The error payload to display
     */
    constructor(error) {
        super();

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
                    // Close history panel if open, otherwise close overlay
                    if (this.__v_oHistoryPanel && !this.__v_oHistoryPanel.classList.contains('hidden')) {
                        this._closeHistoryPanel();
                    } else {
                        this.close();
                    }
                }
                
                // History mode keyboard navigation
                if (this.__v_oHistoryEnabled && this.__v_oHistory.length > 1) {
                    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
                        event.preventDefault();
                        this._navigateHistoryByScroll(-1);
                    } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
                        event.preventDefault();
                        this._navigateHistoryByScroll(1);
                    } else if (event.key === "Home") {
                        event.preventDefault();
                        this._navigateToHistoryItem(0);
                    } else if (event.key === "End") {
                        event.preventDefault();
                        this._navigateToHistoryItem(this.__v_oHistory.length - 1);
                    } else if (event.key === "h" || event.key === "H") {
                        event.preventDefault();
                        this._toggleHistoryMode();
                    }
                }
            });
        }
    }

    /**
     * Initializes the layered error history functionality with Mac Time Machine-like scrolling.
     * @private
     */
    _initializeHistory() {
        this._loadHistoryFromStorage();
        this._addCurrentErrorToHistory();
        this._initializeHistoryLayers();
        this._initializeHistoryToggle();
        this._initializeScrollNavigation();
    }

    /**
     * Loads error history from localStorage.
     * @private
     */
    _loadHistoryFromStorage() {
        try {
            const stored = localStorage.getItem("v-o-error-history");
            if (stored) {
                this.__v_oHistory = JSON.parse(stored);
            }
        } catch (error) {
            console.warn("[v-o] Failed to load error history:", error);
            this.__v_oHistory = [];
        }
    }

    /**
     * Saves error history to localStorage.
     * @private
     */
    _saveHistoryToStorage() {
        try {
            localStorage.setItem("v-o-error-history", JSON.stringify(this.__v_oHistory));
        } catch (error) {
            console.warn("[v-o] Failed to save error history:", error);
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
            id: this._generateErrorId(currentError),
            timestamp: Date.now(),
            errorType: this.__v_oPayload.errorType || "client",
            name: currentError.name || "Error",
            message: currentError.message || "",
            file: currentError.originalFilePath || "",
            line: currentError.originalFileLine || 0,
            column: currentError.originalFileColumn || 0,
            payload: this.__v_oPayload
        };

        // Check if this error already exists in history (avoid duplicates)
        const existingIndex = this.__v_oHistory.findIndex(entry => entry.id === historyEntry.id);
        if (existingIndex !== -1) {
            // Update timestamp for existing error
            this.__v_oHistory[existingIndex].timestamp = historyEntry.timestamp;
            this.__v_oCurrentHistoryIndex = existingIndex;
        } else {
            // Add new error to history
            this.__v_oHistory.unshift(historyEntry);
            this.__v_oCurrentHistoryIndex = 0;
        }

        // Limit history to 50 entries to prevent memory issues
        if (this.__v_oHistory.length > 50) {
            this.__v_oHistory = this.__v_oHistory.slice(0, 50);
        }

        this._saveHistoryToStorage();
    }

    /**
     * Generates a unique ID for an error based on its properties.
     * @private
     * @param {Object} error - The error object
     * @returns {string} A unique identifier for the error
     */
    _generateErrorId(error) {
        const key = [
            error.name || "",
            error.message || "",
            error.originalFilePath || "",
            error.originalFileLine || 0,
            error.originalFileColumn || 0
        ].join("|");
        
        // Simple hash function
        let hash = 0;
        for (let i = 0; i < key.length; i++) {
            const char = key.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Initializes the layered history system.
     * @private
     */
    _initializeHistoryLayers() {
        this.__v_oHistoryLayers = this.root.querySelector("#__v_o__history_layers");
        if (!this.__v_oHistoryLayers) {
            return;
        }

        this._renderHistoryLayers();
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
        this.__v_oHistoryLayers.innerHTML = '';

        if (this.__v_oHistory.length === 0) {
            return;
        }

        // Create layers for each historical error (excluding current)
        this.__v_oHistory.forEach((entry, index) => {
            if (index === this.__v_oCurrentHistoryIndex) {
                return; // Skip current error as it's already displayed
            }

            const layer = this._createHistoryLayer(entry, index);
            this.__v_oHistoryLayers.appendChild(layer);
        });

        this._updateHistoryLayersVisibility();
    }

    /**
     * Creates a single history layer element.
     * @private
     * @param {Object} entry - The history entry
     * @param {number} index - The index in history
     * @returns {HTMLElement} The layer element
     */
    _createHistoryLayer(entry, index) {
        const layer = document.createElement('div');
        layer.className = 'history-overlay-layer';
        layer.dataset.historyIndex = index;
        layer.dataset.errorId = entry.id;

        const timeAgo = this._formatTimeAgo(entry.timestamp);
        const preview = this._truncateText(entry.message, 100);
        const relativePath = this._getRelativePath(entry.file);

        layer.innerHTML = `
            <div class="history-overlay-content">
                <div class="history-overlay-header">
                    <div class="history-overlay-title">
                        <span class="history-overlay-type ${entry.errorType}">${entry.errorType}</span>
                        <span>${this._escapeHtml(entry.name)}</span>
                    </div>
                    <div class="history-overlay-timestamp">${timeAgo}</div>
                </div>
                <div class="history-overlay-body">
                    <div class="history-overlay-message">${this._escapeHtml(entry.message)}</div>
                    ${entry.file ? `<div class="history-overlay-file">${this._escapeHtml(relativePath)}${entry.line ? `:${entry.line}` : ''}</div>` : ''}
                    <div class="history-overlay-preview">${this._escapeHtml(preview)}</div>
                </div>
            </div>
        `;

        return layer;
    }

    /**
     * Updates the visibility and positioning of history layers.
     * @private
     */
    _updateHistoryLayersVisibility() {
        if (!this.__v_oHistoryLayers) {
            return;
        }

        const layers = this.__v_oHistoryLayers.querySelectorAll('.history-overlay-layer');
        const currentIndex = this.__v_oCurrentHistoryIndex;

        layers.forEach((layer, layerIndex) => {
            const historyIndex = parseInt(layer.dataset.historyIndex);
            const distanceFromCurrent = Math.abs(historyIndex - currentIndex);

            // Remove all position classes
            layer.classList.remove('active', 'behind', 'far-behind', 'very-far-behind', 'hidden');

            // Apply appropriate class based on distance
            if (distanceFromCurrent === 0) {
                layer.classList.add('active');
            } else if (distanceFromCurrent === 1) {
                layer.classList.add('behind');
            } else if (distanceFromCurrent === 2) {
                layer.classList.add('far-behind');
            } else if (distanceFromCurrent === 3) {
                layer.classList.add('very-far-behind');
            } else {
                layer.classList.add('hidden');
            }
        });

        this._updateHistoryIndicator();
    }

    /**
     * Formats a timestamp as a human-readable "time ago" string.
     * @private
     * @param {number} timestamp - The timestamp to format
     * @returns {string} Formatted time string
     */
    _formatTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    }

    /**
     * Truncates text to a specified length with ellipsis.
     * @private
     * @param {string} text - The text to truncate
     * @param {number} maxLength - Maximum length
     * @returns {string} Truncated text
     */
    _truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }

    /**
     * Escapes HTML special characters.
     * @private
     * @param {string} text - The text to escape
     * @returns {string} Escaped text
     */
    _escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Gets a relative path from a full file path.
     * @private
     * @param {string} filePath - The full file path
     * @returns {string} Relative path
     */
    _getRelativePath(filePath) {
        if (!filePath) return '';
        const rootPath = this.__v_oPayload?.rootPath || '';
        if (rootPath && filePath.startsWith(rootPath)) {
            return filePath.slice(rootPath.length).replace(/^\//, '');
        }
        return filePath;
    }

    /**
     * Initializes scroll-based navigation for the layered history system.
     * @private
     */
    _initializeScrollNavigation() {
        const rootElement = this.root.querySelector("#__v_o__root");
        if (!rootElement) {
            return;
        }

        let isScrolling = false;
        let scrollDirection = 0;

        const handleWheel = (event) => {
            if (!this.__v_oHistoryEnabled || this.__v_oHistory.length <= 1) {
                return;
            }

            event.preventDefault();
            
            // Determine scroll direction
            const delta = event.deltaY;
            if (Math.abs(delta) < 10) {
                return; // Ignore small scroll movements
            }

            scrollDirection = delta > 0 ? 1 : -1;
            
            if (isScrolling) {
                return; // Prevent rapid scrolling
            }

            isScrolling = true;
            this._navigateHistoryByScroll(scrollDirection);
            
            // Reset scrolling flag after animation
            setTimeout(() => {
                isScrolling = false;
            }, 300);
        };

        rootElement.addEventListener('wheel', handleWheel, { passive: false });
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

        const historyEntry = this.__v_oHistory[index];
        this.__v_oCurrentHistoryIndex = index;
        
        // Update the current payload with the historical error
        this.__v_oPayload = historyEntry.payload;
        
        // Re-render the overlay with the historical error
        this._updateOverlayWithHistoryError();
        
        // Update the layered history display
        this._updateHistoryLayersVisibility();
        
        // Show scroll hint briefly
        this._showScrollHint();
    }

    /**
     * Updates the overlay content with a historical error.
     * @private
     */
    _updateOverlayWithHistoryError() {
        // Trigger pagination update to refresh the overlay
        if (typeof this._updatePagination === 'function') {
            this._updatePagination();
        }
        
        // Force re-render of the overlay content
        const mount = this.root.querySelector("#__v_o__overlay");
        if (mount && this.__v_oPayload && this.__v_oPayload.errors && this.__v_oPayload.errors.length > 0) {
            const currentError = this.__v_oPayload.errors[0];
            const codeFrame = currentError.originalCodeFrameContent || currentError.compiledCodeFrameContent || 
                '<div class="no-code-frame font-mono">No code frame could be generated.</div>';
            mount.innerHTML = codeFrame;
        }
    }

    /**
     * Updates the history indicator in the navigation.
     * @private
     */
    _updateHistoryIndicator() {
        const indicator = this.root.querySelector("#__v_o__history_indicator");
        const countElement = this.root.querySelector("#__v_o__history_count");
        const totalElement = this.root.querySelector("#__v_o__history_total");

        if (!indicator || !countElement || !totalElement) {
            return;
        }

        if (this.__v_oHistory.length <= 1) {
            indicator.classList.add('hidden');
            return;
        }

        countElement.textContent = (this.__v_oCurrentHistoryIndex + 1).toString();
        totalElement.textContent = this.__v_oHistory.length.toString();
        indicator.classList.remove('hidden');
    }

    /**
     * Shows a brief scroll hint animation.
     * @private
     */
    _showScrollHint() {
        const indicator = this.root.querySelector("#__v_o__history_indicator");
        if (!indicator) {
            return;
        }

        indicator.classList.add('history-scroll-hint');
        
        setTimeout(() => {
            indicator.classList.remove('history-scroll-hint');
        }, 2000);
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

        toggleButton.addEventListener('click', (event) => {
            event.preventDefault();
            this._toggleHistoryMode();
        });
    }

    /**
     * Toggles the history mode on/off.
     * @private
     */
    _toggleHistoryMode() {
        this.__v_oHistoryEnabled = !this.__v_oHistoryEnabled;
        
        const rootElement = this.root.querySelector("#__v_o__root");
        const indicator = this.root.querySelector("#__v_o__history_indicator");
        
        if (this.__v_oHistoryEnabled) {
            rootElement.classList.add('scrolling-history');
            if (indicator) {
                indicator.classList.add('visible');
            }
            this._renderHistoryLayers();
            this._showScrollHint();
        } else {
            rootElement.classList.remove('scrolling-history');
            if (indicator) {
                indicator.classList.add('hidden');
            }
            if (this.__v_oHistoryLayers) {
                this.__v_oHistoryLayers.innerHTML = '';
            }
        }
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
     * The balloon is already present in the DOM template.
     * @private
     * @param {number} total - The total number of errors to display
     */
    _initializeBalloon(total) {
        try {
            const balloon = this.root.querySelector("#__v_o__balloon");
            const countElement = this.root.querySelector("#__v_o__balloon_count");
            const rootElement = this.root.querySelector("#__v_o__root");
            const textElement = this.root.querySelector("#__v_o__balloon_text");

            if (balloon && countElement) {
                countElement.textContent = total.toString();

                if (textElement) {
                    textElement.textContent = total === 1 ? "Error" : "Errors";
                }

                this._restoreBalloonState();

                balloon.classList.toggle("hidden", total <= 0);

                const clickHandler = (event) => {
                    event.preventDefault();

                    const classes = rootElement.classList;

                    if (classes.contains("hidden")) {
                        classes.remove("hidden");
                        this._saveBalloonState("overlay", "open");
                    } else {
                        classes.add("hidden");
                        this._saveBalloonState("overlay", "closed");
                    }
                };

                this._makeBalloonDraggable(balloon);

                balloon.addEventListener("click", clickHandler);
            }
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
     * Initializes the theme toggle functionality for switching between light and dark modes.
     * @private
     */
    _initializeThemeToggle() {
        const savedTheme = localStorage.getItem("__v-o__theme");
        const systemPrefersDark = globalThis.matchMedia && globalThis.matchMedia("(prefers-color-scheme: dark)").matches;
        const currentTheme = savedTheme || (systemPrefersDark ? "dark" : "light");

        const isDark = currentTheme === "dark";

        const rootElement = this.root.querySelector("#__v_o__root");
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
     * Restores balloon state and position from localStorage
     * @private
     */
    _restoreBalloonState() {
        try {
            const balloonStates = JSON.parse(localStorage.getItem("v-o-balloon") || "{}");
            const balloon = this.root.querySelector("#__v_o__balloon");
            const rootElement = this.root.querySelector("#__v_o__root");

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
     * Removes the error overlay from the DOM.
     */
    close() {
        if (this.parentNode) {
            const balloon = this.root.querySelector("#__v_o__balloon");

            if (balloon) {
                const rootElement = this.root.querySelector("#__v_o__root");

                rootElement.classList.add("hidden");

                this._saveBalloonState("overlay", "closed");
            } else {
                this.remove();
            }
        }
    }

    /**
     * Updates the overlay content with the current error's code frame.
     */
    updateOverlay() {
        const currentIndex = 0;

        const currentError = this.__v_oPayload && this.__v_oPayload.errors && this.__v_oPayload.errors[currentIndex];

        if (currentError) {
            const flameOverlay = this.root.querySelector("#__v_o__overlay");

            if (flameOverlay) {
                const html = currentError.originalCodeFrameContent || currentError.compiledCodeFrameContent || "";

                flameOverlay.innerHTML = html;
            }
        }
    }
}
