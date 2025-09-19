const PATH_SEPARATOR = "/";
const BACKSLASH_SEPARATOR = "\\";

interface SourceMap {
    sources?: string[];
    sourcesContent?: (string | null)[];
}

export const getSourceFromMap = (map: SourceMap, wantedSource: string | undefined): string | undefined => {
    if (!isValidSourceMap(map)) {
        return undefined;
    }

    if (!wantedSource && map.sourcesContent?.[0]) {
        return getSourceContent(map.sourcesContent[0]);
    }

    const sourceIndex = findSourceIndex(map.sources, wantedSource || "");

    if (sourceIndex >= 0 && map.sourcesContent?.[sourceIndex]) {
        return getSourceContent(map.sourcesContent[sourceIndex]);
    }

    return map.sourcesContent?.[0] ? getSourceContent(map.sourcesContent[0]) : undefined;
};

const isValidSourceMap = (map: SourceMap): boolean => Boolean(map && Array.isArray(map.sources) && Array.isArray(map.sourcesContent));

const getSourceContent = (content: string | null | undefined): string | undefined => (typeof content === "string" ? content : undefined);

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

const normalizePath = (path: string): string => path.replaceAll(BACKSLASH_SEPARATOR, PATH_SEPARATOR);

const isPartialMatch = (source: string, wanted: string): boolean => source === wanted || source.endsWith(wanted) || wanted.endsWith(source);
