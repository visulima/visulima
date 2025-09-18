/* eslint-disable no-unsanitized/property */
/* eslint-disable no-underscore-dangle */
/* eslint-disable func-names */
/* eslint-disable no-plusplus */
// @ts-nocheck
class ErrorOverlay extends HTMLElement {
    /**
     * @typedef {import('../types').VisulimaViteOverlayErrorPayload} VisulimaViteOverlayErrorPayload
     */

    /**
     * The current mode for displaying error information ('original' | 'compiled')
     * @type {string}
     */
    __flameMode;

    /**
     * The error payload containing all error information
     * @type {VisulimaViteOverlayErrorPayload}
     */
    __flamePayload;

    /**
     * Original body overflow value for restoring scroll
     * @type {string}
     */
    #originalBodyOverflow = "";

    /**
     * Original html overflow value for restoring scroll
     * @type {string}
     */
    #originalHtmlOverflow = "";

    /**
     * Creates an error overlay component
     * @param {object} error - The error object in one of three possible structures:
     *
     * Structure 1 - Direct Vite server error:
     * @param {Array} error.errors - Array of processed error objects
     * @param {"client"|"server"} error.errorType - The error type
     *
     * Structure 2 - Browser ErrorEvent:
     * @param {string} error.message - The error message
     * @param {string} error.name - The error name/type
     * @param {string} error.stack - The error stack trace
     * @param {number} [error.lineno] - Line number where error occurred
     * @param {number} [error.colno] - Column number where error occurred
     * @param {string} [error.source] - Source URL where error occurred
     */
    constructor(error) {
        super();

        this.root = this.attachShadow({ mode: "open" });
        // eslint-disable-next-line no-undef
        this.root.innerHTML = overlayTemplate;
        this.dir = "ltr";

        // Store reference to the element for external access
        this.element = this;

        // Store reference to this instance for pagination component
        this.root.host._errorOverlay = this;
        // Automatically add to DOM when created
        document.body.append(this);

        if (error && (error.errors === undefined || !Array.isArray(error.errors))) {
            return;
        }

        const payload = {
            errors: error.errors,
            errorType: error.errorType || "server",
            rootPath: error.rootPath || "",
        };

        this.__flamePayload = payload;
        this.__flameMode = "original";

        this.#initializeThemeToggle();

        this.#initializeCopyError();

        this.#initializeScrollBlocking();

        this.#initializePagination();

        this.#hideLoadingStates();

        const editorSelect = this.root.querySelector("#editor-selector");

        if (editorSelect) {
            let saved = null;

            // eslint-disable-next-line n/no-unsupported-features/node-builtins
            saved = localStorage.getItem("flare:editor");

            if (saved && editorSelect.value !== saved) {
                editorSelect.value = saved;
            }

            editorSelect.addEventListener("change", function () {
                // eslint-disable-next-line n/no-unsupported-features/node-builtins
                localStorage.setItem("flare:editor", this.value || "");
            });
        }

        // Initialize close button - only for client errors
        const closeButton = this.root.querySelector("#__v_o__close");

        if (closeButton) {
            // Only show close button for client errors
            if (this.__flamePayload.errorType === "client") {
                closeButton.addEventListener("click", () => {
                    this.close();
                });
            } else {
                // Hide close button for server errors
                closeButton.style.display = "none";
            }
        }

        // Add ESC key handler for closing - only for client errors
        if (this.__flamePayload.errorType === "client") {
            document.addEventListener("keydown", (event) => {
                if (event.key === "Escape" && this.parentNode) {
                    this.close();
                }
            });
        }
    }

    close() {
        if (this.parentNode) {
            this.remove();
        }
    }

    updateOverlay() {
        // Force re-render of the current error
        const currentIndex = 0; // Assuming we're showing the first error

        const currentError = this.__flamePayload?.errors?.[currentIndex];

        if (currentError) {
            const flameOverlay = this.root.querySelector("#__v_o__overlay");

            if (flameOverlay) {
                const html = currentError.originalCodeFrameContent || currentError.compiledCodeFrameContent || "";

                flameOverlay.innerHTML = html;
            }
        }
    }

    #hideLoadingStates() {
        // Add a small delay to ensure content is fully rendered
        setTimeout(() => {
            // Hide header skeleton and show real content
            const headerSkeleton = this.root.querySelector("#__v_o__header_loader");
            const headerContent = this.root.querySelector("#__v_o__title");

            if (headerSkeleton) {
                headerSkeleton.style.display = "none";
            }

            if (headerContent) {
                headerContent.classList.remove("hidden");
            }

            // Hide message skeleton and show real content
            const messageSkeleton = this.root.querySelector("#__v_o__message_loader");
            const messageContent = this.root.querySelector("#__v_o__message");

            if (messageSkeleton) {
                messageSkeleton.style.display = "none";
            }

            if (messageContent) {
                messageContent.classList.remove("hidden");
            }

            // Hide body skeleton and show real content
            const bodySkeleton = this.root.querySelector("#__v_o__body_loader");
            const bodyContent = this.root.querySelector("#__v_o__overlay");

            if (bodySkeleton) {
                bodySkeleton.style.display = "none";
            }

            if (bodyContent) {
                bodyContent.classList.remove("hidden");
            }
        }, 100); // Small delay to ensure DOM is ready
    }

    #initializeCopyError() {
        const copyButton = this.root.querySelector("#__v_o__copy_error");

        if (!copyButton) {
            return;
        }

        copyButton.addEventListener("click", async (e) => {
            e.preventDefault();

            try {
                const payload = this.__flamePayload;
                const currentError = payload?.errors?.[0]; // Get first error

                if (!currentError) {
                    console.warn("[v-o] No error data available to copy");

                    return;
                }

                // Format error information
                const errorInfo = {
                    error: {
                        column: currentError.originalFileColumn || currentError.compiledColumn || 0,
                        file: currentError.originalFilePath || currentError.compiledFilePath || "",
                        line: currentError.originalFileLine || currentError.compiledLine || 0,
                        message: currentError.message || "",
                        name: currentError.name || "Unknown Error",
                    },
                    stack: currentError.originalStack || currentError.compiledStack || "",
                    timestamp: new Date().toISOString(),
                    url: globalThis.location.href,
                    userAgent: navigator.userAgent,
                };

                // Create formatted text in structured markdown format
                const codeFrame = currentError?.originalCodeFrameContent || currentError?.compiledCodeFrameContent || "";

                const formattedText = [
                    "## Error Type",
                    errorInfo.error.name || "Unknown Error",
                    "",
                    "## Error Message",
                    errorInfo.error.message || "No error message available",
                    "",
                    "## Build Output",
                    errorInfo.error.file ? `${errorInfo.error.file}:${errorInfo.error.line}:${errorInfo.error.column}` : "Unknown location",
                    errorInfo.error.message || "No error message available",
                    ...codeFrame ? ["", codeFrame] : [],
                    "",
                    errorInfo.stack || "No stack trace available",
                ].join("\n");

                // Copy to clipboard
                await navigator.clipboard.writeText(formattedText);

                // Visual feedback
                const originalText = copyButton.innerHTML;

                // Change to success state
                copyButton.innerHTML = `
                    <span class="inline-flex shrink-0 justify-center items-center size-8">
                        <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <polyline points="20,6 9,17 4,12"></polyline>
                        </svg>
                    </span>
                `;

                // Reset after 2 seconds
                setTimeout(() => {
                    copyButton.innerHTML = originalText;
                }, 2000);
            } catch (error) {
                console.error("[v-o] Failed to copy error info:", error);

                // Show error state
                const originalText = copyButton.innerHTML;

                copyButton.innerHTML = `
                    <span class="inline-flex shrink-0 justify-center items-center size-8">
                        <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </span>
                `;

                // Reset after 2 seconds
                setTimeout(() => {
                    copyButton.innerHTML = originalText;
                }, 2000);
            }
        });
    }

    #initializePagination() {
        const payload = this.__flamePayload;
        // Use the processed errors from the payload - they should already be in the correct format
        const errors = Array.isArray(payload.errors) && payload.errors.length > 0 ? payload.errors : [];
        const errorIds = errors.map((e, index) =>

            String(e.__id || [e.originalFilePath || "", e.originalFileLine || 0, e.name || "", e.message || ""].join("|")),
        );

        const totalErrors = errors.length;

        let currentIndex = 0;

        // Update the main overlay content based on current index
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
                // Update clickable file link if available
                const fileElement = this.root.querySelector("#__v_o__filelink");

                if (fileElement) {
                    const fullPath = currentError?.originalFilePath || "";
                    const line = currentError?.originalFileLine || 0;

                    if (fullPath) {
                        let displayPath = fullPath;

                        if (payload.rootPath && fullPath.startsWith(payload.rootPath)) {
                            // Remove root path to show relative path
                            displayPath = fullPath.slice(payload.rootPath.length);

                            // Ensure it starts with a slash if it doesn't already
                            if (!displayPath.startsWith("/")) {
                                displayPath = `/${displayPath}`;
                            }
                        }

                        fileElement.textContent = `.${displayPath}${line ? `:${line}` : ""}`;
                        fileElement.setAttribute("href", fullPath);
                        fileElement.classList.remove("hidden");
                    } else {
                        fileElement.textContent = "";
                        fileElement.setAttribute("href", "#");
                        fileElement.classList.add("hidden");
                    }
                }
            };

            // Update raw stacktrace pane if present (formatted, with clickable file links)
            const updateRawStack = (mode) => {
                const stackHost = this.root.querySelector("#__v_o__stacktrace");
                const stackElement = stackHost?.querySelector("div:last-child");

                if (stackHost && stackElement) {
                    const rootPayload = this.__flamePayload || {};

                    const stackText
                        = mode === "compiled"
                            ? String(currentError.compiledStack || rootPayload.compiledStack || "")
                            : String(currentError.originalStack || currentError.stack || rootPayload.originalStack || "");

                    const escape = (s) =>
                        String(s || "")
                            .replaceAll("&", "&amp;")
                            .replaceAll("<", "&lt;")
                            .replaceAll(">", "&gt;");
                    const normalizePath = (p) => {
                        if (/^https?:\/\//i.test(p)) {
                            const u = new URL(p);

                            p = u.pathname || "";
                        }

                        p = decodeURIComponent(p);

                        p = String(p || "").replace(/^\/@fs\//, "/");

                        return p;
                    };

                    const fmt = (line) => {
                        // Match: "at func (file:line:col)" or "at file:line:col"
                        const m = /\s*at\s+(?:(.+?)\s+\()?(.*?):(\d+):(\d+)\)?/.exec(line);

                        if (!m)
                            return `<div class="frame">${escape(line)}</div>`;

                        const function_ = m[1] ? escape(m[1]) : "";
                        const file = m[2];
                        const ln = m[3];
                        const col = m[4];
                        const displayPath = normalizePath(file);
                        const display = `${displayPath}:${ln}:${col}`;
                        const functionHtml = function_ ? `<span class="fn">${function_}</span> ` : "";

                        return `<div class="frame"><span class="muted">at</span> ${functionHtml}<a href="#" class="stack-link" data-file="${escape(displayPath)}" data-line="${ln}" data-column="${col}">${escape(display)}</a></div>`;
                    };
                    const html = stackText.split("\n").map(fmt).join("");

                    stackElement.innerHTML = html;
                    // Attach open-in-editor handlers
                    stackElement.querySelectorAll(".stack-link").forEach((a) => {
                        a.addEventListener("click", (event_) => {
                            event_.preventDefault();

                            const filePath = a.dataset.file || "";
                            const line = a.dataset.line || "";
                            const column = a.dataset.column || "";
                            // Prefer absolute from currentError if it ends with the display path
                            let resolved = filePath;

                            const abs = currentError.originalFilePath || currentError.compiledFilePath || "";

                            if (abs && abs.endsWith(filePath)) {
                                resolved = abs;
                            }

                            const qs = `/__open-in-editor?file=${encodeURIComponent(resolved)}${
                                line ? `&line=${line}` : ""
                            }${column ? `&column=${column}` : ""}`;

                            a.setAttribute("href", qs);

                            fetch(qs);
                        });
                    });
                }
            };

            // Render codeframe and set up mode switching
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

            // Show tabs conditionally: only show original/compiled tabs if we have both
            const hasOriginal = !!currentError.originalCodeFrameContent;
            const hasCompiled = !!currentError.compiledCodeFrameContent;

            if (hasOriginal && hasCompiled && modeSwitch) {
                modeSwitch.classList.remove("hidden");
            } else if (modeSwitch) {
                modeSwitch.classList.add("hidden");
            }

            const originalButton = this.root.querySelector("[data-flame-mode=\"original\"]");
            const compiledButton = this.root.querySelector("[data-flame-mode=\"compiled\"]");

            // Hide buttons for tabs that don't have content
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

                // Choose the appropriate code frame based on mode
                flameOverlay.innerHTML = mode === "compiled" ? currentError.compiledCodeFrameContent || "" : currentError.originalCodeFrameContent || "";
            };

            const activeMode = this.__flameMode || "original";

            renderCode(activeMode);
            updateFileLink();
            updateRawStack(activeMode);

            // Initialize button states
            if (originalButton && compiledButton) {
                if (activeMode === "original") {
                    originalButton.classList.add("active");
                    compiledButton.classList.remove("active");
                } else {
                    compiledButton.classList.add("active");
                    originalButton.classList.remove("active");
                }
            }

            originalButton?.addEventListener("click", (e) => {
                e.preventDefault();

                this.__flameMode = "original";

                renderCode("original");
                updateRawStack("original");

                // Update button states
                originalButton?.classList.add("active");
                compiledButton?.classList.remove("active");
            });

            compiledButton?.addEventListener("click", (e) => {
                e.preventDefault();

                this.__flameMode = "compiled";

                renderCode("compiled");
                updateRawStack("compiled");

                // Update button states
                compiledButton?.classList.add("active");
                originalButton?.classList.remove("active");
            });
        };

        // Update pagination display
        const updatePagination = () => {
            const indexElement = this.root.querySelector("[data-flame-dialog-error-index]");
            const totalElement = this.root.querySelector("[data-flame-dialog-header-total-count]");
            const previousButton = this.root.querySelector("[data-flame-dialog-error-previous]");
            const nextButton = this.root.querySelector("[data-flame-dialog-error-next]");

            if (indexElement)
                indexElement.textContent = (currentIndex + 1).toString();

            if (totalElement)
                totalElement.textContent = totalErrors.toString();

            // Update button states
            if (previousButton) {
                previousButton.disabled = currentIndex === 0;
                previousButton.setAttribute("aria-disabled", currentIndex === 0);
            }

            if (nextButton) {
                nextButton.disabled = currentIndex >= totalErrors - 1;
                nextButton.setAttribute("aria-disabled", currentIndex >= totalErrors - 1);
            }

            // Update overlay content
            updateOverlayContent();
        };

        // Set up event listeners
        const previousButton = this.root.querySelector("[data-flame-dialog-error-previous]");
        const nextButton = this.root.querySelector("[data-flame-dialog-error-next]");

        if (previousButton) {
            previousButton.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (currentIndex > 0) {
                    currentIndex--;
                    updatePagination();
                }
            });
        }

        if (nextButton) {
            nextButton.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (currentIndex < totalErrors - 1) {
                    currentIndex++;
                    updatePagination();
                }
            });
        }

        // Selection by error id (external)
        const selectById = (id) => {
            const index = errorIds.indexOf(String(id || ""));

            if (index !== -1) {
                currentIndex = index;

                updatePagination();
            }
        };

        globalThis.__flameSelectError = selectById;

        globalThis.addEventListener("flame:select-error", (event_) => {
            selectById(event_?.detail?.id);
        });

        updatePagination();
    }

    #initializeScrollBlocking() {
        // Store original overflow values
        this.#originalBodyOverflow = document.body.style.overflow || "";
        this.#originalHtmlOverflow = document.documentElement.style.overflow || "";

        // Prevent scrolling
        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";

        // Handle overlay removal (when close button is clicked or overlay is removed)
        const closeButton = this.root.querySelector("#__v_o__close");

        if (closeButton) {
            closeButton.addEventListener("click", () => {
                this.#restoreScroll();
            });
        }

        // Also restore scroll when the overlay element is removed from DOM
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.removedNodes.forEach((node) => {
                    if (node === this.root || (node.contains && node.contains(this.root))) {
                        this.#restoreScroll();
                        observer.disconnect();
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        // Fallback: restore scroll when page visibility changes (user switches tabs, etc.)
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") {
                // User switched away, restore scroll temporarily
                this.#restoreScroll();
            } else if (this.root && document.body.contains(this.root)) {
                // User came back and overlay is still there, block scroll again
                document.body.style.overflow = "hidden";
                document.documentElement.style.overflow = "hidden";
            }
        });

        // Cleanup on page unload to ensure scroll is restored
        window.addEventListener("beforeunload", () => {
            this.#restoreScroll();
        });
    }

    #initializeThemeToggle() {
        // Initialize button visibility based on current theme
        const currentTheme
            = localStorage.getItem("__v-o__theme") || (globalThis.matchMedia && globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        const isDark = currentTheme === "dark" || document.documentElement.classList.contains("dark");

        const darkButton = this.root.querySelector("[data-v-o-theme-click-value=\"dark\"]");
        const lightButton = this.root.querySelector("[data-v-o-theme-click-value=\"light\"]");

        if (isDark) {
            darkButton?.classList.add("hidden");
            darkButton?.classList.remove("block");
            lightButton?.classList.remove("hidden");
            lightButton?.classList.add("block");
            document.documentElement.classList.add("dark");
        } else {
            darkButton?.classList.remove("hidden");
            darkButton?.classList.add("block");
            lightButton?.classList.add("hidden");
            lightButton?.classList.remove("block");
            document.documentElement.classList.remove("dark");
        }

        // Setup event listeners
        const themeButtons = this.root.querySelectorAll("[data-v-o-theme-click-value]");

        themeButtons.forEach((button) => {
            button.addEventListener("click", (e) => {
                e.preventDefault();

                const theme = e.currentTarget.dataset.vOThemeClickValue;

                // Update theme on document element (affects whole page)
                if (theme === "dark") {
                    document.documentElement.classList.add("dark");
                    localStorage.setItem("__v-o__theme", "dark");

                    // Update button visibility for dark mode
                    darkButton?.classList.add("hidden");
                    darkButton?.classList.remove("block");
                    lightButton?.classList.remove("hidden");
                    lightButton?.classList.add("block");
                } else {
                    document.documentElement.classList.remove("dark");
                    localStorage.setItem("__v-o__theme", "light");

                    // Update button visibility for light mode
                    darkButton?.classList.remove("hidden");
                    darkButton?.classList.add("block");
                    lightButton?.classList.add("hidden");
                    lightButton?.classList.remove("block");
                }
            });
        });
    }

    #restoreScroll() {
        // Restore original overflow values
        document.body.style.overflow = this.#originalBodyOverflow;
        document.documentElement.style.overflow = this.#originalHtmlOverflow;

        // Clear stored values
        this.#originalBodyOverflow = "";
        this.#originalHtmlOverflow = "";
    }
}

// Global error handler for React errors
try {
    const originalError = globalThis.onerror;

    globalThis.onerror = function (message, source, lineno, colno, error) {
        // Try to instantiate our overlay manually
        try {
            const OverlayClass = globalThis.ErrorOverlay || globalThis.FlameErrorOverlay;

            if (error && typeof OverlayClass === "function") {
                const overlay = new OverlayClass({
                    colno,
                    lineno,
                    message: error.message || String(message),
                    name: error.name || "Error",
                    source,
                    stack: error.stack,
                });

                // Add the overlay to the DOM if it exists
                if (overlay && overlay.element) {
                    document.body.append(overlay.element);
                }
            }
        } catch (error_) {
            console.error("[flame:client] Failed to create overlay:", error_);
        }

        // Call original handler
        if (originalError) {
            return originalError.call(this, message, source, lineno, colno, error);
        }

        return false;
    };
} catch (error) {
    console.error("[flame:client] Failed to install global error handler:", error);
}
