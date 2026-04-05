/** Category colors for the optimize TUI — shared between list and detail panels. */
const CATEGORY_COLORS: Record<string, string> = {
    "micro-utility": "gray",
    native: "green",
    preferred: "yellow",
    socket: "cyan",
};

/** Short labels for category badges in the list panel. */
const CATEGORY_LABELS: Record<string, string> = {
    "micro-utility": "MICRO",
    native: "NATIVE",
    preferred: "PREF",
    socket: "SOCKET",
};

/** Human-readable descriptions for each optimization category. */
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
    "micro-utility": "Trivial utility package that can be replaced with inline code.",
    native: "Polyfill for a native JS/Node.js API. Use the built-in instead.",
    preferred: "A lighter or faster alternative package exists.",
    socket: "Security-hardened replacement from Socket.dev's @socketregistry.",
};

export { CATEGORY_COLORS, CATEGORY_DESCRIPTIONS, CATEGORY_LABELS };
