/**
 * Converts a minimal glob-like pattern into a regular expression for matching URL paths.
 *
 * Supported patterns:
 * - `*` matches any characters except `/`.
 * - `**` matches any characters including `/`.
 * - `?` matches a single character.
 * - All other characters are matched literally.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const patternToRegex = (pattern: string): RegExp => {
    let regex = "^";
    let index = 0;

    while (index < pattern.length) {
        const char = pattern[index];

        if (char === "*" && pattern[index + 1] === "*") {
            // ** matches anything including /
            index += 2;

            // Skip trailing slash after **
            if (pattern[index] === "/") {
                index += 1;
            }

            // If ** is at end and was preceded by /, make the / + rest optional
            // so that /api/auth/** matches both /api/auth and /api/auth/login
            if (index >= pattern.length && regex.endsWith("/")) {
                regex = `${regex.slice(0, -1)}(/.*)?`;
            } else if (index >= pattern.length) {
                regex += ".*";
            } else {
                // ** in middle of pattern — match path segments
                regex += "(.*/)?";
            }
        } else {
            switch (char) {
                case "*": {
                    // * matches anything except /
                    regex += "[^/]*";
                    index += 1;

                    break;
                }
                case ".": {
                    regex += String.raw`\.`;
                    index += 1;

                    break;
                }
                case "?": {
                    regex += "[^/]";
                    index += 1;

                    break;
                }
                default: {
                    regex += char;
                    index += 1;
                }
            }
        }
    }

    regex += "$";

    return new RegExp(regex);
};

/**
 * Check if a path matches a glob pattern.
 */
export const matchesPattern = (path: string, pattern: string): boolean => patternToRegex(pattern).test(path);

/**
 * Route configuration for a specific path pattern.
 */
export interface RouteConfig {
    /** Override the service name for requests matching this route. */
    service?: string;
}

/**
 * Determine whether a request path should be logged based on include/exclude patterns.
 *
 * - Exclusions take precedence over inclusions.
 * - If no include patterns are provided, all non-excluded paths are logged.
 * @param path The request path
 * @param include Glob patterns of paths to include
 * @param exclude Glob patterns of paths to exclude
 * @returns Whether the path should be logged
 */
export const shouldLog = (path: string, include?: string[], exclude?: string[]): boolean => {
    if (exclude?.some((pattern) => matchesPattern(path, pattern))) {
        return false;
    }

    if (!include?.length) {
        return true;
    }

    return include.some((pattern) => matchesPattern(path, pattern));
};

/**
 * Get the service name override for a given path based on route configuration.
 * Returns the first matching route's service name, or undefined if no match.
 * @param path The request path
 * @param routes Route configuration map (pattern → config)
 * @returns The service name override, or undefined
 */
export const getServiceForPath = (path: string, routes?: Record<string, RouteConfig>): string | undefined => {
    if (!routes) {
        return undefined;
    }

    const entries: [string, RouteConfig][] = Object.entries(routes);

    for (let i = 0; i < entries.length; i += 1) {
        const [pattern, config] = entries[i];

        if (matchesPattern(path, pattern)) {
            return config.service;
        }
    }

    return undefined;
};
