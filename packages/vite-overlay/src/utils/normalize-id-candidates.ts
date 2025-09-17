// Constants
const HTTP_URL_REGEX = /^https?:\/\//;

/**
 * Generates candidate paths for HTTP URLs (Vite-specific optimization)
 */
const generateUrlCandidates = (urlString: string): string[] => {
    const url = new URL(urlString);
    const { pathname } = url;
    const search = url.search || "";

    // Vite-specific patterns for module resolution
    const candidates = [
        pathname + search, // Full path with query (most common)
        pathname, // Just pathname
        pathname.replace(/^\/@fs\//, ""), // Remove @fs prefix
        decodeURIComponent(pathname + search), // Decoded full path
        decodeURIComponent(pathname), // Decoded pathname
    ];

    // Remove duplicates and filter out empty strings
    return [...new Set(candidates)].filter(Boolean);
};

/**
 * Checks if a string is an HTTP/HTTPS URL.
 */
export const isHttpUrl = (value: string): boolean => HTTP_URL_REGEX.test(value);

/**
 * Normalizes a file path and generates multiple candidate IDs for module resolution.
 * Optimized for Vite's module resolution patterns.
 */
export const normalizeIdCandidates = (filePath: string): string[] => {
    if (!filePath) return [];

    try {
        // Handle HTTP URLs (Vite dev server)
        if (isHttpUrl(filePath)) {
            return generateUrlCandidates(filePath);
        }

        // Handle local file paths (Vite-specific optimizations)
        const candidates = [filePath];

        // Add variations for common Vite patterns
        if (filePath.startsWith("/")) {
            candidates.push(filePath.slice(1)); // Remove leading slash
        }

        if (filePath.includes("?")) {
            candidates.push(filePath.split("?")[0]); // Remove query params
        }

        // Remove duplicates and return
        return [...new Set(candidates)].filter(Boolean);
    } catch (error) {
        console.warn(`Failed to normalize path "${filePath}":`, error);

        return [];
    }
};
