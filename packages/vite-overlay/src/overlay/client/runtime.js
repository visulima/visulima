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
        this.root.innerHTML = overlayTemplate;
        this.dir = "ltr";

        // Store reference to the element for external access
        this.element = this;

        // Store reference to this instance for pagination component
        this.root.host._errorOverlay = this;
        // Automatically add to DOM when created
        document.body.append(this);

        // Handle multiple possible error structures:
        // 1. Vite server error: { errors: [...], errorType: "client" | "server" }
        // 2. Browser ErrorEvent: { message, name, stack, lineno, colno, source }

        let payloadErrors = [];
        let errorType = "client";

        // Case 1: Direct Vite server error structure
        if (Array.isArray(error?.errors)) {
            payloadErrors = error.errors;
            errorType = error.errorType || "server";
        }
        // Case 2: Browser ErrorEvent structure - create basic error
        else {
            const basicError = {
                message: error?.message || "Runtime error",
                name: error?.name || "Error",
                originalFileColumn: error?.colno,
                originalFileLine: error?.lineno,
                originalFilePath: error?.source,
                originalStack: error?.stack || "",
            };

            payloadErrors = [basicError];
            errorType = "client";
        }

        const payload = {
            errors: payloadErrors,
            errorType,
        };

        this.__flamePayload = payload;
        this.__flameMode = "original";

        // Update clickable file link if available
        const first = payload.errors && payload.errors[0];
        const fileElement = this.root.querySelector("#__flame__filelink");

        if (fileElement) {
            const href = first?.originalFilePath || "";
            const line = first?.originalFileLine || 0;

            if (href) {
                fileElement.textContent = `${href}${line ? `:${line}` : ""}`;
                fileElement.setAttribute("href", href);
                fileElement.classList.remove("hidden");
            } else {
                fileElement.textContent = "";
                fileElement.setAttribute("href", "#");
                fileElement.classList.add("hidden");
            }
        }

        this.text("#__flame__heading", error.name || "Runtime Error");

        // Content rendering is now handled by the pagination component
        // The pagination component will wait for the payload and then render the appropriate content

        // Initialize component functionality
        this.#initializeComponents();

        // Initialize pagination (will wait for overlay to be ready)
        this.#initializePagination();

        // Initialize editor selector (persist to localStorage)
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

        // Initialize close button
        const closeButton = this.root.querySelector("#__flame__close");

        if (closeButton) {
            closeButton.addEventListener("click", () => {
                this.close();
            });
        }

        // Add ESC key handler for closing
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && this.parentNode) {
                this.close();
            }
        });
    }

    close() {
        if (this.parentNode) {
            this.remove();
        }
    }

    text(selector, text, html = false) {
        if (!text) {
            return;
        }

        const element = this.root.querySelector(selector);

        if (!element) {
            return;
        }

        if (html) {
            // Automatically detect links
            text = text
                .split(" ")
                .map((v) => {
                    if (!v.startsWith("https://"))
                        return v;

                    if (v.endsWith("."))
                        return `<a target="_blank" href="${v.slice(0, -1)}">${v.slice(0, -1)}</a>.`;

                    return `<a target="_blank" href="${v}">${v}</a>`;
                })
                .join(" ");

            element.innerHTML = text.trim();
        } else {
            element.textContent = text.trim();
        }
    }

    updateOverlay() {
        // Force re-render of the current error
        const currentIndex = 0; // Assuming we're showing the first error
        // eslint-disable-next-line no-underscore-dangle
        const currentError = this.__flamePayload?.errors?.[currentIndex];

        if (currentError) {
            const flameOverlay = this.root.querySelector("#__flame__overlay");

            if (flameOverlay) {
                const html = currentError.originalCodeFrameContent || currentError.compiledCodeFrameContent || "";

                flameOverlay.innerHTML = html;
            }
        }
    }

    // Private component initialization methods
    #initializeComponents() {
        // Initialize theme toggle
        this.#initializeThemeToggle();
    }

    #initializePagination() {
        // Wait for the overlay to be fully ready
        const initializeWhenReady = () => {
            // Check if we're attached to the DOM and have the shadow root
            if (!this.isConnected || !this.shadowRoot) {
                setTimeout(initializeWhenReady, 50);

                return;
            }

            // Check if payload is ready
            // eslint-disable-next-line no-underscore-dangle
            if (!this.__flamePayload) {
                setTimeout(initializeWhenReady, 100);

                return;
            }

            // eslint-disable-next-line no-underscore-dangle
            const payload = this.__flamePayload;
            // Use the processed errors from the payload - they should already be in the correct format
            const errors = Array.isArray(payload.errors) && payload.errors.length > 0 ? payload.errors : [];
            const errorIds = errors.map((e, index) =>
                // eslint-disable-next-line no-underscore-dangle
                String(e.__id || [e.originalFilePath || "", e.originalFileLine || 0, e.name || "", e.message || ""].join("|")),
            );
            const totalErrors = errors.length;
            let currentIndex = 0;

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

            // Update the main overlay content based on current index
            const updateOverlayContent = () => {
                const mount = this.root.querySelector("#__flame__overlay");

                if (!mount) {
                    return;
                }

                const currentError = errors[currentIndex] || {
                    compiledStack: payload.compiledStack,
                    message: payload.message,
                    name: payload.name,
                    originalStack: payload.originalStack,
                };

                // Update raw stacktrace pane if present (formatted, with clickable file links)
                const updateRawStack = (mode) => {
                    try {
                        const stackHost = this.root.querySelector("#__flame__stacktrace");
                        const stackElement = stackHost?.querySelector("div:last-child");

                        if (stackHost && stackElement) {
                            // eslint-disable-next-line no-underscore-dangle
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
                                try {
                                    if (/^https?:\/\//i.test(p)) {
                                        const u = new URL(p);

                                        p = u.pathname || "";
                                    }
                                } catch {}

                                try {
                                    p = decodeURIComponent(p);
                                } catch {}

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

                                    try {
                                        const filePath = a.dataset.file || "";
                                        const line = a.dataset.line || "";
                                        const column = a.dataset.column || "";
                                        // Prefer absolute from currentError if it ends with the display path
                                        let resolved = filePath;

                                        try {
                                            const abs = currentError.originalFilePath || currentError.compiledFilePath || "";

                                            if (abs && abs.endsWith(filePath))
                                                resolved = abs;
                                        } catch {}

                                        const qs = `/__open-in-editor?file=${encodeURIComponent(resolved)}${
                                            line ? `&line=${line}` : ""
                                        }${column ? `&column=${column}` : ""}`;

                                        a.setAttribute("href", qs);
                                        fetch(qs);
                                    } catch {}
                                });
                            });
                        }
                    } catch {}
                };

                // Render codeframe and set up mode switching
                const flameOverlay = this.root.querySelector("#__flame__overlay");
                const headingElement = this.root.querySelector("#__flame__heading");
                const modeSwitch = this.root.querySelector("#__flame__mode");

                if (headingElement) {
                    headingElement.textContent = currentError.name || "Runtime Error";

                    try {
                        headingElement.dataset.errorId = errorIds[currentIndex] || "";
                    } catch {}
                }

                // Show tabs conditionally: only show original/compiled tabs if we have both
                const hasOriginal = !!currentError.originalCodeFrameContent;
                const hasCompiled = !!currentError.compiledCodeFrameContent;
                const hasBoth = hasOriginal && hasCompiled;
                const hasEither = hasOriginal || hasCompiled;

                if (hasBoth && modeSwitch)
                    modeSwitch.classList.remove("hidden");
                else if (modeSwitch)
                    modeSwitch.classList.add("hidden");

                // Code frames should be provided by the server via VisulimaViteOverlayErrorPayload

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
                    if (!flameOverlay)
                        return;

                    // Choose the appropriate code frame based on mode
                    let html = "";

                    if (mode === "compiled") {
                        html = currentError.compiledCodeFrameContent || "";
                    } else {
                        // Default to original mode
                        html = currentError.originalCodeFrameContent || "";
                    }

                    flameOverlay.innerHTML = html || "";
                };

                const activeMode = this.__flameMode || "original";

                renderCode(activeMode);
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
                try {
                    const index = errorIds.indexOf(String(id || ""));

                    if (index !== -1) {
                        currentIndex = index;
                        updatePagination();
                    }
                } catch {}
            };

            try {
                globalThis.__flameSelectError = selectById;
            } catch {}

            try {
                globalThis.addEventListener("flame:select-error", (event_) => {
                    try {
                        selectById(event_?.detail?.id);
                    } catch {}
                });
            } catch {}

            // Initialize
            updatePagination();
        };

        // Start the initialization process
        initializeWhenReady();
    }

    #initializeThemeToggle() {
        // Initialize button visibility based on current theme
        const currentTheme
            = localStorage.getItem("hs_theme") || (globalThis.matchMedia && globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        const isDark = currentTheme === "dark" || document.documentElement.classList.contains("dark");

        const darkButton = this.root.querySelector("[data-hs-theme-click-value=\"dark\"]");
        const lightButton = this.root.querySelector("[data-hs-theme-click-value=\"light\"]");

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
        const themeButtons = this.root.querySelectorAll("[data-hs-theme-click-value]");

        themeButtons.forEach((button) => {
            button.addEventListener("click", function (e) {
                e.preventDefault();

                const theme = this.dataset.hsThemeClickValue;

                // Update theme on document element (affects whole page)
                if (theme === "dark") {
                    document.documentElement.classList.add("dark");
                    localStorage.setItem("hs_theme", "dark");
                } else {
                    document.documentElement.classList.remove("dark");
                    localStorage.setItem("hs_theme", "light");
                }

                // Update button visibility using the classes from the component
                const darkButton = this.closest("#hs-theme-switch")?.querySelector("[data-hs-theme-click-value=\"dark\"]");
                const lightButton = this.closest("#hs-theme-switch")?.querySelector("[data-hs-theme-click-value=\"light\"]");

                if (theme === "dark") {
                    // Dark mode activated - show light button, hide dark button
                    darkButton?.classList.add("hidden");
                    darkButton?.classList.remove("block");
                    lightButton?.classList.remove("hidden");
                    lightButton?.classList.add("block");
                } else {
                    // Light mode activated - show dark button, hide light button
                    darkButton?.classList.remove("hidden");
                    darkButton?.classList.add("block");
                    lightButton?.classList.add("hidden");
                    lightButton?.classList.remove("block");
                }
            });
        });

        // Manual tooltip implementation for theme buttons
        const tooltipButtons = this.root.querySelectorAll("#hs-theme-switch .hs-tooltip-toggle");

        tooltipButtons.forEach((button) => {
            const tooltip = button.parentElement?.querySelector(".hs-tooltip-content");

            if (tooltip) {
                button.addEventListener("mouseenter", () => {
                    tooltip.classList.remove("invisible", "opacity-0");
                    tooltip.classList.add("visible", "opacity-100");
                });

                button.addEventListener("mouseleave", () => {
                    tooltip.classList.remove("visible", "opacity-100");
                    tooltip.classList.add("invisible", "opacity-0");
                });
            }
        });
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
