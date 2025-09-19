/* eslint-disable n/no-unsupported-features/node-builtins */
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
    __v_oMode;

    /**
     * The error payload containing all error information
     * @type {VisulimaViteOverlayErrorPayload}
     */
    __v_oPayload;

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

        this.element = this;

        this.root.host._errorOverlay = this;

        // Store global reference for solution updates
        globalThis.__v_o__current = this;

        document.body.append(this);

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

        this.#initializeThemeToggle();

        this.#initializeCopyError();

        this.#initializePagination();

        // Inject solution into the overlay if available
        if (error.solution) {
            this.#injectSolution(error.solution);
        }

        this.#hideLoadingStates();

        const editorSelect = this.root.querySelector("#editor-selector");

        if (editorSelect) {
            let saved = null;

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
            });
        }
    }

    close() {
        if (this.parentNode) {
            this.remove();
        }
    }

    updateOverlay() {
        const currentIndex = 0; // Assuming we're showing the first error

        const currentError = this.__v_oPayload?.errors?.[currentIndex];

        if (currentError) {
            const flameOverlay = this.root.querySelector("#__v_o__overlay");

            if (flameOverlay) {
                const html = currentError.originalCodeFrameContent || currentError.compiledCodeFrameContent || "";

                flameOverlay.innerHTML = html;
            }
        }
    }

    #hideLoadingStates() {
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
                const payload = this.__v_oPayload;
                const currentError = payload?.errors?.[0]; // Get first error

                if (!currentError) {
                    console.warn("[v-o] No error data available to copy");

                    return;
                }

                const codeFrame = currentError?.originalSnippet || "";

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

    #initializePagination() {
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
                    const fullPath = currentError?.originalFilePath || "";
                    const line = currentError?.originalFileLine;
                    const column = currentError?.originalFileColumn;

                    if (fullPath) {
                        let displayPath = fullPath;

                        if (payload.rootPath && fullPath.startsWith(payload.rootPath)) {
                            displayPath = fullPath.slice(payload.rootPath.length);

                            if (!displayPath.startsWith("/")) {
                                displayPath = `/${displayPath}`;
                            }
                        }

                        fileElement.textContent = `.${displayPath}${line ? `:${line}` : ""}`;
                        const editor = localStorage.getItem("vo:editor");

                        const url = `/__open-in-editor?file=${encodeURIComponent(fullPath)}${
                            line ? `&line=${line}` : ""
                        }${column ? `&column=${column}` : ""}${editor ? `&editor=${editor}` : ""}`;

                        // Remove any existing event listeners
                        const newFileElement = fileElement.cloneNode(true);

                        fileElement.parentNode.replaceChild(newFileElement, fileElement);

                        newFileElement.addEventListener("click", (event) => {
                            event.preventDefault();
                            fetch(url, { method: "POST" });
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
                const stackElement = stackHost?.querySelector("div:last-child");

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

                        if (!m)
                            return `<div class="frame">${escape(line)}</div>`;

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

                            const url = `/__open-in-editor?file=${encodeURIComponent(resolved)}${
                                line ? `&line=${line}` : ""
                            }${column ? `&column=${column}` : ""}${editor ? `&editor=${editor}` : ""}`;

                            fetch(url, { method: "POST" });
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

            originalButton?.addEventListener("click", (event) => {
                event.preventDefault();

                this.__v_oMode = "original";

                renderCode("original");
                updateRawStack("original");

                originalButton?.classList.add("active");
                compiledButton?.classList.remove("active");
            });

            compiledButton?.addEventListener("click", (event) => {
                event.preventDefault();

                this.__v_oMode = "compiled";

                renderCode("compiled");
                updateRawStack("compiled");

                compiledButton?.classList.add("active");
                originalButton?.classList.remove("active");
            });
        };

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

        // Selection by error id (external)
        const selectById = (id) => {
            const index = errorIds.indexOf(String(id || ""));

            if (index !== -1) {
                currentIndex = index;

                updatePagination();
            }
        };

        globalThis.__v_oSelectError = selectById;

        globalThis.addEventListener("v-o:select-error", (event_) => {
            selectById(event_?.detail?.id);
        });

        updatePagination();
    }

    #initializeThemeToggle() {
        const savedTheme = localStorage.getItem("__v-o__theme");
        const systemPrefersDark = globalThis.matchMedia && globalThis.matchMedia("(prefers-color-scheme: dark)").matches;
        const currentTheme = savedTheme || (systemPrefersDark ? "dark" : "light");

        const isDark = currentTheme === "dark";

        const rootElement = this.root.querySelector("#__v_o__root");
        const darkButton = this.root.querySelector("[data-v-o-theme-click-value=\"dark\"]");
        const lightButton = this.root.querySelector("[data-v-o-theme-click-value=\"light\"]");

        if (isDark) {
            darkButton?.classList.add("hidden");
            darkButton?.classList.remove("block");
            lightButton?.classList.remove("hidden");
            lightButton?.classList.add("block");
            rootElement?.classList.add("dark");
        } else {
            darkButton?.classList.remove("hidden");
            darkButton?.classList.add("block");
            lightButton?.classList.add("hidden");
            lightButton?.classList.remove("block");
            rootElement?.classList.remove("dark");
        }

        rootElement?.classList.remove("hidden");

        const themeButtons = this.root.querySelectorAll("[data-v-o-theme-click-value]");

        themeButtons.forEach((button) => {
            button.addEventListener("click", (e) => {
                e.preventDefault();

                const theme = e.currentTarget.dataset.vOThemeClickValue;

                if (theme === "dark") {
                    rootElement?.classList.add("dark");
                    localStorage.setItem("__v-o__theme", "dark");

                    darkButton?.classList.add("hidden");
                    darkButton?.classList.remove("block");
                    lightButton?.classList.remove("hidden");
                    lightButton?.classList.add("block");
                } else {
                    rootElement?.classList.remove("dark");
                    localStorage.setItem("__v-o__theme", "light");

                    darkButton?.classList.remove("hidden");
                    darkButton?.classList.add("block");
                    lightButton?.classList.add("hidden");
                    lightButton?.classList.remove("block");
                }
            });
        });
    }

    #injectSolution(solution) {
        const solutions = this.root.querySelector("#__v_o__solutions");
        const solutionsContainer = this.root.querySelector("#__v_o__solutions_container");

        if (solutionsContainer && solution) {
            // Generate HTML from solution object
            let html = "";

            if (solution.header) {
                html += solution.header;
            }

            if (solution.body) {
                html += solution.body;
            }

            // Set the HTML content and show the container
            solutionsContainer.innerHTML = html;
            solutions.classList.remove("hidden");
        }
    }
}
