/**
 * Annotation intent — describes what the user wants to communicate.
 */
export type AnnotationIntent = "approve" | "change" | "fix" | "question";

/**
 * Annotation severity — how urgent or important the annotation is.
 */
export type AnnotationSeverity = "blocking" | "important" | "suggestion";

/**
 * Annotation status — lifecycle state.
 */
export type AnnotationStatus = "acknowledged" | "dismissed" | "pending" | "resolved";

/**
 * A single message in a conversation thread attached to an annotation.
 */
export interface ThreadMessage {
    /** Message text */
    content: string;

    /** Unique message identifier */
    id?: string;

    /** Who wrote it — e.g. "human", "agent", or a specific agent name */
    role: string;

    /** ISO 8601 timestamp */
    timestamp: string;
}

/**
 * Bounding box of the annotated element relative to the viewport.
 */
export interface BoundingBox {
    height: number;
    width: number;
    x: number;
    y: number;
}

/**
 * Detected framework component information.
 */
export interface FrameworkContext {
    /** Component name */
    componentName?: string;

    /** Full component stack (e.g. ["App", "Layout", "Header", "Button"]) */
    componentStack?: string[];

    /** Additional framework-specific data (e.g. props) */
    data?: Record<string, unknown>;

    /** Framework identifier (react, vue, svelte, etc.) */
    framework: string;

    /** Source file path */
    sourceFile?: string;

    /** Source line number */
    sourceLine?: number;
}

/**
 * Captured accessibility attributes for an element.
 */
export interface AccessibilityInfo {
    /** aria-describedby content */
    ariaDescribedBy?: string;

    /** aria-label value */
    ariaLabel?: string;

    /** Whether the element is focusable */
    focusable: boolean;

    /** ARIA role (explicit or implicit) */
    role?: string;

    /** tabindex value */
    tabindex?: number;
}

/**
 * A visual annotation placed on a page element during development.
 * Stored in `.devtoolbar/annotations.json`.
 */
export interface Annotation {
    /** Captured accessibility attributes */
    accessibility?: AccessibilityInfo;

    /** Element bounding box at annotation time */
    boundingBox?: BoundingBox;

    /** User feedback / description */
    comment: string;

    /** Key computed CSS properties for forensic context */
    computedStyles?: string;

    /** ISO 8601 creation timestamp */
    createdAt: string;

    /** CSS classes on the annotated element (module hashes cleaned) */
    cssClasses?: string;

    /** Bounding boxes for multi-select annotations */
    elementBoundingBoxes?: BoundingBox[];

    /** Human-readable element label (e.g. 'button "Submit"') */
    elementLabel?: string;

    /** CSS selector path to the element */
    elementPath?: string;

    /** HTML tag name of the annotated element */
    elementTag: string;

    /** Detected framework component context */
    frameworkContext?: FrameworkContext;

    /** Full DOM ancestry path (e.g. "body > main > article > p") */
    fullPath?: string;

    /** Unique identifier (crypto.randomUUID) */
    id: string;

    /** What the user wants — fix, change, question, or approve */
    intent: AnnotationIntent;

    /** Whether the element has fixed/sticky positioning */
    isFixed?: boolean;

    /** Whether this is a multi-select (drag) annotation */
    isMultiSelect?: boolean;

    /** Sibling elements for spatial context */
    nearbyElements?: string;

    /** Text near the annotated element for additional context */
    nearbyText?: string;

    /** ISO 8601 resolution timestamp */
    resolvedAt?: string;

    /** Who resolved it — "human" or "agent" (or a specific agent name) */
    resolvedBy?: string;

    /** Path to screenshot file relative to .devtoolbar/ (e.g. "screenshots/&lt;id>.png") */
    screenshot?: string;

    /** Text the user had selected when annotating */
    selectedText?: string;

    /** Severity level */
    severity: AnnotationSeverity;

    /** Source file location from data-vdt-source (file:line:col) */
    source?: string;

    /** Lifecycle status */
    status: AnnotationStatus;

    /** Conversation thread (human ↔ AI agent) */
    thread?: ThreadMessage[];

    /** ISO 8601 last-updated timestamp */
    updatedAt: string;

    /** Page URL where the annotation was created */
    url: string;

    /** Click X as percentage of viewport width (0-100) — survives resize */
    x: number;

    /**
     * Click Y as absolute page position (pixels from document top) — survives scroll.
     *  For fixed/sticky elements, Y is viewport-relative instead.
     */
    y: number;
}

/**
 * Data required to create a new annotation (server-generated fields omitted).
 */
export type CreateAnnotationData = Omit<Annotation, "createdAt" | "id" | "resolvedAt" | "resolvedBy" | "status" | "thread" | "updatedAt">;

/**
 * Fields that can be updated on an existing annotation.
 */
export interface UpdateAnnotationData {
    /** Updated comment text */
    comment?: string;

    /** Updated intent */
    intent?: AnnotationIntent;

    /** Who resolved the annotation */
    resolvedBy?: string;

    /** Updated severity */
    severity?: AnnotationSeverity;

    /** New status */
    status?: AnnotationStatus;

    /** Append a thread message */
    threadMessage?: ThreadMessage;
}
