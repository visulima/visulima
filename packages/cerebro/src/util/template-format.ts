import colorizeTemplate from "@visulima/colorize/template";

// Cache for template formatting to avoid repeated string operations
const formatCache = new Map<string, string>();

const templateFormat = (string_?: string): string => {
    if (!string_) {
        return "";
    }

    // Check cache first
    const cached = formatCache.get(string_);

    if (cached !== undefined) {
        return cached;
    }

    // Only escape backticks if they exist
    const escaped = string_.includes("`") ? string_.replaceAll("`", "\\`") : string_;
    const result = colorizeTemplate(Object.assign([], { raw: [escaped] }));

    // Cache the result (limit cache size to prevent memory issues)
    if (formatCache.size < 100) {
        formatCache.set(string_, result);
    }

    return result;
};

export default templateFormat;
