// Constants
const HTTP_URL_REGEX = /^https?:\/\//;

/**
 * Generates candidate paths for HTTP URLs (Vite-specific optimization)
 */
const generateUrlCandidates = (urlString: string): string[] => {
    const url = new URL(urlString);
    const { pathname } = url;
    const search = url.search || "";

    const candidates = [pathname + search, pathname, pathname.replace(/^\/@fs\//, ""), decodeURIComponent(pathname + search), decodeURIComponent(pathname)];

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
    if (!filePath)
        return [];

    try {
        if (isHttpUrl(filePath)) {
            return generateUrlCandidates(filePath);
        }

        const candidates = [filePath];

        if (filePath.startsWith("/")) {
            candidates.push(filePath.slice(1));
        }

        if (filePath.includes("?")) {
            candidates.push(filePath.split("?")[0]);
        }

        return [...new Set(candidates)].filter(Boolean);
    } catch (error) {
        console.warn(`Failed to normalize path "${filePath}":`, error);

        return [];
    }
};
