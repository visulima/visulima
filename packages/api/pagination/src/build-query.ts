/**
 * Serialize a query-parameter object into a URL-encoded query string (without a
 * leading `?`). Array values are appended as repeated keys (`tag=a`, `tag=b`)
 * instead of being collapsed into a single comma-joined value; `undefined` and
 * `null` entries are skipped.
 */
export const serializeQuery = (values: Record<string, unknown>): string => {
    const searchParameters = new URLSearchParams();

    for (const [key, value] of Object.entries(values)) {
        if (value === undefined || value === null) {
            continue;
        }

        if (Array.isArray(value)) {
            for (const item of value) {
                if (item !== undefined && item !== null) {
                    searchParameters.append(key, String(item));
                }
            }
        } else {
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            searchParameters.append(key, String(value));
        }
    }

    return searchParameters.toString();
};

/**
 * Append a single already-encoded `parameter` (e.g. `page=2`) to `url`, joining
 * it after the pre-serialized `baseQuery` when one is present.
 */
export const buildUrl = (url: string, baseQuery: string, parameter: string): string => {
    if (baseQuery === "") {
        return `${url}?${parameter}`;
    }

    return `${url}?${baseQuery}&${parameter}`;
};
