/**
 * Extracts source content from a source map for a specific source file.
 * Handles both exact matches and partial path matches.
 * @param map - The source map object
 * @param wantedSource - The source file path to find
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

    const normalizedWanted = wantedSource.replace(/\\/g, "/");

    // Try exact match first (fastest)
    let idx = map.sources.indexOf(wantedSource);

    if (idx >= 0) {
        return typeof map.sourcesContent[idx] === "string" ? map.sourcesContent[idx] : undefined;
    }

    // Try normalized exact match
    if (wantedSource !== normalizedWanted) {
        idx = map.sources.indexOf(normalizedWanted);

        if (idx >= 0) {
            return typeof map.sourcesContent[idx] === "string" ? map.sourcesContent[idx] : undefined;
        }
    }

    // Try partial matches
    for (let i = 0; i < map.sources.length; i++) {
        const normalizedSource = map.sources[i].replace(/\\/g, "/");
        
        if (normalizedSource === normalizedWanted ||
            normalizedSource.endsWith(normalizedWanted) ||
            normalizedWanted.endsWith(normalizedSource)) {
            return typeof map.sourcesContent[i] === "string" ? map.sourcesContent[i] : undefined;
        }
    }

    // Fallback to first source if available
    return typeof map.sourcesContent[0] === "string" ? map.sourcesContent[0] : undefined;
};
