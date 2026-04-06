// ─── Accessibility info capture ───────────────────────────────────────────────

interface A11yInfo {
    ariaAttributes: Record<string, string>;
    focusable: boolean;
    role: string | null;
    tabindex: number | null;
}

/** Collect accessibility-relevant attributes from an element. */
const captureA11yInfo = (element: Element): A11yInfo => {
    const ariaAttributes: Record<string, string> = {};

    for (const attr of element.attributes) {
        if (attr.name.startsWith("aria-")) {
            ariaAttributes[attr.name] = attr.value;
        }
    }

    const role = element.getAttribute("role");
    const tabindexAttribute = element.getAttribute("tabindex");
    const tabindex = tabindexAttribute === null ? null : Number.parseInt(tabindexAttribute, 10);

    // Determine focusability: natively focusable elements, or elements with tabindex >= 0
    const nativelyFocusable = new Set(["a", "button", "details", "input", "select", "summary", "textarea"]);
    const tag = element.tagName.toLowerCase();
    const isNativelyFocusable = nativelyFocusable.has(tag) && !element.hasAttribute("disabled");
    const isContentEditable = element.hasAttribute("contenteditable") && element.getAttribute("contenteditable") !== "false";
    const focusable = isNativelyFocusable || isContentEditable || (tabindex !== null && tabindex >= 0);

    return { ariaAttributes, focusable, role, tabindex };
};

/** Format A11yInfo as a plain-text summary for clipboard. */
const formatA11yText = (info: A11yInfo): string => {
    const lines: string[] = [];

    if (info.role) {
        lines.push(`role: ${info.role}`);
    }

    lines.push(`focusable: ${info.focusable}`);

    if (info.tabindex !== null) {
        lines.push(`tabindex: ${info.tabindex}`);
    }

    for (const [key, value] of Object.entries(info.ariaAttributes)) {
        lines.push(`${key}: ${value}`);
    }

    return lines.join("\n");
};

export { captureA11yInfo, formatA11yText };
export type { A11yInfo };
