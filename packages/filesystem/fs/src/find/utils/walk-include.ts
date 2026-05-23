const BACKSLASH_RE = /\\/g;

const walkInclude = (path: string, extensions?: string[], match?: RegExp[], skip?: RegExp[]): boolean => {
    if (Array.isArray(extensions) && extensions.length > 0 && !extensions.some((extension): boolean => path.endsWith(extension))) {
        return false;
    }

    // Glob patterns use forward slashes; normalize backslash separators on Windows.
    const matchPath = path.includes("\\") ? path.replace(BACKSLASH_RE, "/") : path;

    if (match && !match.some((pattern): boolean => pattern.test(matchPath))) {
        return false;
    }

    return !skip?.some((pattern): boolean => pattern.test(matchPath));
};

export default walkInclude;
