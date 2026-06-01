/**
 * Minimal RFC 5988 Link header parser. We only need the `rel="next"`
 * URL to drive pagination across GitHub's REST API and Docker Registry
 * v2 tag listings — bringing in a full parser would be overkill.
 *
 * Returns the URL for each known `rel`. Unknown rels are dropped. A
 * `null` or empty input yields an empty object.
 */
export interface ParsedLinks {
    readonly first?: string;
    readonly last?: string;
    readonly next?: string;
    readonly previous?: string;
}

export const parseLinkHeader = (header: string | null | undefined): ParsedLinks => {
    if (!header) {
        return {};
    }

    const out: { first?: string; last?: string; next?: string; previous?: string } = {};

    for (const entry of header.split(",")) {
        const match = /^\s*<([^>]+)>\s*;\s*(.+)$/.exec(entry);

        if (!match) {
            continue;
        }

        const url = match[1] ?? "";
        const params = match[2] ?? "";
        const relMatch = /rel\s*=\s*"?([^";\s]+)"?/i.exec(params);
        const rel = relMatch?.[1]?.toLowerCase();

        switch (rel) {
            case "first": {
                out.first = url;

                break;
            }
            case "last": {
                out.last = url;

                break;
            }
            case "next": {
                out.next = url;

                break;
            }
            case "prev":
            case "previous": {
                out.previous = url;

                break;
            }
            default: {
                // Unknown rels (e.g. `up`, `payment`) are intentionally dropped.
                break;
            }
        }
    }

    return out;
};
