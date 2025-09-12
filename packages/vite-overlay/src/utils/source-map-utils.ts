/**
 * Extracts source content from a source map for a specific source file.
 * Handles both exact matches and partial path matches.
 * @param map The source map object
 * @param wantedSource The source file path to find
 * @returns The source content string or undefined if not found
 */
export const getSourceFromMap = (map: any, wantedSource: string | undefined): string | undefined => {
    if (!map || !Array.isArray(map.sources) || !Array.isArray(map.sourcesContent)) {
        return undefined;
    }

    // If no specific source requested, return the first available source
    if (!wantedSource) {
        return typeof map.sourcesContent[0] === "string" ? map.sourcesContent[0] : undefined;
    }

    const normalizedWanted = wantedSource.replaceAll("\\", "/");

    // Try exact match first (fastest)
    let index = map.sources.indexOf(wantedSource);

    if (index >= 0) {
        return typeof map.sourcesContent[index] === "string" ? map.sourcesContent[index] : undefined;
    }

    // Try normalized exact match
    if (wantedSource !== normalizedWanted) {
        index = map.sources.indexOf(normalizedWanted);

        if (index >= 0) {
            return typeof map.sourcesContent[index] === "string" ? map.sourcesContent[index] : undefined;
        }
    }

    // Try partial matches
    for (let index = 0; index < map.sources.length; index++) {
        const normalizedSource = map.sources[index].replaceAll("\\", "/");

        if (normalizedSource === normalizedWanted || normalizedSource.endsWith(normalizedWanted) || normalizedWanted.endsWith(normalizedSource)) {
            return typeof map.sourcesContent[index] === "string" ? map.sourcesContent[index] : undefined;
        }
    }

    // Fallback to first source if available
    return typeof map.sourcesContent[0] === "string" ? map.sourcesContent[0] : undefined;
};
