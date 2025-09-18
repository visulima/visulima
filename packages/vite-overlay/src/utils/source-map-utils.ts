// Constants
const PATH_SEPARATOR = "/";
const BACKSLASH_SEPARATOR = "\\";

// Types
interface SourceMap {
    sources?: string[];
    sourcesContent?: (string | null)[];
}

/**
 * Extracts source content from a source map for a specific source file.
 * Handles both exact matches and partial path matches.
 * @param map The source map object
 * @param wantedSource The source file path to find
 * @returns The source content string or undefined if not found
 */
export const getSourceFromMap = (map: SourceMap, wantedSource: string | undefined): string | undefined => {
    if (!isValidSourceMap(map)) {
        return undefined;
    }

    // If no specific source requested, return the first available source
    if (!wantedSource && map.sourcesContent?.[0]) {
        return getSourceContent(map.sourcesContent[0]);
    }

    // Try different matching strategies
    const sourceIndex = findSourceIndex(map.sources, wantedSource || "");

    if (sourceIndex >= 0 && map.sourcesContent?.[sourceIndex]) {
        return getSourceContent(map.sourcesContent[sourceIndex]);
    }

    // Fallback to first source if available
    return map.sourcesContent?.[0] ? getSourceContent(map.sourcesContent[0]) : undefined;
};

/**
 * Validates that the source map has the required structure
 */
const isValidSourceMap = (map: SourceMap): boolean => Boolean(map && Array.isArray(map.sources) && Array.isArray(map.sourcesContent));

/**
 * Safely extracts source content from a source map entry
 */
const getSourceContent = (content: string | null | undefined): string | undefined => (typeof content === "string" ? content : undefined);

/**
 * Finds the index of a source in the source map using various matching strategies
 */
const findSourceIndex = (sources: string[] | undefined, wantedSource: string): number => {
    if (!sources || sources.length === 0) {
        return -1;
    }

    const exactIndex = sources.indexOf(wantedSource);

    if (exactIndex !== -1) {
        return exactIndex;
    }

    const needsNormalization = wantedSource.includes("\\") || wantedSource.includes("/");

    if (!needsNormalization) {
        return -1;
    }

    const normalizedWanted = normalizePath(wantedSource);

    const normalizedIndex = sources.indexOf(normalizedWanted);

    if (normalizedIndex !== -1) {
        return normalizedIndex;
    }

    for (const [index, source] of sources.entries()) {
        if (!source || typeof source !== "string") {
            continue;
        }

        const normalizedSource = normalizePath(source);

        if (isPartialMatch(normalizedSource, normalizedWanted)) {
            return index;
        }
    }

    return -1;
};

/**
 * Normalizes a path by converting backslashes to forward slashes
 */
const normalizePath = (path: string): string => path.replaceAll(BACKSLASH_SEPARATOR, PATH_SEPARATOR);

/**
 * Checks if two paths have a partial match relationship
 */
const isPartialMatch = (source: string, wanted: string): boolean => source === wanted || source.endsWith(wanted) || wanted.endsWith(source);
