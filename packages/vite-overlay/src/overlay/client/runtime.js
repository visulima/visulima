// @ts-nocheck
class ErrorOverlay extends HTMLElement {
    constructor(error) {
        super();

        this.root = this.attachShadow({ mode: "open" });
        this.root.innerHTML = overlayTemplate;
        this.dir = "ltr";

        // Store reference to this instance for pagination component
        this.root.host._errorOverlay = this;

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
            // Update clickable file link if available
            const first = payload.causes && payload.causes[0];
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
        } catch {}

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

    async generateCodeFrames(error) {
        try {
            // Try to fetch the original file
            const response = await fetch(error.originalFilePath);

            if (!response.ok) {
                return;
            }

            const fileContent = await response.text();

            // Generate a simple code frame around the error location
            const lines = fileContent.split("\n");
            const errorLine = error.originalFileLine || 1;
            const startLine = Math.max(1, errorLine - 2);
            const endLine = Math.min(lines.length, errorLine + 2);

            const codeFrame = [];

            for (let index = startLine; index <= endLine; index++) {
                const line = lines[index - 1] || "";
                const marker = index === errorLine ? ">" : " ";

                codeFrame.push(`${marker} ${index}: ${line}`);
            }

            const codeFrameText = codeFrame.join("\n");

            // Create a simple HTML code frame
            const htmlCodeFrame = `<pre><code>${codeFrameText.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</code></pre>`;

            // Update the error object
            if (!error.originalCodeFrameContent) {
                error.originalCodeFrameContent = htmlCodeFrame;
                error.originalSnippet = codeFrameText;
            }

            // Re-render the overlay with the new code frames
            this.updateOverlay();
        } catch {
            // Code frame generation failed
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
        const currentError = this.__flamePayload?.causes?.[currentIndex];

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
            const causeIds = causes.map((c, index) => String(c.__id || [c.originalFilePath || "", c.originalFileLine || 0, c.name || "", c.message || ""].join("|")));
            const totalErrors = causes.length;
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

                const currentError = causes[currentIndex] || {
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
                            const rootPayload = this.__flamePayload || {};
                            const stackText
                                = mode === "compiled"
                                    ? String(currentError.compiledStack || rootPayload.compiledStack || "")
                                    : String(currentError.originalStack || rootPayload.originalStack || "");
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
                        headingElement.dataset.causeId = causeIds[currentIndex] || "";
                    } catch {}
                }

                // Debug: Log all error data received from server
                console.log("[flame:client:debug] Processing error data:", {
                    originalCodeFrameLength: currentError.originalCodeFrameContent?.length || 0,
                    originalFileColumn: currentError.originalFileColumn,
                    compiledCodeFrameLength: currentError.compiledCodeFrameContent?.length || 0,
                    compiledColumn: currentError.compiledColumn,
                    compiledFilePath: currentError.compiledFilePath,
                    compiledLine: currentError.compiledLine,
                    compiledSnippetLength: currentError.compiledSnippet?.length || 0,
                    errorMessage: `${currentError.message?.slice(0, 100)}...`,
                    errorName: currentError.name,
                    originalFilePath: currentError.originalFilePath,
                    hasCodeFrame: !!currentError.originalCodeFrameContent || !!currentError.compiledCodeFrameContent,
                    hasCompiledCodeFrame: !!currentError.compiledCodeFrameContent,
                    hasCompiledSnippet: !!currentError.compiledSnippet,
                    hasOriginalCodeFrame: !!currentError.originalCodeFrameContent,
                    hasOriginalSnippet: !!currentError.originalSnippet,
                    originalFileLine: currentError.originalFileLine,
                    originalCodeFrameLength: currentError.originalCodeFrameContent?.length || 0,
                    originalSnippetLength: currentError.originalSnippet?.length || 0,
                });

                // Show tabs conditionally: only show original/compiled tabs if we have both
                const hasOriginal = !!currentError.originalCodeFrameContent;
                const hasCompiled = !!currentError.compiledCodeFrameContent;
                const hasBoth = hasOriginal && hasCompiled;
                const hasEither = hasOriginal || hasCompiled;

                console.log("[flame:client:debug] Tab visibility calculation:", {
                    hasBoth,
                    hasCompiled,
                    hasEither,
                    hasOriginal,
                    modeSwitchElement: !!modeSwitch,
                    willShowModeSwitch: hasBoth,
                });

                if (hasBoth && modeSwitch)
                    modeSwitch.classList.remove("hidden");

                // If we don't have code frames but have file information, try to generate them
                if (!currentError.originalCodeFrameContent && !currentError.compiledCodeFrameContent && currentError.originalFilePath) {
                    // Try to fetch the original file and generate code frames
                    this.generateCodeFrames(currentError);
                }

                const originalButton = this.root.querySelector("[data-flame-mode=\"original\"]");
                const compiledButton = this.root.querySelector("[data-flame-mode=\"compiled\"]");

                // Hide buttons for tabs that don't have content
                console.log("[flame:client:debug] Button visibility setup:", {
                    compiledButtonExists: !!compiledButton,
                    hasCompiled,
                    hasOriginal,
                    originalButtonExists: !!originalButton,
                });

                if (originalButton) {
                    originalButton.style.display = hasOriginal ? "" : "none";
                    console.log(`[flame:client:debug] Original button display set to: ${hasOriginal ? "visible" : "none"}`);
                } else {
                    console.log("[flame:client:debug] Original button not found in DOM");
                }

                if (compiledButton) {
                    compiledButton.style.display = hasCompiled ? "" : "none";
                    console.log(`[flame:client:debug] Compiled button display set to: ${hasCompiled ? "visible" : "none"}`);
                } else {
                    console.log("[flame:client:debug] Compiled button not found in DOM");
                }

                const renderCode = (mode) => {
                    if (!flameOverlay)
                        return;

                    const html
                        = mode === "compiled"
                            ? currentError.compiledCodeFrameContent
                            : currentError.originalCodeFrameContent;

                    console.log(`[flame:client:debug] Rendering code for mode '${mode}':`, {
                        flameOverlayExists: !!flameOverlay,
                        hasHtml: !!html,
                        htmlLength: html?.length || 0,
                        mode,
                        usingCompiledCodeFrame: mode === "compiled" && !!currentError.compiledCodeFrameContent,
                        usingOriginalCodeFrame: mode !== "compiled" && !!currentError.originalCodeFrameContent,
                    });

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

    // Debug helper for manual testing
    globalThis.__flameTestOverlay = function (testError) {
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

                return overlay;
            }

            console.error("[flame:client] No overlay class found for testing");

            return null;
        } catch (error) {
            console.error("[flame:client] Test overlay creation failed:", error);

            return null;
        }
    };
} catch (error) {
    console.error("[flame:client] Failed to install global error handler:", error);
}
