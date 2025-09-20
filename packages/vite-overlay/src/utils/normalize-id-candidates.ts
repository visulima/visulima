const HTTP_URL_REGEX = /^https?:\/\//;

const generateUrlCandidates = (urlString: string): string[] => {
    const url = new URL(urlString);
    const { pathname } = url;
    const search = url.search || "";

    const candidates = [pathname + search, pathname, pathname.replace(/^\/@fs\//, ""), decodeURIComponent(pathname + search), decodeURIComponent(pathname)];

    return [...new Set(candidates)].filter(Boolean);
};

export const isHttpUrl = (value: string): boolean => HTTP_URL_REGEX.test(value);
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
            const pathWithoutQuery = filePath.split("?")[0];
            if (pathWithoutQuery) {
                candidates.push(pathWithoutQuery);
            }
        }

        return [...new Set(candidates)].filter(Boolean);
    } catch (error) {
        console.warn(`Failed to normalize path "${filePath}":`, error);

        return [];
    }
};
