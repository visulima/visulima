// @ts-nocheck
class ErrorOverlay extends HTMLElement {
    constructor(err) {
        super();

        this.root = this.attachShadow({ mode: "open" });
        this.root.innerHTML = overlayTemplate;
        this.dir = "ltr";

        // Store reference to this instance for pagination component
        this.root.host._errorOverlay = this;
        console.log("[flame:client] ErrorOverlay instance set on host:", {
            host: this.root.host,
            hostTag: this.root.host.tagName,
            hasInstance: !!this.root.host._errorOverlay,
            instance: this.root.host._errorOverlay,
        });

        try {
            console.log("[flame:client] ErrorOverlay ctor start", {
                err: err,
                errName: err?.name,
                errMessage: err?.message,
                errStack: err?.stack?.substring(0, 200) + "...",
                windowErrorOverlay: typeof window.ErrorOverlay,
                globalErrorOverlay: typeof globalThis.ErrorOverlay,
            });
        } catch {}

        try {
            console.log("[flame:client] ErrorOverlay is class:", typeof ErrorOverlay);
        } catch {}
        const p = err && err.err ? err.err : err || {};
        const payload = {
            name: String(p.name || "Error"),
            message: String(p.message || "Runtime error"),
            stack: String(p.stack || ""),
            originalStack: String(p.originalStack || ""),
            compiledStack: String(p.compiledStack || ""),
            causes: Array.isArray(p.causes) ? p.causes : [],
        };

        try {
            this.__flamePayload = payload;
            this.__flameMode = 'original';
            globalThis.__flameInspectPayload = () => payload;
            console.log("[flame:client] payload", {
                name: payload.name,
                hasPrimary: !!(payload.causes && payload.causes[0]),
                causes: payload.causes.length,
            });
            // Update clickable file link if available
            const first = payload.causes && payload.causes[0];
            const fileEl = this.root.querySelector('#__flame__filelink');
            if (fileEl) {
                const href = first?.filePath || '';
                const line = first?.fileLine || 0;
                if (href) {
                    fileEl.textContent = `${href}${line ? ':' + line : ''}`;
                    fileEl.setAttribute('href', href);
                    fileEl.classList.remove('hidden');
                } else {
                    fileEl.textContent = '';
                    fileEl.setAttribute('href', '#');
                    fileEl.classList.add('hidden');
                }
            }
        } catch {}

        this.text("#__flame__heading", err.name || "Runtime Error");

        // Content rendering is now handled by the pagination component
        // The pagination component will wait for the payload and then render the appropriate content
        console.log("[flame:client] ErrorOverlay ready - pagination component will handle content rendering");

        // Initialize component functionality
        this.#initializeComponents();

        // Initialize pagination (will wait for overlay to be ready)
        this.#initializePagination();

        // Initialize editor selector (persist to localStorage)
        const editorSelect = this.root.querySelector('#editor-selector');
        
        if (editorSelect) {
            let saved = null;

            saved = localStorage.getItem('flare:editor');

            if (saved && editorSelect.value !== saved) {
                editorSelect.value = saved;
            }

            editorSelect.addEventListener('change', function() {
                localStorage.setItem('flare:editor', this.value || '');
            });
        }
    }

    // Private component initialization methods
    #initializeComponents() {
        console.log("[flame:client] Initializing components...");

        // Initialize theme toggle
        this.#initializeThemeToggle();
    }

    #initializeThemeToggle() {
        console.log("[flame:client] Setting up theme toggle");

        // Initialize button visibility based on current theme
        const currentTheme =
            localStorage.getItem("hs_theme") || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        const isDark = currentTheme === "dark" || document.documentElement.classList.contains("dark");

        const darkBtn = this.root.querySelector('[data-hs-theme-click-value="dark"]');
        const lightBtn = this.root.querySelector('[data-hs-theme-click-value="light"]');

        if (isDark) {
            darkBtn?.classList.add("hidden");
            darkBtn?.classList.remove("block");
            lightBtn?.classList.remove("hidden");
            lightBtn?.classList.add("block");
            document.documentElement.classList.add("dark");
        } else {
            darkBtn?.classList.remove("hidden");
            darkBtn?.classList.add("block");
            lightBtn?.classList.add("hidden");
            lightBtn?.classList.remove("block");
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

                const theme = this.getAttribute("data-hs-theme-click-value");
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
                const darkBtn = this.closest("#hs-theme-switch")?.querySelector('[data-hs-theme-click-value="dark"]');
                const lightBtn = this.closest("#hs-theme-switch")?.querySelector('[data-hs-theme-click-value="light"]');

                if (theme === "dark") {
                    // Dark mode activated - show light button, hide dark button
                    darkBtn?.classList.add("hidden");
                    darkBtn?.classList.remove("block");
                    lightBtn?.classList.remove("hidden");
                    lightBtn?.classList.add("block");
                } else {
                    // Light mode activated - show dark button, hide light button
                    darkBtn?.classList.remove("hidden");
                    darkBtn?.classList.add("block");
                    lightBtn?.classList.add("hidden");
                    lightBtn?.classList.remove("block");
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
            const causes = (Array.isArray(payload.causes) && payload.causes.length > 0)
                ? payload.causes
                : [{ name: payload.name, message: payload.message, stack: payload.stack, originalStack: payload.originalStack, compiledStack: payload.compiledStack }];
            const causeIds = causes.map((c, i) => String(c.__id || [c.filePath || '', c.fileLine || 0, c.name || '', c.message || ''].join('|')));
            const totalErrors = causes.length;
            let currentIndex = 0;

            console.log("[flame:pagination] Pagination ready with", totalErrors, "errors", {
                payload: payload,
                causesCount: payload.causes ? payload.causes.length : 0,
                hasPrimary: !!payload.error,
            });

            // Update pagination display
            const updatePagination = () => {
                const indexElement = this.root.querySelector("[data-flame-dialog-error-index]");
                const totalElement = this.root.querySelector("[data-flame-dialog-header-total-count]");
                const prevButton = this.root.querySelector("[data-flame-dialog-error-previous]");
                const nextButton = this.root.querySelector("[data-flame-dialog-error-next]");

                if (indexElement) indexElement.textContent = (currentIndex + 1).toString();
                if (totalElement) totalElement.textContent = totalErrors.toString();

                // Update button states
                if (prevButton) {
                    prevButton.disabled = currentIndex === 0;
                    prevButton.setAttribute("aria-disabled", currentIndex === 0);
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

                const currentError = causes[currentIndex] || { name: payload.name, message: payload.message, stack: payload.stack, originalStack: payload.originalStack, compiledStack: payload.compiledStack };

                // Update raw stacktrace pane if present (formatted, with clickable file links)
                const updateRawStack = (mode) => {
                    try {
                        const stackHost = this.root.querySelector('#__flame__stacktrace');
                        const stackEl = stackHost?.querySelector('div:last-child');
                        if (stackHost && stackEl) {
                            const rootPayload = this.__flamePayload || {};
                            const stackText = mode === 'compiled'
                                ? String(currentError.compiledStack || rootPayload.compiledStack || currentError.stack || rootPayload.stack || '')
                                : String(currentError.originalStack || rootPayload.originalStack || currentError.stack || rootPayload.stack || '');
                            const escape = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                            const normalizePath = (p) => {
                                try {
                                    if (/^https?:\/\//i.test(p)) {
                                        const u = new URL(p);
                                        p = u.pathname || '';
                                    }
                                } catch {}
                                try { p = decodeURIComponent(p); } catch {}
                                p = String(p || '').replace(/^\/\@fs\//, '/');
                                return p;
                            };
                            const fmt = (line) => {
                                // Match: "at func (file:line:col)" or "at file:line:col"
                                const m = /\s*at\s+(?:(.+?)\s+\()?(.*?):(\d+):(\d+)\)?/.exec(line);
                                if (!m) return `<div class="frame">${escape(line)}</div>`;
                                const fn = m[1] ? escape(m[1]) : '';
                                const file = m[2];
                                const ln = m[3];
                                const col = m[4];
                                const displayPath = normalizePath(file);
                                const display = `${displayPath}:${ln}:${col}`;
                                const fnHtml = fn ? `<span class="fn">${fn}</span> ` : '';
                                return `<div class="frame"><span class="muted">at</span> ${fnHtml}<a href="#" class="stack-link" data-file="${escape(displayPath)}" data-line="${ln}" data-column="${col}">${escape(display)}</a></div>`;
                            };
                            const html = stackText.split('\n').map(fmt).join('');
                            stackEl.innerHTML = html;
                            // Attach open-in-editor handlers
                            stackEl.querySelectorAll('.stack-link').forEach((a) => {
                                a.addEventListener('click', (ev) => {
                                    ev.preventDefault();
                                    try {
                                        const filePath = a.getAttribute('data-file') || '';
                                        const line = a.getAttribute('data-line') || '';
                                        const column = a.getAttribute('data-column') || '';
                                        // Prefer absolute from currentError if it ends with the display path
                                        let resolved = filePath;
                                        try {
                                            const abs = currentError.filePath || currentError.compiledFilePath || '';
                                            if (abs && abs.endsWith(filePath)) resolved = abs;
                                        } catch {}
                                        const qs = '/__open-in-editor?file=' + encodeURIComponent(resolved)
                                            + (line ? '&line=' + line : '')
                                            + (column ? '&column=' + column : '');
                                        a.setAttribute('href', qs);
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
                const modeSwitch = this.root.querySelector('#__flame__mode');
                if (headingElement) {
                    headingElement.textContent = currentError.name || "Runtime Error";
                    try { headingElement.setAttribute('data-cause-id', causeIds[currentIndex] || ''); } catch {}
                }

                const hasDual = !!currentError.originalCodeFrameContent || !!currentError.compiledCodeFrameContent;
                if (hasDual && modeSwitch) modeSwitch.classList.remove('hidden');

                const originalBtn = this.root.querySelector('[data-flame-mode="original"]');
                const compiledBtn = this.root.querySelector('[data-flame-mode="compiled"]');

                const renderCode = (mode) => {
                    if (!flameOverlay) return;
                    const html = mode === 'compiled' ? (currentError.compiledCodeFrameContent || currentError.codeFrameContent) : (currentError.originalCodeFrameContent || currentError.codeFrameContent);
                    flameOverlay.innerHTML = html || '';
                };

                const activeMode = this.__flameMode || 'original';
                renderCode(activeMode);
                updateRawStack(activeMode);

                originalBtn?.addEventListener('click', () => {
                    this.__flameMode = 'original';
                    renderCode('original');
                    updateRawStack('original');
                });
                compiledBtn?.addEventListener('click', () => {
                    this.__flameMode = 'compiled';
                    renderCode('compiled');
                    updateRawStack('compiled');
                });
            };

            // Set up event listeners
            const prevButton = this.root.querySelector("[data-flame-dialog-error-previous]");
            const nextButton = this.root.querySelector("[data-flame-dialog-error-next]");

            if (prevButton) {
                prevButton.addEventListener("click", (e) => {
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
                    const idx = causeIds.indexOf(String(id || ''));
                    if (idx >= 0) {
                        currentIndex = idx;
                        updatePagination();
                    }
                } catch {}
            };
            try { globalThis.__flameSelectCause = selectById; } catch {}
            try {
                window.addEventListener('flame:select-cause', (ev) => {
                    try { selectById(ev?.detail?.id); } catch {}
                });
            } catch {}

            // Initialize
            updatePagination();
            console.log("[flame:pagination] Pagination component initialized successfully");
        };

        // Start the initialization process
        initializeWhenReady();
    }

    text(selector, text, html = false) {
        if (!text) {
            return;
        }

        const el = this.root.querySelector(selector);

        if (!el) {
            return;
        }

        if (html) {
            // Automatically detect links
            text = text
                .split(" ")
                .map((v) => {
                    if (!v.startsWith("https://")) return v;
                    if (v.endsWith(".")) return `<a target="_blank" href="${v.slice(0, -1)}">${v.slice(0, -1)}</a>.`;
                    return `<a target="_blank" href="${v}">${v}</a>`;
                })
                .join(" ");

            el.innerHTML = text.trim();
        } else {
            el.textContent = text.trim();
        }
    }

    close() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}

// Global error handler for React errors
try {
    const originalError = window.onerror;
    window.onerror = function (message, source, lineno, colno, error) {
        console.log("[flame:client] Global error caught:", {
            message,
            source,
            lineno,
            colno,
            error,
            hasErrorOverlay: typeof window.ErrorOverlay,
            hasFlameErrorOverlay: typeof window.FlameErrorOverlay,
        });

        // Try to instantiate our overlay manually
        try {
            const OverlayClass = window.ErrorOverlay || window.FlameErrorOverlay;
            if (error && typeof OverlayClass === "function") {
                console.log("[flame:client] Creating overlay manually with class:", OverlayClass.name);
                const overlay = new OverlayClass({
                    name: error.name || "Error",
                    message: error.message || String(message),
                    stack: error.stack,
                    source: source,
                    lineno: lineno,
                    colno: colno,
                });
                console.log("[flame:client] Overlay created manually:", !!overlay);
            } else {
                console.log("[flame:client] No overlay class available:", {
                    ErrorOverlay: typeof window.ErrorOverlay,
                    FlameErrorOverlay: typeof window.FlameErrorOverlay,
                });
            }
        } catch (e) {
            console.error("[flame:client] Failed to create overlay:", e);
        }

        // Call original handler
        if (originalError) {
            return originalError.call(this, message, source, lineno, colno, error);
        }
        return false;
    };

    console.log("[flame:client] Global error handler installed");

    // Debug helper for manual testing
    window.__flameTestOverlay = function (testError) {
        console.log("[flame:client] Testing overlay manually...");
        try {
            const OverlayClass = window.ErrorOverlay || window.FlameErrorOverlay;
            if (typeof OverlayClass === "function") {
                const overlay = new OverlayClass(
                    testError || {
                        name: "TestError",
                        message: "This is a test error",
                        stack: "Test stack trace",
                    },
                );
                console.log("[flame:client] Test overlay created successfully");
                return overlay;
            } else {
                console.error("[flame:client] No overlay class found for testing");
                return null;
            }
        } catch (e) {
            console.error("[flame:client] Test overlay creation failed:", e);
            return null;
        }
    };

    console.log("[flame:client] Debug helper installed: window.__flameTestOverlay()");
} catch (e) {
    console.error("[flame:client] Failed to install global error handler:", e);
}
