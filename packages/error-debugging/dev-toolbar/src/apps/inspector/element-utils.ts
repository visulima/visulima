/**
 * Element utility functions for annotation — shadow DOM piercing, CSS selector
 * generation, smart naming, text extraction, a11y capture, computed styles,
 * framework detection, screenshot, freeze, markdown export.
 */

import type { AccessibilityInfo, BoundingBox, FrameworkContext } from "../../types/annotations";

// ─── Shadow DOM Piercing ─────────────────────────────────────────────────────

/**
 * Recursively pierce shadow DOM boundaries to find the deepest element
 * at the given coordinates. Similar to agentation's deepElementFromPoint.
 */

/**
 * Check if an iframe's contentDocument is accessible (same-origin).
 */
const isSameOriginIframe = (iframe: HTMLIFrameElement): boolean => {
    try {
        const document_ = iframe.contentDocument;

        return document_ !== null && document_.body !== null;
    } catch {
        return false;
    }
};

export const deepElementFromPoint = (x: number, y: number): Element | null => {
    let element = document.elementFromPoint(x, y);

    if (!element) {
        return null;
    }

    // Keep drilling through shadow roots AND same-origin iframes
    let changed = true;

    while (changed) {
        changed = false;

        // Drill into shadow roots
        while (element?.shadowRoot) {
            const deeper = element.shadowRoot.elementFromPoint(x, y);

            if (!deeper || deeper === element) {
                break;
            }

            element = deeper;
            changed = true;
        }

        // Drill into same-origin iframes
        if (element?.tagName === "IFRAME") {
            const iframe = element as HTMLIFrameElement;

            if (isSameOriginIframe(iframe)) {
                const iframeRect = iframe.getBoundingClientRect();
                const iframeX = x - iframeRect.left;
                const iframeY = y - iframeRect.top;

                try {
                    const deeper = iframe.contentDocument!.elementFromPoint(iframeX, iframeY);

                    if (deeper && deeper !== iframe) {
                        element = deeper;
                        changed = true;
                    }
                } catch {
                    // Cross-origin or access error — stop here
                }
            }
        }
    }

    return element;
};

/**
 * Get the viewport-relative bounding rect for an element, accounting for
 * it potentially being inside nested iframes.
 */
export const getViewportRect = (element: Element): DOMRect => {
    const rect = element.getBoundingClientRect();
    let offsetX = 0;
    let offsetY = 0;

    let currentDocument = element.ownerDocument;

    while (currentDocument !== document) {
        const frameElement = currentDocument.defaultView?.frameElement as HTMLIFrameElement | null;

        if (!frameElement) {
            break;
        }

        const frameRect = frameElement.getBoundingClientRect();

        offsetX += frameRect.left;
        offsetY += frameRect.top;
        currentDocument = frameElement.ownerDocument;
    }

    return new DOMRect(rect.x + offsetX, rect.y + offsetY, rect.width, rect.height);
};

/**
 * Get the parent element, crossing shadow DOM boundaries.
 */
// ─── Deep Select / Pierce Mode ───────────────────────────────────────────────

const GENERIC_CONTAINER_TAGS = new Set(["ARTICLE", "ASIDE", "DIV", "FOOTER", "HEADER", "MAIN", "NAV", "SECTION", "SPAN"]);

/** Check if an element (or any ancestor) has opacity:0 or is hidden via CSS. */
const isEffectivelyInvisible = (element: Element): boolean => {
    if (typeof (element as HTMLElement).checkVisibility === "function") {
        return !(element as HTMLElement).checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    }

    let current: Element | null = element;

    while (current && current !== document.body) {
        if (getComputedStyle(current).opacity === "0") {
            return true;
        }

        current = current.parentElement;
    }

    return false;
};

/** Check if element has direct text content (not just children). */
const hasDirectContent = (element: Element): boolean => {
    if (!GENERIC_CONTAINER_TAGS.has(element.tagName)) {
        return true; // non-generic elements (button, a, img, input) are always "content"
    }

    for (const child of element.childNodes) {
        if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
            return true;
        }
    }

    return false;
};

/**
 * Pierce mode: Cmd+hover to find the actual element underneath invisible
 * overlays, animation wrappers, and empty container divs.
 *
 * Two-pass approach:
 *   1. Find elements with direct text content (skips empty wrappers)
 *   2. If no text found, return the smallest visible element (catches
 *      visual-only elements like timeline bars, chart segments, swatches)
 */
export const pierceElementFromPoint = (x: number, y: number): Element | null => {
    const topElement = document.elementFromPoint(x, y);

    if (!topElement) {
        return null;
    }

    // Pierce shadow DOM on the top element
    let pierced: Element = topElement;

    while (pierced.shadowRoot) {
        const deeper = pierced.shadowRoot.elementFromPoint(x, y);

        if (!deeper || deeper === pierced) {
            break;
        }

        pierced = deeper;
    }

    // If the top element already has content and is visible, return it
    if (hasDirectContent(pierced) && !isEffectivelyInvisible(pierced)) {
        return pierced;
    }

    // Get all elements stacked at this point
    const allElements = document.elementsFromPoint(x, y);

    // Pass 1: find first element with direct text content
    for (const candidate of allElements) {
        if (candidate === topElement || candidate === document.documentElement || candidate === document.body) {
            continue;
        }

        // Pierce shadow DOM on candidate too
        let deep: Element = candidate;

        while (deep.shadowRoot) {
            const d = deep.shadowRoot.elementFromPoint(x, y);

            if (!d || d === deep) {
                break;
            }

            deep = d;
        }

        if (hasDirectContent(deep) && !isEffectivelyInvisible(deep)) {
            return deep;
        }
    }

    // Pass 2: no text content found — return the smallest visible element
    const topRect = pierced.getBoundingClientRect();
    const topArea = topRect.width * topRect.height;
    let smallest: Element | null = null;
    let smallestArea = topArea;

    for (const candidate of allElements) {
        if (candidate === topElement || candidate === document.documentElement || candidate === document.body) {
            continue;
        }

        if (isEffectivelyInvisible(candidate)) {
            continue;
        }

        const rect = candidate.getBoundingClientRect();
        const area = rect.width * rect.height;

        if (area > 0 && area < smallestArea) {
            smallest = candidate;
            smallestArea = area;
        }
    }

    return smallest ?? pierced;
};

// ─── Parent Element (cross shadow DOM) ───────────────────────────────────────

export const getParentElement = (element: Element): Element | null => {
    if (element.parentElement) {
        return element.parentElement;
    }

    // Cross shadow DOM boundary
    const root = element.getRootNode();

    if (root instanceof ShadowRoot) {
        return root.host;
    }

    return null;
};

// ─── Fixed/Sticky Position Detection ─────────────────────────────────────────

/**
 * Check if element or any ancestor has fixed or sticky positioning.
 */
export const isElementFixed = (element: Element): boolean => {
    let current: Element | null = element;

    while (current) {
        const { position } = getComputedStyle(current);

        if (position === "fixed" || position === "sticky") {
            return true;
        }

        current = getParentElement(current);
    }

    return false;
};

// ─── Smart Element Naming ────────────────────────────────────────────────────

/**
 * Generate a human-readable element label like agentation:
 * button "Submit", link to /page, image "alt text", input[type=email]
 */
export const getElementLabel = (element: Element): string => {
    const tag = element.tagName.toLowerCase();

    // Buttons
    if (tag === "button" || (element as HTMLInputElement).type === "submit") {
        const text = element.textContent?.trim().slice(0, 40);

        return text ? `button "${text}"` : "button";
    }

    // Links
    if (tag === "a") {
        const href = (element as HTMLAnchorElement).getAttribute("href");
        const text = element.textContent?.trim().slice(0, 30);

        if (href && !href.startsWith("javascript:")) {
            return text ? `link "${text}" to ${href}` : `link to ${href}`;
        }

        return text ? `link "${text}"` : "link";
    }

    // Images
    if (tag === "img") {
        const { alt } = element as HTMLImageElement;

        return alt ? `image "${alt.slice(0, 40)}"` : "image";
    }

    // Inputs
    if (tag === "input") {
        const { type } = element as HTMLInputElement;
        const { placeholder } = element as HTMLInputElement;

        return placeholder ? `input[${type}] "${placeholder.slice(0, 30)}"` : `input[${type}]`;
    }

    // Textarea
    if (tag === "textarea") {
        const { placeholder } = element as HTMLTextAreaElement;

        return placeholder ? `textarea "${placeholder.slice(0, 30)}"` : "textarea";
    }

    // Headings
    if (/^h[1-6]$/.test(tag)) {
        const text = element.textContent?.trim().slice(0, 50);

        return text ? `${tag} "${text}"` : tag;
    }

    // Select
    if (tag === "select") {
        const label = element.getAttribute("aria-label") ?? (element as HTMLSelectElement).name;

        return label ? `select "${label}"` : "select";
    }

    // Generic with text content
    const text = element.textContent?.trim();

    if (text && text.length <= 30 && text.length > 0) {
        return `${tag} "${text}"`;
    }

    // Fall back to tag + id/class
    const id = element.id ? `#${element.id}` : "";
    const cls = element.classList.length > 0 ? `.${[...element.classList].slice(0, 2).join(".")}` : "";

    return `${tag}${id}${cls}` || tag;
};

// ─── CSS Selector Generation ─────────────────────────────────────────────────

const STATE_CLASSES = new Set(["active", "checked", "disabled", "focus", "hover", "selected", "visited"]);

/**
 * Generate a unique CSS selector for an element.
 * Strategy: ID → unique class combo → nth-of-type fallback.
 */
export const generateSelector = (element: Element): string => {
    if (element.id) {
        return `#${CSS.escape(element.id)}`;
    }

    const classes = [...element.classList].filter((c) => !STATE_CLASSES.has(c) && !c.startsWith("__") && !isModuleHash(c));

    if (classes.length > 0) {
        const tag = element.tagName.toLowerCase();

        for (const cls of classes) {
            const selector = `${tag}.${CSS.escape(cls)}`;

            if (document.querySelectorAll(selector).length === 1) {
                return selector;
            }
        }

        for (let i = 0; i < classes.length; i++) {
            for (let j = i + 1; j < classes.length; j++) {
                const selector = `${tag}.${CSS.escape(classes[i]!)}.${CSS.escape(classes[j]!)}`;

                if (document.querySelectorAll(selector).length === 1) {
                    return selector;
                }
            }
        }
    }

    // Position-based fallback
    const parts: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.body && current !== document.documentElement) {
        const tag = current.tagName.toLowerCase();
        let selector = tag;

        if (current.id) {
            parts.unshift(`#${CSS.escape(current.id)}`);

            break;
        }

        const parent: Element | null = current.parentElement;

        if (parent) {
            const siblings = [...parent.children].filter((c) => c.tagName === current!.tagName);

            if (siblings.length > 1) {
                const index = siblings.indexOf(current) + 1;

                selector += `:nth-of-type(${index})`;
            }
        }

        parts.unshift(selector);
        current = parent;
    }

    return parts.join(" > ");
};

// ─── CSS Module Hash Cleaning ────────────────────────────────────────────────

/** Detect CSS module hash suffixes (e.g. `class_abc123`, `class-2f3d4a`) */
const MODULE_HASH_RE = /[_-][a-f0-9]{5,}$/i;

const isModuleHash = (cls: string): boolean => MODULE_HASH_RE.test(cls);

/**
 * Clean CSS classes by stripping module hash suffixes.
 */
export const cleanCssClasses = (classes: DOMTokenList): string =>
    Array.from(classes, (cls) => cls.replace(MODULE_HASH_RE, ""))
        .filter(Boolean)
        .join(" ");

// ─── Full DOM Ancestry Path ──────────────────────────────────────────────────

/**
 * Build full DOM ancestry path (body > main > article > section > p).
 * Marks shadow DOM boundary crossings with ⟨shadow⟩.
 */
export const getFullDomPath = (element: Element): string => {
    const parts: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.documentElement) {
        const tag = current.tagName.toLowerCase();

        if (tag === "body") {
            parts.unshift("body");

            break;
        }

        const root = current.getRootNode();

        if (root instanceof ShadowRoot) {
            parts.unshift(`${tag} \u27E8shadow\u27E9`);
            current = root.host;
        } else {
            parts.unshift(tag);
            current = current.parentElement;
        }
    }

    return parts.join(" > ");
};

// ─── Nearby Elements Context ─────────────────────────────────────────────────

/**
 * Get sibling elements as context (up to 5 siblings).
 */
export const getNearbyElements = (element: Element): string => {
    const parent = element.parentElement;

    if (!parent) {
        return "";
    }

    const siblings = [...parent.children]
        .filter((c) => c !== element)
        .slice(0, 5)
        .map((c) => c.tagName.toLowerCase() + (c.id ? `#${c.id}` : ""));

    return siblings.join(", ");
};

// ─── Text Extraction ─────────────────────────────────────────────────────────

/**
 * Extract nearby text content from an element (up to maxLength chars).
 */
export const getNearbyText = (element: Element, maxLength: number = 120): string => {
    const ownText = element.textContent?.trim() ?? "";

    if (ownText.length > 0) {
        return ownText.length > maxLength ? `${ownText.slice(0, maxLength)}\u2026` : ownText;
    }

    const label = element.getAttribute("aria-label") ?? element.getAttribute("title") ?? "";

    if (label) {
        return label.length > maxLength ? `${label.slice(0, maxLength)}\u2026` : label;
    }

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        return element.placeholder?.slice(0, maxLength) ?? "";
    }

    return "";
};

/**
 * Capture currently selected text (up to maxLength chars).
 */
export const getSelectedText = (maxLength: number = 80): string => {
    const selection = globalThis.getSelection();

    if (!selection || selection.isCollapsed) {
        return "";
    }

    const text = selection.toString().trim();

    return text.length > maxLength ? `${text.slice(0, maxLength)}\u2026` : text;
};

// ─── Accessibility Capture ───────────────────────────────────────────────────

const FOCUSABLE_TAGS = new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]);

/**
 * Capture accessibility attributes from an element.
 */
export const captureAccessibility = (element: Element): AccessibilityInfo => {
    const element_ = element as HTMLElement;
    const role = element_.getAttribute("role") ?? element_.tagName.toLowerCase();
    const ariaLabel = element_.getAttribute("aria-label") ?? undefined;
    const ariaDescribedBy = element_.getAttribute("aria-describedby")
        ? document.getElementById(element_.getAttribute("aria-describedby")!)?.textContent?.trim()
        : undefined;
    const tabindexAttribute = element_.getAttribute("tabindex");
    const tabindex = tabindexAttribute === null ? undefined : Number.parseInt(tabindexAttribute, 10);

    const focusable = FOCUSABLE_TAGS.has(element_.tagName) || (tabindex !== undefined && tabindex >= 0);

    return {
        ariaDescribedBy,
        ariaLabel,
        focusable,
        role: role === element_.tagName.toLowerCase() ? undefined : role,
        tabindex,
    };
};

// ─── Computed Styles Capture ─────────────────────────────────────────────────

const FORENSIC_STYLE_PROPS = [
    "display",
    "position",
    "color",
    "background-color",
    "font-size",
    "font-family",
    "font-weight",
    "line-height",
    "padding",
    "margin",
    "border",
    "width",
    "height",
    "overflow",
    "z-index",
    "opacity",
];

/**
 * Capture key computed styles for forensic context.
 */
export const captureComputedStyles = (element: Element): string => {
    const computed = getComputedStyle(element);
    const parts: string[] = [];

    for (const prop of FORENSIC_STYLE_PROPS) {
        const value = computed.getPropertyValue(prop);

        if (value && value !== "normal" && value !== "none" && value !== "auto" && value !== "0px") {
            parts.push(`${prop}: ${value}`);
        }
    }

    return parts.join("; ");
};

// ─── Framework Component Detection ───────────────────────────────────────────

/**
 * Detect React component from fiber tree, including full component stack.
 */
const detectReact = (element: Element): FrameworkContext | undefined => {
    const fiberKey = Object.keys(element).find((k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"));

    if (!fiberKey) {
        return undefined;
    }

    let fiber = (element as any)[fiberKey];
    let componentName: string | undefined;
    let sourceFile: string | undefined;
    let sourceLine: number | undefined;
    const componentStack: string[] = [];

    while (fiber) {
        if (typeof fiber.type === "function" || typeof fiber.type === "object") {
            const name = fiber.type?.displayName ?? fiber.type?.name;

            if (name && !name.startsWith("_") && name !== "Fragment" && name !== "Suspense" && name.length > 1) {
                componentStack.push(name);

                if (!componentName) {
                    componentName = name;

                    if (fiber._debugSource) {
                        sourceFile = fiber._debugSource.fileName;
                        sourceLine = fiber._debugSource.lineNumber;
                    }
                }
            }
        }

        fiber = fiber.return;
    }

    if (!componentName) {
        return undefined;
    }

    return {
        componentName,
        componentStack: componentStack.length > 1 ? componentStack.reverse() : undefined,
        framework: "react",
        sourceFile,
        sourceLine,
    };
};

const detectVue = (element: Element): FrameworkContext | undefined => {
    let instance = (element as any).__vueParentComponent;

    if (!instance) {
        let current: Element | null = element;

        while (current) {
            instance = (current as any).__vueParentComponent;

            if (instance) {
                break;
            }

            current = current.parentElement;
        }
    }

    if (!instance) {
        return undefined;
    }

    const componentName = instance.type?.__name ?? instance.type?.name ?? instance.type?.__file?.split("/").pop()?.replace(".vue", "");

    if (!componentName) {
        return undefined;
    }

    // Build component stack
    const stack: string[] = [componentName];
    let { parent } = instance;

    while (parent) {
        const name = parent.type?.__name ?? parent.type?.name;

        if (name) {
            stack.push(name);
        }

        parent = parent.parent;
    }

    return {
        componentName,
        componentStack: stack.length > 1 ? stack.reverse() : undefined,
        framework: "vue",
        sourceFile: instance.type?.__file,
    };
};

const detectSvelte = (element: Element): FrameworkContext | undefined => {
    let current: Element | null = element;

    while (current) {
        const meta = (current as any).__svelte_meta;

        if (meta) {
            const file = meta.loc?.file ?? "";
            const componentName = file.split("/").pop()?.replace(".svelte", "") ?? "Unknown";

            return {
                componentName,
                framework: "svelte",
                sourceFile: file,
                sourceLine: meta.loc?.line,
            };
        }

        current = current.parentElement;
    }

    return undefined;
};

/**
 * Detect framework component for an element.
 */
export const detectFrameworkComponent = (element: Element): FrameworkContext | undefined => detectReact(element) ?? detectVue(element) ?? detectSvelte(element);

// ─── Screenshot Capture ──────────────────────────────────────────────────────

/**
 * Capture a screenshot of an element's bounding area.
 *
 * Uses the Screen Capture API (getDisplayMedia) to capture a frame from the
 * screen, then crops to the element's bounding rect. This is the most reliable
 * approach — works with external CSS, images, shadow DOM, and canvas content.
 *
 * Falls back to null if the user denies permission or the API is unavailable.
 */
export const captureElementScreenshot = async (element: Element): Promise<string | null> => {
    try {
        const rect = element.getBoundingClientRect();
        const padding = 20;
        const dpr = window.devicePixelRatio || 1;

        // Request screen capture — requires user gesture (button click)
        const stream = await navigator.mediaDevices.getDisplayMedia({
            audio: false,
            video: {
                displaySurface: "browser",
            } as MediaTrackConstraints,
        });

        // Get a single video frame
        const track = stream.getVideoTracks()[0];

        if (!track) {
            stream.getTracks().forEach((t) => t.stop());

            return null;
        }

        const video = document.createElement("video");

        video.srcObject = stream;
        video.muted = true;

        await video.play();

        // Wait one frame for the video to render
        await new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
        });

        // Draw full frame to canvas
        const fullCanvas = document.createElement("canvas");

        fullCanvas.width = video.videoWidth;
        fullCanvas.height = video.videoHeight;

        const fullContext = fullCanvas.getContext("2d");

        if (!fullContext) {
            stream.getTracks().forEach((t) => t.stop());

            return null;
        }

        fullContext.drawImage(video, 0, 0);

        // Stop the stream immediately
        stream.getTracks().forEach((t) => t.stop());

        // Crop to element bounding rect (adjusted for device pixel ratio)
        const cropX = Math.max(0, (rect.left - padding) * dpr);
        const cropY = Math.max(0, (rect.top - padding) * dpr);
        const cropW = Math.min((rect.width + padding * 2) * dpr, fullCanvas.width - cropX);
        const cropH = Math.min((rect.height + padding * 2) * dpr, fullCanvas.height - cropY);

        const cropCanvas = document.createElement("canvas");

        cropCanvas.width = cropW;
        cropCanvas.height = cropH;

        const cropContext = cropCanvas.getContext("2d");

        if (!cropContext) {
            return null;
        }

        cropContext.drawImage(fullCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        return cropCanvas.toDataURL("image/png");
    } catch {
        // User denied permission or API unavailable
        return null;
    }
};

// ─── Multi-Select Drag ───────────────────────────────────────────────────────

/**
 * Query all matching elements across the main document and same-origin iframes.
 */
const querySelectorAllWithIframes = (selector: string): Element[] => {
    const results: Element[] = [];

    const searchDocument = (document_: Document): void => {
        for (const element of document_.querySelectorAll(selector)) {
            results.push(element);
        }

        for (const iframe of document_.querySelectorAll("iframe")) {
            if (isSameOriginIframe(iframe)) {
                try {
                    searchDocument(iframe.contentDocument!);
                } catch {
                    /* ignore */
                }
            }
        }
    };

    searchDocument(document);

    return results;
};

/**
 * Get all elements within a rectangular region.
 * Searches across shadow DOM and same-origin iframes.
 */
export const getElementsInRect = (rect: DOMRect): Element[] => {
    const elements: Element[] = [];

    // Sample points within the rect (including through iframes)
    const stepX = Math.max(10, rect.width / 20);
    const stepY = Math.max(10, rect.height / 20);
    const seen = new Set<Element>();

    for (let { x } = rect; x <= rect.x + rect.width; x += stepX) {
        for (let { y } = rect; y <= rect.y + rect.height; y += stepY) {
            const element = deepElementFromPoint(x, y);

            if (element && !seen.has(element) && element.tagName !== "BODY" && element.tagName !== "HTML" && !element.tagName.includes("-")) {
                const elementRect = getViewportRect(element);

                if (
                    elementRect.left >= rect.x - 5
                    && elementRect.top >= rect.y - 5
                    && elementRect.right <= rect.x + rect.width + 5
                    && elementRect.bottom <= rect.y + rect.height + 5
                ) {
                    seen.add(element);
                    elements.push(element);
                }
            }
        }
    }

    // Also check nearby elements via selector (including inside iframes)
    const nearbySelector = "button, a, input, img, p, h1, h2, h3, h4, h5, h6, li, label, td, th";

    for (const element of querySelectorAllWithIframes(nearbySelector)) {
        if (seen.has(element) || element.tagName === "BODY" || element.tagName === "HTML") {
            continue;
        }

        const elementRect = getViewportRect(element);

        // Filter huge elements (>80% viewport) and tiny elements (<10px)
        if (elementRect.width > window.innerWidth * 0.8 && elementRect.height > window.innerHeight * 0.5) {
            continue;
        }

        if (elementRect.width < 10 || elementRect.height < 10) {
            continue;
        }

        // Check intersection with selection rect
        if (elementRect.left < rect.x + rect.width && elementRect.right > rect.x && elementRect.top < rect.y + rect.height && elementRect.bottom > rect.y) {
            seen.add(element);
            elements.push(element);
        }
    }

    // Filter out parent elements that contain other matched elements
    return elements.filter((element) => !elements.some((other) => other !== element && element.contains(other)));
};

/**
 * Get bounding boxes from a list of elements (iframe-aware).
 */
export const getElementBoundingBoxes = (elements: Element[]): BoundingBox[] =>
    elements.map((element) => {
        const r = getViewportRect(element);

        return { height: r.height, width: r.width, x: r.x, y: r.y };
    });

// ─── Markdown Export ─────────────────────────────────────────────────────────

/**
 * Output detail levels:
 * - compact: "Element: comment (re: "selected text...")"
 * - standard: Element + location + component + feedback
 * - detailed: + classes, position, context text
 * - forensic: + full DOM path, styles, accessibility, nearby elements
 */
export const annotationsToMarkdown = (
    annotations: {
        accessibility?: AccessibilityInfo;
        comment: string;
        computedStyles?: string;
        cssClasses?: string;
        elementLabel?: string;
        elementPath?: string;
        elementTag: string;
        frameworkContext?: FrameworkContext;
        fullPath?: string;
        intent: string;
        nearbyElements?: string;
        nearbyText?: string;
        selectedText?: string;
        severity: string;
        source?: string;
        status: string;
        url: string;
    }[],
    detail: "compact" | "detailed" | "forensic" | "standard" = "standard",
): string => {
    if (annotations.length === 0) {
        return "# Annotations\n\nNo annotations found.";
    }

    // ── Compact: one line per annotation ──
    if (detail === "compact") {
        const lines: string[] = [`# Annotations (${annotations.length})`, ""];

        for (const a of annotations) {
            const label = a.elementLabel ?? a.elementTag;
            const sel = a.selectedText ? ` (re: "${a.selectedText.slice(0, 30)}...")` : "";

            lines.push(`- **${label}:** ${a.comment}${sel}`);
        }

        return lines.join("\n");
    }

    const lines: string[] = ["# Annotations", "", `> ${annotations.length} annotation(s)`, ""];

    for (const [i, a] of annotations.entries()) {
        const label = a.elementLabel ?? a.elementTag;

        lines.push(`## ${i + 1}. [${a.intent.toUpperCase()}] ${a.severity} \u2014 ${label}`, "", `**Status:** ${a.status}`, `**URL:** ${a.url}`);

        if (a.elementPath) {
            lines.push(`**Selector:** \`${a.elementPath}\``);
        }

        if (a.source) {
            lines.push(`**Source:** \`${a.source}\``);
        }

        if (a.frameworkContext) {
            const fc = a.frameworkContext;

            lines.push(`**Component:** ${fc.componentName} (${fc.framework})`);

            if (fc.componentStack && fc.componentStack.length > 1) {
                lines.push(`**Stack:** ${fc.componentStack.join(" > ")}`);
            }

            if (fc.sourceFile) {
                lines.push(`**File:** \`${fc.sourceFile}${fc.sourceLine ? `:${fc.sourceLine}` : ""}\``);
            }
        }

        if (a.selectedText) {
            lines.push(`**Selected:** "${a.selectedText}"`);
        }

        // Detailed: add classes, position, context
        if (detail === "detailed" || detail === "forensic") {
            if (a.cssClasses) {
                lines.push(`**Classes:** \`${a.cssClasses}\``);
            }

            if (a.nearbyText) {
                lines.push(`**Context:** ${a.nearbyText}`);
            }

            if (a.fullPath) {
                lines.push(`**DOM Path:** \`${a.fullPath}\``);
            }
        }

        // Forensic: everything
        if (detail === "forensic") {
            if (a.accessibility?.role) {
                lines.push(`**Role:** ${a.accessibility.role}`);
            }

            if (a.nearbyElements) {
                lines.push(`**Nearby:** ${a.nearbyElements}`);
            }

            if (a.computedStyles) {
                lines.push(`**Styles:** \`${a.computedStyles}\``);
            }
        }

        lines.push("", a.comment, "", "---", "");
    }

    return lines.join("\n");
};
