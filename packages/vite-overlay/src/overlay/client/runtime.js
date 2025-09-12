// @ts-nocheck
class ErrorOverlay extends HTMLElement {
    constructor(error) {
        super();

        this.root = this.attachShadow({ mode: "open" });
        this.root.innerHTML = overlayTemplate;
        this.dir = "ltr";

        // Store reference to this instance for pagination component
        this.root.host._errorOverlay = this;
        console.log("[flame:client] ErrorOverlay instance set on host:", {
            hasInstance: !!this.root.host._errorOverlay,
            host: this.root.host,
            hostTag: this.root.host.tagName,
            instance: this.root.host._errorOverlay,
        });

        try {
            console.log("[flame:client] ErrorOverlay ctor start", {
                err: error,
                errMessage: error?.message,
                errName: error?.name,
                errStack: `${error?.stack?.slice(0, 200)}...`,
                globalErrorOverlay: typeof globalThis.ErrorOverlay,
                windowErrorOverlay: typeof globalThis.ErrorOverlay,
            });
        } catch {}

        try {
            console.log("[flame:client] ErrorOverlay is class:", typeof ErrorOverlay);
        } catch {}

        const p = error && error.err ? error.err : error || {};
        const payload = {
            causes: Array.isArray(p.causes) ? p.causes : [],
            compiledStack: String(p.compiledStack || ""),
            message: String(p.message || "Runtime error"),
            name: String(p.name || "Error"),
            originalStack: String(p.originalStack || ""),
            stack: String(p.stack || ""),
        };

        try {
            this.__flamePayload = payload;
            this.__flameMode = "original";
            globalThis.__flameInspectPayload = () => payload;
            console.log("[flame:client] payload", {
                causes: payload.causes.length,
                hasPrimary: !!(payload.causes && payload.causes[0]),
                name: payload.name,
            });
            // Update clickable file link if available
            const first = payload.causes && payload.causes[0];
            const fileElement = this.root.querySelector("#__flame__filelink");

            if (fileElement) {
                const href = first?.filePath || "";
                const line = first?.fileLine || 0;

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
        } catch {}

        this.text("#__flame__heading", error.name || "Runtime Error");

        // Content rendering is now handled by the pagination component
        // The pagination component will wait for the payload and then render the appropriate content
        console.log("[flame:client] ErrorOverlay ready - pagination component will handle content rendering");

        // Initialize component functionality
        this.#initializeComponents();

        // Initialize pagination (will wait for overlay to be ready)
        this.#initializePagination();

        // Initialize editor selector (persist to localStorage)
        const editorSelect = this.root.querySelector("#editor-selector");

        if (editorSelect) {
            let saved = null;

            saved = localStorage.getItem("flare:editor");

            if (saved && editorSelect.value !== saved) {
                editorSelect.value = saved;
            }

            editorSelect.addEventListener("change", function () {
                localStorage.setItem("flare:editor", this.value || "");
            });
        }
    }

    close() {
        if (this.element && this.element.parentNode) {
            this.element.remove();
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

    // Private component initialization methods
    #initializeComponents() {
        console.log("[flame:client] Initializing components...");

        // Initialize theme toggle
        this.#initializeThemeToggle();
    }

    #initializePagination() {
        console.log("[flame:pagination] Initializing pagination in ErrorOverlay instance");

        // Wait for the overlay to be fully ready
        const initializeWhenReady = () => {
            // Check if we're attached to the DOM and have the shadow root
            if (!this.isConnected || !this.shadowRoot) {
                setTimeout(initializeWhenReady, 50);

                return;
            }

            // Check if payload is ready
            if (!this.__flamePayload) {
                setTimeout(initializeWhenReady, 100);

                return;
            }

            const payload = this.__flamePayload;
            const causes
                = Array.isArray(payload.causes) && payload.causes.length > 0
                    ? payload.causes
                    : [
                        {
                            compiledStack: payload.compiledStack,
                            message: payload.message,
                            name: payload.name,
                            originalStack: payload.originalStack,
                            stack: payload.stack,
                        },
                    ];
            const causeIds = causes.map((c, index) => String(c.__id || [c.filePath || "", c.fileLine || 0, c.name || "", c.message || ""].join("|")));
            const totalErrors = causes.length;
            let currentIndex = 0;

            console.log("[flame:pagination] Pagination ready with", totalErrors, "errors", {
                causesCount: payload.causes ? payload.causes.length : 0,
                hasPrimary: !!payload.error,
                payload,
            });

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
                    console.log("[flame:pagination] Mount element not found");

                    return;
                }

                const currentError = causes[currentIndex] || {
                    compiledStack: payload.compiledStack,
                    message: payload.message,
                    name: payload.name,
                    originalStack: payload.originalStack,
                    stack: payload.stack,
                };

                // Update raw stacktrace pane if present (formatted, with clickable file links)
                const updateRawStack = (mode) => {
                    try {
                        const stackHost = this.root.querySelector("#__flame__stacktrace");
                        const stackElement = stackHost?.querySelector("div:last-child");

                        if (stackHost && stackElement) {
                            const rootPayload = this.__flamePayload || {};
                            const stackText
                                = mode === "compiled"
                                    ? String(currentError.compiledStack || rootPayload.compiledStack || currentError.stack || rootPayload.stack || "")
                                    : String(currentError.originalStack || rootPayload.originalStack || currentError.stack || rootPayload.stack || "");
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
                                            const abs = currentError.filePath || currentError.compiledFilePath || "";

                                            if (abs && abs.endsWith(filePath))
                                                resolved = abs;
                                        } catch {}

                                        const qs
                                            = `/__open-in-editor?file=${
                                                encodeURIComponent(resolved)
                                            }${line ? `&line=${line}` : ""
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
                        headingElement.dataset.causeId = causeIds[currentIndex] || "";
                    } catch {}
                }

                const hasDual = !!currentError.originalCodeFrameContent || !!currentError.compiledCodeFrameContent;

                if (hasDual && modeSwitch)
                    modeSwitch.classList.remove("hidden");

                const originalButton = this.root.querySelector("[data-flame-mode=\"original\"]");
                const compiledButton = this.root.querySelector("[data-flame-mode=\"compiled\"]");

                const renderCode = (mode) => {
                    if (!flameOverlay)
                        return;

                    const html
                        = mode === "compiled"
                            ? currentError.compiledCodeFrameContent || currentError.codeFrameContent
                            : currentError.originalCodeFrameContent || currentError.codeFrameContent;

                    flameOverlay.innerHTML = html || "";
                };

                const activeMode = this.__flameMode || "original";

                renderCode(activeMode);
                updateRawStack(activeMode);

                originalButton?.addEventListener("click", () => {
                    this.__flameMode = "original";
                    renderCode("original");
                    updateRawStack("original");
                });
                compiledButton?.addEventListener("click", () => {
                    this.__flameMode = "compiled";
                    renderCode("compiled");
                    updateRawStack("compiled");
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
                        console.log("[flame:pagination] Navigated to error", currentIndex + 1, "of", totalErrors);
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
                        console.log("[flame:pagination] Navigated to error", currentIndex + 1, "of", totalErrors);
                    }
                });
            }

            // Selection by cause id (external)
            const selectById = (id) => {
                try {
                    const index = causeIds.indexOf(String(id || ""));

                    if (index !== -1) {
                        currentIndex = index;
                        updatePagination();
                    }
                } catch {}
            };

            try {
                globalThis.__flameSelectCause = selectById;
            } catch {}

            try {
                globalThis.addEventListener("flame:select-cause", (event_) => {
                    try {
                        selectById(event_?.detail?.id);
                    } catch {}
                });
            } catch {}

            // Initialize
            updatePagination();
            console.log("[flame:pagination] Pagination component initialized successfully");
        };

        // Start the initialization process
        initializeWhenReady();
    }

    #initializeThemeToggle() {
        console.log("[flame:client] Setting up theme toggle");

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

        console.log("[flame:client] Theme buttons initialized. Current theme:", currentTheme, "Is dark:", isDark);

        // Setup event listeners
        const themeButtons = this.root.querySelectorAll("[data-hs-theme-click-value]");

        console.log("[flame:client] Found theme buttons:", themeButtons.length);

        themeButtons.forEach((button, index) => {
            console.log("[flame:client] Attaching click listener to button", index);

            button.addEventListener("click", function (e) {
                console.log("[flame:client] 🎯 Theme button clicked!");
                e.preventDefault();

                const theme = this.dataset.hsThemeClickValue;

                console.log("[flame:client] Theme value:", theme);

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

                console.log("[flame:client] Theme switched to:", theme, "Dark class on document:", document.documentElement.classList.contains("dark"));
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

        console.log("[flame:client] Theme toggle component initialized successfully");
    }
}

// Global error handler for React errors
try {
    const originalError = globalThis.onerror;

    globalThis.onerror = function (message, source, lineno, colno, error) {
        console.log("[flame:client] Global error caught:", {
            colno,
            error,
            hasErrorOverlay: typeof globalThis.ErrorOverlay,
            hasFlameErrorOverlay: typeof globalThis.FlameErrorOverlay,
            lineno,
            message,
            source,
        });

        // Try to instantiate our overlay manually
        try {
            const OverlayClass = globalThis.ErrorOverlay || globalThis.FlameErrorOverlay;

            if (error && typeof OverlayClass === "function") {
                console.log("[flame:client] Creating overlay manually with class:", OverlayClass.name);
                const overlay = new OverlayClass({
                    colno,
                    lineno,
                    message: error.message || String(message),
                    name: error.name || "Error",
                    source,
                    stack: error.stack,
                });

                console.log("[flame:client] Overlay created manually:", !!overlay);
            } else {
                console.log("[flame:client] No overlay class available:", {
                    ErrorOverlay: typeof globalThis.ErrorOverlay,
                    FlameErrorOverlay: typeof globalThis.FlameErrorOverlay,
                });
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

    console.log("[flame:client] Global error handler installed");

    // Debug helper for manual testing
    globalThis.__flameTestOverlay = function (testError) {
        console.log("[flame:client] Testing overlay manually...");

        try {
            const OverlayClass = globalThis.ErrorOverlay || globalThis.FlameErrorOverlay;

            if (typeof OverlayClass === "function") {
                const overlay = new OverlayClass(
                    testError || {
                        message: "This is a test error",
                        name: "TestError",
                        stack: "Test stack trace",
                    },
                );

                console.log("[flame:client] Test overlay created successfully");

                return overlay;
            }

            console.error("[flame:client] No overlay class found for testing");

            return null;
        } catch (error) {
            console.error("[flame:client] Test overlay creation failed:", error);

            return null;
        }
    };

    console.log("[flame:client] Debug helper installed: window.__flameTestOverlay()");
} catch (error) {
    console.error("[flame:client] Failed to install global error handler:", error);
}
