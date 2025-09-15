// Constants
const HTTP_URL_REGEX = /^https?:\/\//;

/**
 * Generates candidate paths for HTTP URLs
 */
const generateUrlCandidates = (urlString: string): string[] => {
    const url = new URL(urlString);
    const pathWithSearch = url.pathname + (url.search || "");
    const noLeadingSlash = pathWithSearch.startsWith("/") ? pathWithSearch.slice(1) : pathWithSearch;

    return [decodeURIComponent(pathWithSearch), decodeURIComponent(noLeadingSlash), decodeURIComponent(url.pathname)];
};

/**
 * Checks if a string is an HTTP/HTTPS URL.
 */
export const isHttpUrl = (value: string): boolean => HTTP_URL_REGEX.test(value);

/**
 * Normalizes a file path and generates multiple candidate IDs for module resolution.
 * This handles both HTTP URLs (from dev server) and local file paths.
 */
export const normalizeIdCandidates = (filePath: string): string[] => {
    if (!filePath) {
        return [];
    }

    try {
        if (isHttpUrl(filePath)) {
            const candidates = generateUrlCandidates(filePath);

            return candidates;
        }

        return [filePath];
    } catch (error) {
        // Log the error for debugging but don't throw
        console.warn(`Failed to normalize path "${filePath}":`, error);

        return [];
    }
};
