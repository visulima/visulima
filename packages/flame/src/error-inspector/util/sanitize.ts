import DOMPurify from "isomorphic-dompurify";

export const sanitizeHtml = (value: unknown): string => {
    return DOMPurify.sanitize(String(value ?? ""));
};

export const sanitizeAttr = (value: unknown): string => {
    const sanitized = DOMPurify.sanitize(String(value ?? ""));

    // Escape for attribute context
    return sanitized.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
};

export const sanitizeUrlAttr = (value: unknown): string => {
    const raw = String(value ?? "").trim();
    const sanitized = DOMPurify.sanitize(raw);
    const lower = sanitized.toLowerCase();

    const isAllowed = lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("/") || lower.startsWith("./") || lower.startsWith("../");

    const safe = isAllowed ? sanitized : "#";

    return sanitizeAttr(safe);
};

export const sanitizeCodeHtml = (value: unknown): string => {
    // Preserve styling/classes produced by Shiki while sanitizing content
    return DOMPurify.sanitize(String(value ?? ""), { ADD_ATTR: ["class", "style"] as any });
};

export default {
    sanitizeHtml,
    sanitizeAttr,
    sanitizeUrlAttr,
    sanitizeCodeHtml,
};
