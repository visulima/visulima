/**
 * Checks if a string is an HTTP/HTTPS URL.
 */
export const isHttpUrl = (value: string): boolean => /^https?:\/\//.test(value);

/**
 * Normalizes a file path and generates multiple candidate IDs for module resolution.
 * This handles both HTTP URLs (from dev server) and local file paths.
 */
export const normalizeIdCandidates = (filePath: string): string[] => {
    const candidates: string[] = [];

    try {
        if (isHttpUrl(filePath)) {
            const u = new URL(filePath);
            const pathWithSearch = u.pathname + (u.search || "");
            const noLeading = pathWithSearch.startsWith("/") ? pathWithSearch.slice(1) : pathWithSearch;

            candidates.push(decodeURIComponent(pathWithSearch));
            candidates.push(decodeURIComponent(noLeading));
            candidates.push(decodeURIComponent(u.pathname));
        } else if (filePath) {
            candidates.push(filePath);
        }
    } catch {
        // Ignore URL parsing errors
    }

    return candidates;
};
